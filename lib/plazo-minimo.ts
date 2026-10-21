// Plazo mínimo de los requerimientos de provisión continua (Art. 126.2 del
// Reglamento).
//
// El numeral 126.2 es una regla dura y comprobable:
//
//   "Los requerimientos de bienes o servicios rutinarios u operacionales, cuya
//    provisión se realice de manera continua o periódica, no puede ser menor a
//    un año. La entidad contratante puede evaluar la conveniencia de realizar
//    contrataciones hasta por un periodo de tres años, salvo de que se trate
//    del servicio especializado de gestión de instalaciones, servicio de
//    mantenimiento vial o cuando por la naturaleza de la prestación o por leyes
//    especiales se requieran plazos mayores, siempre y cuando se adopten las
//    previsiones presupuestarias necesarias (...)"
//
// Solo aplica a bienes y servicios: las obras y consultorías de obra tienen su
// propio régimen y no se clasifican en rutinario/operacional.

import type { CategoriaSegmentacion } from "./actuaciones-preparatorias";

/** Un año. El 126.2 fija el piso del plazo en esta cifra. */
export const PLAZO_MINIMO_DIAS = 365;
/** Tres años. Por encima, el 126.2 exige un supuesto habilitante. */
export const PLAZO_MAXIMO_ORDINARIO_DIAS = 1095;

export type PlazoMinimoInput = {
  /** Objeto de A3: "bien" | "servicio" | "obra" | "consultoria_obra". */
  objetoContractual?: string | null;
  /** Categoría resultante de la segmentación (A2). */
  categoria?: CategoriaSegmentacion | null;
  /** true si la provisión es continua o periódica (dato de A3). */
  provisionContinua?: boolean;
  /** Plazo de ejecución en días calendario. */
  plazoDias?: number | null;
};

export type PlazoMinimoAviso = {
  nivel: "error" | "aviso";
  mensaje: string;
};

/**
 * Comprueba el plazo contra el Art. 126.2. Devuelve `null` cuando la regla no
 * aplica o cuando faltan datos para evaluarla (no se inventa un incumplimiento
 * por un campo vacío).
 */
export function validarPlazoMinimo(input: PlazoMinimoInput): PlazoMinimoAviso | null {
  // Solo bienes y servicios.
  const objeto = (input.objetoContractual ?? "").trim();
  if (objeto !== "bien" && objeto !== "servicio") return null;

  // Solo rutinarios u operacionales.
  if (input.categoria !== "rutinaria" && input.categoria !== "operacional") return null;

  // Solo si la provisión es continua o periódica.
  if (!input.provisionContinua) return null;

  const plazo = Number(input.plazoDias);
  if (!Number.isFinite(plazo) || plazo <= 0) return null;

  if (plazo < PLAZO_MINIMO_DIAS) {
    return {
      nivel: "error",
      mensaje: `El plazo de ${plazo} días incumple el numeral 126.2 del Reglamento: los requerimientos de bienes o servicios rutinarios u operacionales de provisión continua o periódica no pueden ser menores a un año (${PLAZO_MINIMO_DIAS} días).`,
    };
  }

  if (plazo > PLAZO_MAXIMO_ORDINARIO_DIAS) {
    return {
      nivel: "aviso",
      mensaje: `El plazo de ${plazo} días supera los tres años (${PLAZO_MAXIMO_ORDINARIO_DIAS} días). El numeral 126.2 solo lo permite en gestión de instalaciones, mantenimiento vial, o cuando la naturaleza de la prestación o leyes especiales exijan plazos mayores, adoptando las previsiones presupuestarias necesarias. Sustenta el supuesto en la estrategia.`,
    };
  }

  return null;
}
