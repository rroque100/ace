import { advanceRagDocument } from "./archivo-rag-worker";
import { ARCHIVO_LEASE_MS, ARCHIVO_PENDING_MS } from "./archivo-processing-policy";
import {
  type ExpedienteArchivo,
} from "@/lib/expedientes-archivo";
import { processExpedienteDocument, reportArchivoProcessingFailure } from "@/lib/expedientes-archivo-processing";
import {
  downloadStorageObject,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";
import type { DrainSummary } from "@/lib/indexing-queue";

// Cola de indexación resiliente para la Biblioteca de Expedientes Archivados.
// Igual que el corpus normativo: el `after()` de subida/reindex/reemplazo es la
// vía rápida, pero si la invocación serverless muere a mitad del OCR (PDF grande,
// timeout), el expediente queda en 'uploaded' o 'processing' para siempre. Este
// drainer (invocado por el scheduled function / worker) reprocesa los atascados
// usando el PDF ya guardado en Storage. El estado (status + updated_at) ES la cola.

// Un 'processing' más viejo que esto se considera muerto y se re-encola.
const staleMinutes = Math.max(ARCHIVO_LEASE_MS / 60_000, Number.parseInt(process.env.EXPEDIENTES_STALE_MINUTES ?? "10", 10) || 10);
// Margen para que el `after()` de la subida reclame un 'uploaded' antes de que lo
// haga el drainer (evita reprocesar en paralelo lo que ya se está procesando).
const claimSeconds = Math.max(ARCHIVO_PENDING_MS / 1000, Number.parseInt(process.env.EXPEDIENTES_CLAIM_SECONDS ?? "120", 10) || 120);

const EXP_SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at,expediente_id";

// Expedientes pendientes (su `after()` nunca arrancó) o atascados (processing muerto).
// No reintenta los 'error' (son terminales: requieren reindex manual) para no
// entrar en bucle con PDF genuinamente ilegibles.
export async function findStuckExpedientes(limit = 20): Promise<ExpedienteArchivo[]> {
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const claimThreshold = new Date(Date.now() - claimSeconds * 1000).toISOString();
  const filter = `or=(and(status.eq.uploaded,updated_at.lt.${claimThreshold}),and(status.eq.processing,updated_at.lt.${staleThreshold}))`;
  return supabaseRest<ExpedienteArchivo[]>(
    `expedientes_archivo?${filter}&select=${EXP_SELECT}&order=created_at.asc&limit=${limit}`,
  );
}

// Presupuesto conservador entre bloques; cada invocación mantiene su límite
// de plataforma. La reserva permite recuperar un trabajo que exceda ese límite.
const drainTimeBudgetMs = 50_000;

// Procesa expedientes atascados hasta agotar `limit` candidatos o el presupuesto
// de tiempo. Cada uno en su try/catch para que uno con error no aborte el resto.
//
// Los de la carpeta RAG (`uploadSource: "rag-folder"`) se leen por BLOQUES de 3
// páginas (ver advanceRagDocument): antes esta función le daba una sola pasada
// por invocación, y como el cron de expedientes en Vercel corre UNA VEZ AL DÍA
// (plan Hobby: no admite crons más frecuentes), un documento de varios bloques
// —o un lote de varios documentos— podía tardar semanas en completarse por la
// vía automática. Ahora se insiste en el MISMO documento, bloque a bloque, hasta
// que termina o se acaba el presupuesto de la invocación, antes de pasar al
// siguiente — así una sola corrida diaria aprovecha los ~50 s enteros en vez de
// gastarlos en un bloque y parar.
export async function drainStuckExpedientes(limit = 20): Promise<DrainSummary> {
  const startedAt = Date.now();
  const expedientes = await findStuckExpedientes(limit);
  const items: DrainSummary["items"] = [];

  for (const expediente of expedientes) {
    if (Date.now() - startedAt > drainTimeBudgetMs) break;
    try {
      if (expediente.metadata?.uploadSource === "rag-folder") {
        let current: ExpedienteArchivo | null = expediente;
        while (
          current &&
          current.status !== "indexed" &&
          current.status !== "error" &&
          Date.now() - startedAt < drainTimeBudgetMs
        ) {
          await advanceRagDocument(current);
          [current] = await supabaseRest<ExpedienteArchivo[]>(
            `expedientes_archivo?id=eq.${expediente.id}&select=${EXP_SELECT}`,
          );
          // Otro proceso tiene una reserva activa: no consultar en bucle.
          if (current?.status === "processing") break;
        }
        items.push({ id: expediente.id, ok: true, title: expediente.title });
        continue;
      }
      const blob = await downloadStorageObject(
        expediente.storage_bucket,
        expediente.storage_path,
      );
      const file = new File([blob], expediente.file_name, {
        type: expediente.mime_type || "application/pdf",
      });
      await processExpedienteDocument(expediente, file);
      items.push({ id: expediente.id, ok: true, title: expediente.title });
    } catch (error) {
      items.push({
        error: error instanceof Error ? error.message : "Error desconocido",
        id: expediente.id,
        ok: false,
        title: expediente.title,
      });
      await reportArchivoProcessingFailure(expediente, error);
    }
  }

  const summary: DrainSummary = {
    failed: items.filter((item) => !item.ok).length,
    items,
    processed: items.filter((item) => item.ok).length,
    scanned: expedientes.length,
  };

  if (summary.scanned > 0) {
    await writeAuditLog({
      action: "expedientes.drain",
      details: summary,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    });
  }

  return summary;
}
