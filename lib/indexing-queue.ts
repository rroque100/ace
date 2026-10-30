import { processPdfForSearch } from "@/lib/pdf-processing";
import {
  type DocumentRecord,
  downloadStorageObject,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

// Cola de indexacion resiliente (drainer): el `after()` de la subida/reindex es la
// via rapida, pero si la invocacion serverless muere a mitad, el documento queda
// en 'uploaded' o 'processing' para siempre. Este drainer (invocado por cron) re-
// procesa los documentos atascados usando el PDF ya guardado en Storage. El estado
// del documento (status + updated_at) ES la cola; processing_jobs es el log detallado.

// Un documento 'processing' mas viejo que esto se considera muerto y se re-encola.
const staleMinutes = Number.parseInt(process.env.INDEXING_STALE_MINUTES ?? "10", 10);

const documentSelect =
  "id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at";

// Documentos pendientes (nunca arrancaron) o atascados (processing muerto).
export async function findStuckDocuments(limit = 3): Promise<DocumentRecord[]> {
  const threshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const filter = `and=(or(status.eq.uploaded,and(status.eq.processing,updated_at.lt.${threshold})),or(es_institucional.eq.false,and(metadata->>syncManaged.is.null,metadata->>proposedRegime.is.null)))`;
  return supabaseRest<DocumentRecord[]>(
    `documents?${filter}&select=${documentSelect}&order=created_at.asc&limit=${limit}`,
  );
}

export type DrainSummary = {
  scanned: number;
  processed: number;
  failed: number;
  items: Array<{ id: string; title: string; ok: boolean; error?: string }>;
};

// Procesa hasta `limit` documentos atascados. Cada uno en su try/catch para que
// uno con error no aborte el resto. Pensado para correr acotado por invocacion.
export async function drainStuckDocuments(limit = 3): Promise<DrainSummary> {
  const documents = await findStuckDocuments(limit);
  const items: DrainSummary["items"] = [];

  for (const document of documents) {
    try {
      const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
      const file = new File([blob], document.file_name, {
        type: document.mime_type || "application/pdf",
      });
      await processPdfForSearch(document, file);
      items.push({ id: document.id, ok: true, title: document.title });
    } catch (error) {
      items.push({
        error: error instanceof Error ? error.message : "Error desconocido",
        id: document.id,
        ok: false,
        title: document.title,
      });
      // processPdfForSearch ya marca el documento/job en error.
    }
  }

  const summary: DrainSummary = {
    failed: items.filter((item) => !item.ok).length,
    items,
    processed: items.filter((item) => item.ok).length,
    scanned: documents.length,
  };

  if (summary.scanned > 0) {
    await writeAuditLog({
      action: "indexing.drain",
      details: summary,
      entityType: "processing_job",
    });
  }

  return summary;
}
