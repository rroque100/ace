// Stepper del flujo de la Necesidad (C).
//
// El estado (borrador → remitido → revisión → conforme → incorporado) vive en la
// máquina de estados y en el "¿qué sigue?", pero no había una vista que dijera de
// un vistazo DÓNDE está y DESDE CUÁNDO. Los tres actores —área usuaria, DEC, área
// estratégica— tenían que deducirlo del estado y del historial. Este stepper lo
// hace visible, con la fecha en que se alcanzó cada hito.
//
// Las fechas salen de `audit_logs` (cada transición registra a qué estado llevó);
// no hay dato nuevo, solo se ordena el rastro que ya existe.

import { accionPorId } from "./necesidad-workflow";

/** Hitos de la línea principal (el "camino feliz"). */
export const PASOS_FLUJO = [
  { state: "borrador", label: "Borrador" },
  { state: "remitido_dec", label: "Remitida a la DEC" },
  { state: "en_revision_dec", label: "En revisión" },
  { state: "conforme", label: "Conforme" },
  { state: "incorporado_cmn", label: "Incorporada al CMN" },
] as const;

export type EstadoPaso = "done" | "current" | "pending";
export type PasoFlujo = { state: string; label: string; estado: EstadoPaso; fecha: string | null };

/** Estados que se salen de la línea principal (desvíos y término). */
const RAMA: Record<string, { tipo: "observado" | "no_objecion" | "anulada"; label: string; anclaEn: string | null }> = {
  observado: { tipo: "observado", label: "Observada — devuelta al área usuaria para subsanar", anclaEn: "en_revision_dec" },
  no_objecion_pendiente: { tipo: "no_objecion", label: "No objeción pendiente del área usuaria", anclaEn: "en_revision_dec" },
  anulada: { tipo: "anulada", label: "Anulada", anclaEn: null },
};

export function ramaFlujo(status: string | null | undefined) {
  return status ? (RAMA[status] ?? null) : null;
}

/**
 * Fechas de la PRIMERA vez que se alcanzó cada estado, a partir de las filas de
 * `audit_logs` (ordenadas ascendente por fecha). El "create" siembra el borrador.
 */
export function hitosEstadoDesdeAuditoria(
  rows: Array<{ action: string; created_at: string }>,
): Record<string, string> {
  const hitos: Record<string, string> = {};
  for (const r of rows) {
    const accionId = r.action.replace(/^necesidad\./, "");
    if (accionId === "create") {
      if (!hitos.borrador) hitos.borrador = r.created_at;
      continue;
    }
    const hacia = accionPorId(accionId)?.hacia;
    if (hacia && !hitos[hacia]) hitos[hacia] = r.created_at;
  }
  return hitos;
}

/**
 * Estado de cada hito canónico según el estado actual, la fecha de creación
 * (= borrador) y las fechas de primera vez que se alcanzó cada estado.
 *
 * Un desvío (observado / no objeción) se ancla en "En revisión": es donde el
 * requerimiento está de hecho, aunque la pelota esté en el tejado del área
 * usuaria. La anulación no ancla en ningún hito (se muestra aparte, como término).
 */
export function construirPasosFlujo(
  status: string,
  createdAt: string | null,
  hitos: Record<string, string>,
): PasoFlujo[] {
  const rama = ramaFlujo(status);
  const actualCanonico = rama ? rama.anclaEn : status;
  return PASOS_FLUJO.map((p) => {
    const fecha = p.state === "borrador" ? (hitos.borrador ?? createdAt) : (hitos[p.state] ?? null);
    const alcanzado = p.state === "borrador" ? true : Boolean(hitos[p.state]);
    const estado: EstadoPaso = p.state === actualCanonico ? "current" : alcanzado ? "done" : "pending";
    return { state: p.state, label: p.label, estado, fecha };
  });
}
