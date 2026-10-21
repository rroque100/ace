// Reconciliacion del status del expediente con su evidencia documental.
//
// Tras cargar/vincular documentos o registrar una evaluacion, el ciclo de vida
// (procurement_processes.status) debe avanzar solo hasta la etapa que la
// evidencia justifica. La logica de "que etapa corresponde" es pura y vive en
// lib/expediente-instruccion.ts (avanzarEstado); aqui solo se leen los datos del
// expediente y se persiste el avance con el JWT del usuario (RLS).

import { avanzarEstado, type DocumentoExpediente } from "./expediente-instruccion";
import type { ProcurementProcess } from "./processes";
import { supabaseUserRest, writeAuditLog } from "./supabase-server";

// Avanza el status si la evidencia lo justifica (solo hacia adelante). Devuelve
// el nuevo status cuando hubo cambio, o null. Nunca interrumpe el flujo: ante
// cualquier fallo devuelve null y deja el status como estaba.
export async function reconcileProcessStatus(
  accessToken: string,
  processId: string,
): Promise<string | null> {
  try {
    const [processes, documents, evaluaciones] = await Promise.all([
      supabaseUserRest<Array<Pick<ProcurementProcess, "id" | "status">>>(
        accessToken,
        `procurement_processes?id=eq.${processId}&select=id,status`,
      ),
      supabaseUserRest<DocumentoExpediente[]>(
        accessToken,
        `process_documents?process_id=eq.${processId}&select=kind,title,status`,
      ),
      supabaseUserRest<Array<{ id: string }>>(
        accessToken,
        `process_evaluations?process_id=eq.${processId}&select=id`,
      ),
    ]);

    const process = processes[0];
    if (!process) {
      return null;
    }

    const nuevoEstado = avanzarEstado(process.status, {
      documents: documents ?? [],
      evaluacionesCount: (evaluaciones ?? []).length,
    });
    if (!nuevoEstado) {
      return null;
    }

    await supabaseUserRest(accessToken, `procurement_processes?id=eq.${processId}`, {
      body: JSON.stringify({ status: nuevoEstado }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "process.status.auto_advance",
      details: { from: process.status, to: nuevoEstado },
      entityId: processId,
      entityType: "procurement_process",
    });

    return nuevoEstado;
  } catch {
    return null;
  }
}
