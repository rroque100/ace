// Datos de la Declaración de Consentimiento de la Buena Pro (B8, Art. 82 del
// Reglamento), mapeados desde `hitos` — puro, sin red, testeable. Mismo split
// que buena-pro-docx-datos.ts / buena-pro-docx.ts (Task 5).

import { leerPostores } from "./postores-seleccion";
import type { HitosMap } from "./procurement-fases";

export type DatosConsentimiento = {
  nomenclatura: string;
  fechaConsentimiento: string;
  huboImpugnacion: boolean;
  resultadoImpugnacion?: string;
  // Art. 82.2: si se presentó UNA sola oferta, la buena pro queda consentida
  // el mismo día de su otorgamiento (excepción al plazo general). Se deriva
  // de los postores admitidos de B2 (leerPostores, Task 3), no se pregunta
  // aparte — evita que el dato pueda contradecirse entre pasos.
  ofertaUnica: boolean;
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// null cuando B8 no está "hecho": no tiene sentido declarar consentida una
// buena pro que todavía no se ha declarado.
export function datosConsentimiento(nomenclatura: string, hitos: HitosMap): DatosConsentimiento | null {
  if (hitos.B8?.status !== "hecho") return null;
  const b8 = (hitos.B8.data ?? {}) as Record<string, unknown>;
  const b2 = (hitos.B2?.data ?? {}) as Record<string, unknown>;
  const admitidos = leerPostores(b2.relacion_admitidos).filter((p) => p.admitido);
  const resultado = txt(b8.resultado_impugnacion);

  return {
    fechaConsentimiento: txt(b8.fecha_consentimiento),
    huboImpugnacion: b8.hubo_impugnacion === true,
    nomenclatura,
    ofertaUnica: admitidos.length === 1,
    ...(resultado ? { resultadoImpugnacion: resultado } : {}),
  };
}
