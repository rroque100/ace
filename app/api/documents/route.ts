import { after, NextResponse } from "next/server";
import { requireDec, requireUser } from "@/lib/auth";
import { deleteRecords } from "@/lib/pinecone";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  buildStoragePath,
  normalizeDocumentType,
  normalizeProcessType,
  resolveDocumentProcessType,
} from "@/lib/documents";
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
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentChunkVector = {
  document_id: string;
  pinecone_vector_id: string | null;
};

function appendFilter(path: string, key: string, value?: string | null) {
  if (!value) {
    return path;
  }

  return `${path}&${key}=eq.${encodeURIComponent(value)}`;
}

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    getSupabaseServerConfig();

    let query =
      "documents?select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at,oficina_id,es_institucional&order=created_at.desc&limit=30";
    // La biblioteca es de la oficina que sube: cada quien ve la suya y lo
    // marcado como institucional (la Ley, el Reglamento, plantillas comunes).
    // Admin ve todo, igual que el resto del scope por oficina (lib/auth.ts).
    if (!auth.user.isAdmin) {
      query += auth.user.oficinaId
        ? `&or=(es_institucional.eq.true,oficina_id.eq.${auth.user.oficinaId})`
        : "&es_institucional=eq.true";
    }

    const documents = await supabaseRest<DocumentRecord[]>(query);

    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      {
        documents: [],
        error: error instanceof Error ? error.message : "No se pudieron listar documentos",
        setupRequired: true,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    // Sin techo, un editor podia disparar subidas en rafaga y sangrar la cuota
    // de Storage + OCR (OpenAI Vision) + embeddings sin control. La ventana de
    // 1 min y el tope de 5 dejan margen para reintentos manuales sin abrir
    // puerta a abuso.
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "documents-upload"),
      RATE_LIMITS.upload,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }

    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json(
        { error: `El PDF supera el limite de ${maxPdfSizeLabel}` },
        { status: 400 },
      );
    }

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = buildStoragePath(file.name);
    const titleValue = formData.get("title");
    const sourceEntityValue = formData.get("sourceEntity");
    const title =
      typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
    const sourceEntity =
      typeof sourceEntityValue === "string" && sourceEntityValue.trim()
        ? sourceEntityValue.trim()
        : null;
    const documentType = normalizeDocumentType(formData.get("documentType"));
    const requestedProcessType = normalizeProcessType(formData.get("processType"));
    // Institucional = visible para cualquier oficina; si no, solo la que sube
    // lo ve (y admin, que ve todo). Default false: la excepción se marca.
    const esInstitucional = formData.get("esInstitucional") === "true";

    const scopedProcessType = resolveDocumentProcessType(documentType, requestedProcessType);
    if ("error" in scopedProcessType) {
      return NextResponse.json({ error: scopedProcessType.error }, { status: 400 });
    }
    const processType = scopedProcessType.processType;

    // Categoria de cambio declarada por el usuario (paso 2): original |
    // modificatoria | modificada. Para "modificatoria" se enlaza la norma base
    // (`amendsDocumentId`) y `amends` (texto) tiene prioridad sobre la IA en el
    // pipeline. Para "modificada" se guarda una nota informativa (`changeNote`).
    const changeCategoryValue = formData.get("changeCategory");
    const changeCategory =
      changeCategoryValue === "modificatoria" || changeCategoryValue === "modificada"
        ? changeCategoryValue
        : "original";
    const amendsValue = formData.get("amends");
    const amendsDocumentIdValue = formData.get("amendsDocumentId");
    const changeNoteValue = formData.get("changeNote");
    const amends =
      changeCategory === "modificatoria" && typeof amendsValue === "string" && amendsValue.trim()
        ? amendsValue.trim().slice(0, 400)
        : null;
    const amendsDocumentId =
      changeCategory === "modificatoria" &&
      typeof amendsDocumentIdValue === "string" &&
      amendsDocumentIdValue.trim()
        ? amendsDocumentIdValue.trim()
        : null;
    const changeNote =
      changeCategory === "modificada" && typeof changeNoteValue === "string" && changeNoteValue.trim()
        ? changeNoteValue.trim().slice(0, 400)
        : null;

    await uploadPdfToStorage(storagePath, file);

    const inserted = await supabaseRest<DocumentRecord[]>("documents", {
      body: JSON.stringify({
        document_type: documentType,
        es_institucional: esInstitucional,
        file_name: file.name,
        file_size: file.size,
        metadata: {
          amends,
          amendsDocumentId,
          changeCategory,
          changeNote,
          originalLastModified: file.lastModified || null,
          processType,
          uploadSource: "web",
        },
        mime_type: file.type,
        oficina_id: auth.user.oficinaId ?? null,
        process_type: processType,
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
      action: "document.upload",
      details: {
        documentType,
        fileName: file.name,
        fileSize: file.size,
        sourceEntity,
        processType,
      },
      entityId: document.id,
      entityType: "document",
      module: "documentos",
      processType,
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    // Procesa e indexa en segundo plano: el archivo ya esta guardado en Storage,
    // asi que la respuesta no debe bloquearse por la extraccion, OCR ni el upsert
    // a Pinecone (que puede exceder el timeout del request). El estado del
    // documento (uploaded -> processing -> indexed/error) refleja el avance.
    after(async () => {
      try {
        // Releer el `file` del request dentro de after() (ya enviada la
        // respuesta) devuelve bytes corruptos para archivos pequenos que viven
        // en memoria. El PDF ya esta en Storage, asi que se descarga desde alli
        // para procesarlo de forma fiable, igual que el reindexado.
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
      {
        error: error instanceof Error ? error.message : "No se pudo subir el documento",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    // Borrado masivo toca Storage + Pinecone + Postgres por cada documento del
    // set filtrado: el costo escala con el tamaño del corpus. Mismo techo que
    // upload/reindex para acotar el daño si alguien script-ea el endpoint.
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "documents-bulk-delete"),
      RATE_LIMITS.bulk,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const payload = (await request.json().catch(() => ({}))) as {
      documentType?: string;
      processType?: string;
    };
    const documentType = normalizeDocumentType(payload.documentType ?? null);
    const processType = normalizeProcessType(payload.processType ?? null);

    if (documentType === "otros" && payload.documentType !== "otros") {
      return NextResponse.json({ error: "Selecciona un tipo documental valido" }, { status: 400 });
    }

    if (!payload.documentType && !processType) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos tipo documental o tipo de proceso" },
        { status: 400 },
      );
    }

    let query =
      "documents?select=id,title,file_name,storage_bucket,storage_path,document_type,process_type";
    query = appendFilter(query, "document_type", payload.documentType ? documentType : null);
    query = appendFilter(query, "process_type", processType);

    const documents = await supabaseRest<
      Pick<
        DocumentRecord,
        "document_type" | "id" | "process_type" | "storage_bucket" | "storage_path" | "title"
      >[]
    >(query);

    if (documents.length === 0) {
      return NextResponse.json({
        deleted: {
          chunks: 0,
          documents: 0,
          storageObjects: 0,
          vectors: 0,
        },
      });
    }

    const ids = documents.map((document) => document.id);
    const chunks = await supabaseRest<DocumentChunkVector[]>(
      `document_chunks?document_id=in.(${ids.map((id) => `"${id}"`).join(",")})&select=document_id,pinecone_vector_id`,
    );
    const vectorIds = chunks
      .map((chunk) => chunk.pinecone_vector_id)
      .filter((vectorId): vectorId is string => Boolean(vectorId));

    await deleteRecords(vectorIds);

    const pathsByBucket = new Map<string, string[]>();
    for (const document of documents) {
      pathsByBucket.set(document.storage_bucket, [
        ...(pathsByBucket.get(document.storage_bucket) ?? []),
        document.storage_path,
      ]);
    }

    for (const [bucket, paths] of pathsByBucket) {
      await deleteStorageObjects(bucket, paths);
    }

    await supabaseRest(`documents?id=in.(${ids.map((id) => `"${id}"`).join(",")})`, {
      method: "DELETE",
    });

    await writeAuditLog({
      action: "document.bulk_delete",
      details: {
        documentType: payload.documentType ? documentType : null,
        documents: documents.map((document) => ({
          id: document.id,
          processType: document.process_type ?? null,
          title: document.title,
          type: document.document_type,
        })),
        processType,
        vectorCount: vectorIds.length,
      },
      entityType: "document",
      module: "documentos",
      processType,
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({
      deleted: {
        chunks: chunks.length,
        documents: documents.length,
        storageObjects: documents.length,
        vectors: vectorIds.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo ejecutar la eliminacion masiva",
      },
      { status: 500 },
    );
  }
}
