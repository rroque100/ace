import { after, NextResponse } from "next/server";
import { requireDec } from "@/lib/auth";
import { deleteRecords } from "@/lib/pinecone";
import { buildStoragePath } from "@/lib/documents";
import {
  type DocumentRecord,
  deleteStorageObjects,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { esProcesoValido, procesoDePdfModelo } from "@/lib/procesos-seleccion";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Modelos de requerimiento (plantillas PDF que sube la entidad). Se indexan en el
// MISMO RAG (Pinecone + Supabase) que el corpus legal, reusando
// processPdfForSearch, para que el copiloto de Necesidades redacte y complete la
// ficha apoyándose en el formato propio de la entidad.
//
// Se guardan con document_type="bases_integradas" (tipo válido: son bases/
// plantillas; el pipeline respeta un tipo != "otros" sin reclasificarlo) y una
// marca metadata.kind="modelo_requerimiento" para poder listarlos y borrarlos
// sin tocar el resto del corpus.

const KIND = "modelo_requerimiento";
const DOC_TYPE = "bases_integradas";
const MARCA = `document_type=eq.${DOC_TYPE}&metadata->>kind=eq.${KIND}`;

type ChunkVec = { document_id: string; pinecone_vector_id: string | null };

/** El procedimiento al que está vinculado un modelo, si lo está. */
function procesoDeDocumento(metadata: Record<string, unknown> | null | undefined): string | null {
  const v = metadata?.procesoSeleccion;
  return typeof v === "string" && esProcesoValido(v) ? v : null;
}

// Objeto que sirve el modelo. Un procedimiento del Reglamento puede tener varias
// plantillas —el «Concurso Público abreviado» del Art. 94 tiene cuatro— y el
// objeto es lo que descarta la que no encaja antes de que el RAG las ordene.
const OBJETOS = ["bienes", "servicios", "obras", "consultoria_obra"] as const;

function objetoDeDocumento(metadata: Record<string, unknown> | null | undefined): string | null {
  const v = metadata?.objeto;
  return typeof v === "string" && (OBJETOS as readonly string[]).includes(v) ? v : null;
}

export async function GET() {
  try {
    const auth = await requireDec();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const documents = await supabaseRest<DocumentRecord[]>(
      `documents?${MARCA}&select=id,title,file_name,file_size,status,error_message,source_entity,created_at,metadata&order=created_at.desc&limit=100`,
    );
    // El vínculo con el procedimiento vive en metadata.procesoSeleccion: es lo que
    // el copiloto usa para anclar el RAG al modelo del proceso elegido. Se expone
    // aparte para que la lista no tenga que hurgar en el jsonb.
    return NextResponse.json({
      documents: documents.map((d) => ({
        ...d,
        objeto: objetoDeDocumento(d.metadata),
        procesoSeleccion: procesoDeDocumento(d.metadata),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        documents: [],
        error: error instanceof Error ? error.message : "No se pudieron listar los modelos",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) return auth.error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el límite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = buildStoragePath(file.name);
    const titleValue = formData.get("title");
    const entidadValue = formData.get("entidad");
    const title =
      typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
    const sourceEntity =
      typeof entidadValue === "string" && entidadValue.trim()
        ? entidadValue.trim()
        : auth.user.entity ?? null;
    // Vínculo con el procedimiento. Si quien sube no elige ninguno, se deduce del
    // nombre del archivo: los modelos oficiales ya están en el catálogo, así que
    // volver a subir uno queda vinculado sin pedir nada.
    const procesoValue = formData.get("procesoSeleccion");
    const proceso =
      typeof procesoValue === "string" && esProcesoValido(procesoValue)
        ? procesoValue.trim()
        : procesoDePdfModelo(file.name);

    await uploadPdfToStorage(storagePath, file);

    const inserted = await supabaseRest<DocumentRecord[]>("documents", {
      body: JSON.stringify({
        document_type: DOC_TYPE,
        file_name: file.name,
        file_size: file.size,
        metadata: {
          kind: KIND,
          uploadSource: "configuracion-modelos",
          ...(proceso ? { procesoSeleccion: proceso } : {}),
        },
        mime_type: file.type,
        process_type: null,
        source_entity: sourceEntity,
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
      }),
      method: "POST",
    });
    const document = inserted[0];

    await writeAuditLog({
      action: "modelo_requerimiento.upload",
      details: { fileName: file.name, fileSize: file.size, proceso, sourceEntity, title },
      entityId: document.id,
      entityType: "document",
      module: "configuracion",
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    // Indexado en segundo plano (extracción + chunks + embeddings + Pinecone):
    // el PDF ya está en Storage, así que no bloqueamos la respuesta. El estado
    // (uploaded → processing → indexed/error) refleja el avance.
    after(async () => {
      try {
        const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
        const pdfFile = new File([blob], document.file_name, {
          type: document.mime_type || "application/pdf",
        });
        await processPdfForSearch(document, pdfFile);
      } catch {
        // processPdfForSearch ya persiste el error en el documento y el job.
      }
    });

    return NextResponse.json({ document, processing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el modelo" },
      { status: 500 },
    );
  }
}

/**
 * Vincula (o desvincula) un modelo con un tipo de proceso de selección.
 *
 * Es lo que hace que el modelo deje de estar aislado: `resolverModeloDocId`
 * busca por `metadata->>procesoSeleccion`, así que reasignar aquí cambia de
 * inmediato el modelo que el copiloto usa como ancla del RAG para ese
 * procedimiento, sin tocar los vectores ya indexados.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const body = (await request.json()) as {
      id?: string;
      objeto?: string | null;
      procesoSeleccion?: string | null;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Falta el id del modelo" }, { status: 400 });

    // Se distingue "no viene el campo" de "viene vacío": lo primero deja el valor
    // como está, lo segundo desvincula a propósito.
    const tocaProceso = body.procesoSeleccion !== undefined;
    const tocaObjeto = body.objeto !== undefined;
    const crudo = (body.procesoSeleccion ?? "").trim();
    const objeto = (body.objeto ?? "").trim();
    if (tocaProceso && crudo !== "" && !esProcesoValido(crudo)) {
      return NextResponse.json({ error: "Ese tipo de proceso no existe en el catálogo" }, { status: 400 });
    }
    if (tocaObjeto && objeto !== "" && !(OBJETOS as readonly string[]).includes(objeto)) {
      return NextResponse.json({ error: "Ese objeto de contratación no existe" }, { status: 400 });
    }

    const docs = await supabaseRest<Pick<DocumentRecord, "id" | "metadata" | "title">[]>(
      `documents?id=eq.${id}&${MARCA}&select=id,metadata,title`,
    );
    if (docs.length === 0) {
      return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
    }

    // PostgREST reemplaza el jsonb entero, así que se fusiona con lo que ya hay:
    // el pipeline de indexado guarda ahí el resumen, el nº de páginas, etc.
    const metadata: Record<string, unknown> = { ...(docs[0].metadata ?? {}) };
    if (tocaProceso) {
      if (crudo === "") delete metadata.procesoSeleccion;
      else metadata.procesoSeleccion = crudo;
    }
    if (tocaObjeto) {
      if (objeto === "") delete metadata.objeto;
      else metadata.objeto = objeto;
    }

    await supabaseRest(`documents?id=eq.${id}`, {
      body: JSON.stringify({ metadata }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "modelo_requerimiento.vincular",
      details: { id, objeto: objeto || null, proceso: crudo || null, title: docs[0].title },
      entityId: id,
      entityType: "document",
      module: "configuracion",
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({
      objeto: objetoDeDocumento(metadata),
      procesoSeleccion: procesoDeDocumento(metadata),
      updated: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo vincular el modelo" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta el id del modelo" }, { status: 400 });

    // Solo borra si el id es REALMENTE un modelo de requerimiento: evita que este
    // endpoint pueda eliminar corpus legal por id.
    const docs = await supabaseRest<
      Pick<DocumentRecord, "id" | "storage_bucket" | "storage_path" | "title">[]
    >(`documents?id=eq.${id}&${MARCA}&select=id,storage_bucket,storage_path,title`);
    if (docs.length === 0) {
      return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
    }
    const doc = docs[0];

    const chunks = await supabaseRest<ChunkVec[]>(
      `document_chunks?document_id=eq.${id}&select=document_id,pinecone_vector_id`,
    );
    const vectorIds = chunks
      .map((c) => c.pinecone_vector_id)
      .filter((v): v is string => Boolean(v));

    await deleteRecords(vectorIds);
    await deleteStorageObjects(doc.storage_bucket, [doc.storage_path]);
    // Borra la fila; los document_chunks se eliminan por FK on delete cascade.
    await supabaseRest(`documents?id=eq.${id}`, { method: "DELETE" });

    await writeAuditLog({
      action: "modelo_requerimiento.delete",
      details: { id, title: doc.title, vectorCount: vectorIds.length },
      entityId: id,
      entityType: "document",
      module: "configuracion",
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({ deleted: true, vectors: vectorIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el modelo" },
      { status: 500 },
    );
  }
}
