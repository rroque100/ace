// Datos del Acta de Otorgamiento de la Buena Pro (B7, Arts. 83-86 del
// Reglamento), mapeados desde `hitos` — puro, sin red, testeable. La
// composición del .docx vive aparte en lib/buena-pro-docx.ts (mismo split que
// evaluadores-docx-datos.ts / evaluadores-docx.ts en Fase 1).

import { leerPostores, type Postor } from "./postores-seleccion";
import type { HitosMap } from "./procurement-fases";

export type DatosActaBuenaPro = {
  nomenclatura: string;
  fechaOtorgamiento: string;
  ganadorRazonSocial: string;
  montoAdjudicado: number;
  postoresAdmitidos: Postor[];
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// null cuando B7 no está "hecho": no tiene sentido generar el acta de un
// otorgamiento que todavía no ocurrió — el botón de exportar debe estar
// deshabilitado en ese caso (ver el wiring en fase-panel.tsx).
export function datosActaBuenaPro(nomenclatura: string, hitos: HitosMap): DatosActaBuenaPro | null {
  if (hitos.B7?.status !== "hecho") return null;
  const b7 = (hitos.B7.data ?? {}) as Record<string, unknown>;
  const b2 = (hitos.B2?.data ?? {}) as Record<string, unknown>;

  return {
    fechaOtorgamiento: txt(b7.fecha_otorgamiento),
    ganadorRazonSocial: txt(b7.ganador),
    montoAdjudicado: num(b7.monto_adjudicado),
    nomenclatura,
    postoresAdmitidos: leerPostores(b2.relacion_admitidos).filter((p) => p.admitido),
  };
}
