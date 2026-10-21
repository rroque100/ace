import { after, NextResponse } from "next/server";
import { requireDec } from "@/lib/auth";
import { normalizeDocumentType, normalizeProcessType } from "@/lib/documents";
import { deleteRecords } from "@/lib/pinecone";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentChunkVector = {
  pinecone_vector_id: string | null;
};

type ReindexPayload = {
  documentType?: string;
  ids?: string[];
  processType?: string;
  status?: string;
};

function appendFilter(path: string, key: string, value?: string | null) {
  if (!value) {
    return path;
  }

  return `${path}&${key}=eq.${encodeURIComponent(value)}`;
}

function escapeIds(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",");
}

async function getDocumentVectors(documentId: string) {
  const chunks = await supabaseRest<DocumentChunkVector[]>(
    `document_chunks?document_id=eq.${documentId}&select=pinecone_vector_id`,
  );
  const vectorIds = chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((vectorId): vectorId is string => Boolean(vectorId));

  return { chunks, vectorIds };
}

async function fetchDocuments(payload: ReindexPayload) {
  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((id) => typeof id === "string" && id.trim()).slice(0, 100)
    : [];
  const documentType = payload.documentType ? normalizeDocumentType(payload.documentType) : null;
  const processType = payload.processType ? normalizeProcessType(payload.processType) : null;

  let query =
    "documents?select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at&order=created_at.asc";

  if (Array.isArray(payload.ids)) {
    if (ids.length === 0) {
      return [];
    }

    query = `${query}&id=in.(${escapeIds(ids)})`;
  } else {
    query = appendFilter(query, "document_type", payload.documentType ? documentType : null);
    query = appendFilter(query, "process_type", processType);
    query = appendFilter(query, "status", payload.status || null);
  }

  return supabaseRest<DocumentRecord[]>(query);
}

export async function POST(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    // Bulk reindex puede tocar hasta 100 PDFs en un solo after(): es el endpoint
    // mas caro del corpus. Mismo techo que el borrado masivo para que un editor
    // no pueda script-ear una reindexada completa del corpus en pocos minutos.
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "documents-bulk-reindex"),
      RATE_LIMITS.bulk,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const payload = (await request.json().catch(() => ({}))) as ReindexPayload;
    const documents = await fetchDocuments(payload);

    if (documents.length === 0) {
      return NextResponse.json({ reindexed: { requested: 0, started: 0 } });
    }

    const ids = documents.map((document) => document.id);

    // Feedback inmediato y senal para el polling de la UI antes de procesar.
    await supabaseRest(`documents?id=in.(${escapeIds(ids)})`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    // Reindexa el grupo en segundo plano para no bloquear el request; el avance
    // y los errores quedan reflejados por documento (status) y en processing_jobs.
    after(async () => {
      for (const document of documents) {
        try {
          const { chunks, vectorIds } = await getDocumentVectors(document.id);
          await deleteRecords(vectorIds);
          await supabaseRest(`document_chunks?document_id=eq.${document.id}`, {
            method: "DELETE",
          });

          const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
          const file = new File([blob], document.file_name, {
            type: document.mime_type || "application/pdf",
          });
          const indexing = await processPdfForSearch(document, file);

          await writeAuditLog({
            action: "document.bulk_reindex.item",
            details: {
              deletedChunks: chunks.length,
              deletedVectors: vectorIds.length,
              newChunks: indexing.chunkCount,
              pageCount: indexing.pageCount,
              title: document.title,
            },
            entityId: document.id,
            entityType: "document",
          });
        } catch {
          // processPdfForSearch ya persiste el error por documento.
        }
      }

      await writeAuditLog({
        action: "document.bulk_reindex",
        details: { requested: documents.length },
        entityType: "document",
      });
    });

    return NextResponse.json(
      { reindexed: { requested: documents.length, started: documents.length } },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo reindexar el grupo de documentos",
      },
      { status: 500 },
    );
  }
}
