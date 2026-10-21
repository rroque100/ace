// Gates entre los pasos de la Fase 2 (Ley N° 32069, Reglamento D.S. 009-2025-EF
// mod. por D.S. 001-2026-EF). Mismo patrón que lib/expediente-contenido.ts
// (Fase 1): cada literal es una condición real de la norma, no una regla
// inventada — si un paso previo no cerró, el siguiente no debería poder
// marcarse "hecho" sin que quien lo hace lo vea explícitamente.
//
//   B7 (Otorgamiento) exige B6 (Evaluación) cerrado — Art. 80: solo se otorga
//   la buena pro sobre ofertas ya evaluadas y calificadas.
//   B7 exige B4 (Bases integradas) cerrado SI hubo consultas u observaciones
//   en B3 — Art. 74: cuando el pliego absolutorio modifica las bases, hay que
//   publicar la versión integrada antes de seguir; si no hubo consultas ni
//   observaciones, no hay nada que integrar.
//   B8 (Consentimiento) exige B7 (Otorgamiento) cerrado — Art. 82.1: el plazo
//   de consentimiento corre desde el otorgamiento, no puede haber consentimiento
//   sin un otorgamiento previo.

import { hecho } from "./expediente-contenido";
import type { HitosMap } from "./procurement-fases";

export type LiteralSeleccion = {
  literal: string;
  etiqueta: string;
  cumple: boolean;
  detalle?: string;
  paso: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function faltaParaOtorgar(hitos: HitosMap): LiteralSeleccion[] {
  const items: LiteralSeleccion[] = [];

  items.push({
    literal: "Art. 80",
    etiqueta: "Evaluación y calificación (B6) cerrada",
    cumple: hecho(hitos, "B6"),
    detalle: hecho(hitos, "B6")
      ? undefined
      : "No se puede otorgar la buena pro sin haber cerrado la evaluación y calificación de ofertas (B6).",
    paso: "B6",
  });

  const b3 = (hitos.B3?.data ?? {}) as Record<string, unknown>;
  const huboConsultasUObservaciones = num(b3.cantidad_consultas) > 0 || num(b3.cantidad_observaciones) > 0;
  if (huboConsultasUObservaciones) {
    items.push({
      literal: "Art. 74",
      etiqueta: "Bases integradas (B4) publicadas",
      cumple: hecho(hitos, "B4"),
      detalle: hecho(hitos, "B4")
        ? undefined
        : "Hubo consultas u observaciones (B3): la Art. 74 exige publicar las bases integradas (B4) antes de otorgar la buena pro.",
      paso: "B4",
    });
  }

  return items.filter((i) => !i.cumple);
}

export function faltaParaConsentir(hitos: HitosMap): LiteralSeleccion[] {
  const items: LiteralSeleccion[] = [
    {
      literal: "Art. 82.1",
      etiqueta: "Otorgamiento de la buena pro (B7) cerrado",
      cumple: hecho(hitos, "B7"),
      detalle: hecho(hitos, "B7")
        ? undefined
        : "El plazo de consentimiento corre desde el otorgamiento (B7): no se puede declarar consentida sin un otorgamiento previo.",
      paso: "B7",
    },
  ];
  return items.filter((i) => !i.cumple);
}
