import type { ExpedienteArchivo } from "./expedientes-archivo";
import { supabaseRest } from "./supabase-server";
import { archivoNeedsRecovery } from "./archivo-processing-policy";
export { archivoNeedsRecovery } from "./archivo-processing-policy";

// Mayor que la duración máxima de una invocación de procesamiento (300 s).

export class ArchivoProcessingBusyError extends Error {
  constructor() { super("El documento ya está siendo procesado o cambió. Actualiza su estado."); }
}

export async function claimArchivoProcessing(row: ExpedienteArchivo): Promise<ExpedienteArchivo> {
  if (!row.updated_at || (row.status === "processing" && !archivoNeedsRecovery(row))) {
    throw new ArchivoProcessingBusyError();
  }
  const [claimed] = await supabaseRest<ExpedienteArchivo[]>(
    `expedientes_archivo?id=eq.${row.id}&updated_at=eq.${encodeURIComponent(row.updated_at)}&select=*`,
    { method: "PATCH", body: JSON.stringify({ status: "processing", updated_at: new Date().toISOString(), error_message: null }) },
  );
  if (!claimed) throw new ArchivoProcessingBusyError();
  return claimed;
}
