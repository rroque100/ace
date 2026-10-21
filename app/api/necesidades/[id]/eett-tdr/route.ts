import { after, NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { borrarFicherosDe, type DocumentoConFichero } from "@/lib/necesidad-borrado";
import { buildStoragePath } from "@/lib/documents";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { leerDocx } from "@/lib/docx-a-bloques";
import { extractPdfPagedText, processPdfForSearch } from "@/lib/pdf-processing";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { DOC_TYPE_EETT, KIND_EETT, filtroEettTdr } from "@/lib/eett-tdr-documento";

/** Mime de Word moderno. Los .doc antiguos no entran: no son zip. */
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Módulo EETT/TDR de la Necesidad (1.ª versión que propone el área usuaria).
//
// El PDF de Especificaciones Técnicas (bienes) o Términos de Referencia
// (servicios) se sube DESPUÉS de crear la necesidad, se INDEXA en el RAG
// (Pinecone + Supabase, mismo pipeline que los modelos y el corpus legal) y se
// devuelve su TEXTO extraído para editarlo en el modal (editor tipo Google Docs).
//
// Se guarda en la tabla `documents` (capaz de RAG) con document_type
// "bases_integradas" y metadata.kind="eett_tdr" + necesidadId + tipo (eett|tdr),
// para listarlo/borrarlo por necesidad sin tocar el resto del corpus.

// Alias locales para no reescribir los usos de `marca`/`KIND`/`DOC_TYPE`
// repartidos por el fichero; la definición vive en lib/eett-tdr-documento.
const KIND = KIND_EETT;
const DOC_TYPE = DOC_TYPE_EETT;
const marca = filtroEettTdr;

type EettTdrDoc = DocumentRecord & { metadata?: Record<string, unknown> };

// GET → lista los EETT/TDR de la necesidad.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    getSupabaseServerConfig();
    const documents = await supabaseRest<EettTdrDoc[]>(
      `documents?${marca(id)}&select=id,title,file_name,file_size,status,error_message,metadata,created_at&order=created_at.desc`,
    );
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { documents: [], error: error instanceof Error ? error.message : "No se pudieron listar los EETT/TDR" },
      { status: 500 },
    );
  }
}

// POST → sube el PDF, extrae su texto (para el editor) e indexa en el RAG.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta el EETT/TDR." }, { status: 400 });
    }
    // PDF o Word. El área usuaria redacta en Word y muchas veces lo que tiene a
    // mano es el .docx, no una impresión a PDF: obligar a convertir era un paso
    // extra que solo servía para que el fichero llegase peor.
    const esPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const esDocx =
      file.type === DOCX_MIME || /\.docx$/i.test(file.name);
    if (!esPdf && !esDocx) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF o Word (.docx)." },
        { status: 400 },
      );
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${maxPdfSizeLabel}.` },
        { status: 400 },
      );
    }
    const tipoValue = formData.get("tipo");
    const tipo = tipoValue === "eett" || tipoValue === "tdr" ? tipoValue : "tdr";

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = buildStoragePath(file.name);
    const title = file.name.replace(/\.(pdf|docx)$/i, "");

    await uploadPdfToStorage(storagePath, file);

    // Texto para el editor: se extrae ahora (síncrono) para prellenar el modal.
    let text = "";
    let pageCount = 0;
    try {
      if (esDocx) {
        // Un .docx no tiene páginas —la paginación la decide Word al imprimir—,
        // así que se extrae por párrafos y `pageCount` queda en 0. La revisión
        // citará por párrafo en vez de por página.
        const parrafos = await leerDocx(Buffer.from(await file.arrayBuffer()));
        text = parrafos
          .map((p) => p.fragmentos.map((f) => f.texto).join(""))
          .join("\n");
      } else {
        // Con marcadores de página para que la revisión cite la página.
        const extracted = await extractPdfPagedText(file);
        text = extracted.text;
        pageCount = extracted.pageCount;
      }
    } catch {
      // Si la extracción falla (escaneo de baja calidad, .docx corrupto), el
      // editor arranca vacío y el usuario redacta; el indexado lo reintenta.
    }

    const inserted = await supabaseRest<EettTdrDoc[]>("documents", {
      body: JSON.stringify({
        document_type: DOC_TYPE,
        file_name: file.name,
        file_size: file.size,
        metadata: {
          kind: KIND,
          necesidadId: id,
          tipo,
          uploadSource: "necesidad-eett-tdr",
          // Texto extraído del PDF, para reabrir el editor con el contenido del
          // EETT/TDR (no con la descripción del pedido). Capado para no inflar la
          // metadata; el RAG conserva el texto completo en los chunks.
          textoExtraido: (text ?? "").slice(0, 60000),
        },
        mime_type: file.type,
        process_type: null,
        source_entity: auth.user.entity ?? null,
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
      }),
      method: "POST",
    });
    const document = inserted[0];

    await writeAuditLog({
      action: "necesidad.eett_tdr.upload",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, necesidadId: id, tipo },
      entityId: document.id,
      entityType: "document",
      module: "necesidades",
    });

    // Indexado en Pinecone en segundo plano (no bloquea la respuesta): el PDF ya
    // está en Storage y el texto ya se devolvió para editar.
    after(async () => {
      // El indexado para el buscador con IA es solo de PDF: `processPdfForSearch`
      // parsea páginas. Un .docx no pasa por ahí, y llamarlo igualmente solo
      // dejaría el documento marcado como fallido. Se salta con constancia: el
      // texto YA está extraído y guardado en `metadata.textoExtraido`, así que el
      // editor y la revisión contra el modelo del OECE funcionan igual; lo único
      // que no hace el .docx es alimentar la búsqueda semántica.
      if (esDocx) {
        console.info(
          `[eett-tdr] ${document.id} es .docx: se omite el indexado semántico (solo PDF). El texto queda extraído para el editor.`,
        );
        return;
      }
      try {
        const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
        const pdfFile = new File([blob], document.file_name, { type: document.mime_type || "application/pdf" });
        await processPdfForSearch(document, pdfFile);
      } catch {
        // processPdfForSearch persiste el error en el documento/job.
      }
    });

    return NextResponse.json(
      { document: { id: document.id, title: document.title, file_name: document.file_name, tipo }, text, pageCount, indexing: true },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el EETT/TDR." },
      { status: 500 },
    );
  }
}

// DELETE ?docId= → elimina el EETT/TDR (fila + chunks por cascada) del RAG.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const docId = new URL(request.url).searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "Falta el documento a eliminar." }, { status: 400 });
  const malos = idsDeRutaInvalidos(id, docId);
  if (malos) return malos;
  try {
    // Solo borra si es REALMENTE un EETT/TDR de ESTA necesidad.
    const docs = await supabaseRest<Array<EettTdrDoc & DocumentoConFichero>>(
      `documents?id=eq.${docId}&${marca(id)}&select=id,storage_bucket,storage_path`,
    );
    if (docs.length === 0) return NextResponse.json({ error: "EETT/TDR no encontrado." }, { status: 404 });
    // El PDF, antes que la fila: borrar solo la fila dejaba el fichero suelto en
    // el almacén, sin nadie que volviera a nombrarlo.
    await borrarFicherosDe(docs);
    await supabaseRest(`documents?id=eq.${docId}`, { method: "DELETE" });
    await writeAuditLog({
      action: "necesidad.eett_tdr.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { docId, necesidadId: id },
      entityId: docId,
      entityType: "document",
      module: "necesidades",
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el EETT/TDR." },
      { status: 500 },
    );
  }
}
