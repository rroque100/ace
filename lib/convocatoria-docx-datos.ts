// Datos del aviso de Convocatoria (B1, Arts. 63-64 del Reglamento), mapeados
// desde `hitos` + los datos propios del expediente — puro, sin red, testeable.
// Mismo split que buena-pro-docx-datos.ts / buena-pro-docx.ts (Task 5).

import type { HitosMap } from "./procurement-fases";

export type DatosConvocatoria = {
  nomenclatura: string;
  objectType: string;
  amount: number | null;
  fechaConvocatoria: string;
  numeroConvocatoria: string;
  plazoPresentacion: number;
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type ProcesoBase = { nomenclature: string; objectType: string; amount: number | null };

// null cuando B1 no está "hecho": no tiene sentido publicar el aviso de una
// convocatoria que todavía no se hizo.
export function datosConvocatoria(proceso: ProcesoBase, hitos: HitosMap): DatosConvocatoria | null {
  if (hitos.B1?.status !== "hecho") return null;
  const b1 = (hitos.B1.data ?? {}) as Record<string, unknown>;

  return {
    amount: proceso.amount,
    fechaConvocatoria: txt(b1.fecha_convocatoria),
    nomenclatura: proceso.nomenclature,
    numeroConvocatoria: txt(b1.numero_convocatoria),
    objectType: proceso.objectType,
    plazoPresentacion: num(b1.plazo_presentacion),
  };
}
