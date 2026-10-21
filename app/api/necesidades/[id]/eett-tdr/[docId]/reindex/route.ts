import { after, NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { deleteRecords } from "@/lib/pinecone";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChunkVector = { pinecone_vector_id: string | null };

async function getDocumentVectors(documentId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `document_chunks?document_id=eq.${documentId}&select=pinecone_vector_id`,
  );
  const vectorIds = chunks
    .map((c) => c.pinecone_vector_id)
    .filter((v): v is string => Boolean(v));
  return { chunks, vectorIds };
}

// POST → reindexa el EETT/TDR. Mismo guard que la subida (necesidad.manage) y
// mismo patrón que /api/documents/[id]: marca `processing`, borra vectores/chunks
// viejos y reprocesa en `after()`. El modal hace polling de GET rag.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(
    getRateLimitKey(request, auth.user.id, "eett-tdr-reindex"),
    RATE_LIMITS.reindex,
  );
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const malos = idsDeRutaInvalidos(docId);
    if (malos) return malos;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Feedback inmediato en la UI: el polling del modal detecta el `processing`.
    await supabaseRest(`documents?id=eq.${docId}`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    after(async () => {
      try {
        const { chunks, vectorIds } = await getDocumentVectors(docId);
        await deleteRecords(vectorIds);
        await supabaseRest(`document_chunks?document_id=eq.${docId}`, { method: "DELETE" });

        const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
        const file = new File([blob], doc.file_name, { type: doc.mime_type || "application/pdf" });
        const indexing = await processPdfForSearch(doc, file);

        await writeAuditLog({
          action: "necesidad.eett_tdr.reindex",
          details: {
            deletedChunks: chunks.length,
            deletedVectors: vectorIds.length,
            newChunks: indexing.chunkCount,
            pageCount: indexing.pageCount,
            textLength: indexing.textLength,
          },
          entityId: docId,
          entityType: "document",
        });
      } catch {
        // processPdfForSearch ya persiste el error en el documento y el job.
      }
    });

    return NextResponse.json({ reindexando: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reindexar el EETT/TDR" },
      { status: 500 },
    );
  }
}
