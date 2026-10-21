/**
 * El tope del plazo para subsanar observaciones (Art. 144 del Reglamento).
 *
 * El formato lo dice sin número: «un plazo para subsanar, el cual no debe ser
 * mayor al 30% del plazo del entregable correspondiente, dependiendo de la
 * complejidad o sofisticación de las subsanaciones a realizar».
 *
 * Ese 30% se calcula, no se recuerda: el área usuaria ya registró el plazo de
 * ejecución y hacer la cuenta a mano en cada requerimiento es donde aparecen los
 * plazos que pasan del tope sin que nadie lo note hasta que el contrato está
 * firmado.
 *
 * SOBRE LAS UNIDADES: el plazo de ejecución puede estar en días calendario o
 * hábiles (`plazoEjecucionUnidad`) y el de subsanación es en hábiles. El
 * Reglamento habla de un porcentaje del plazo del entregable sin resolver la
 * conversión, así que el tope se calcula sobre la cifra registrada tal cual. Es
 * lo que hace el formato, y convertir por nuestra cuenta sería inventarse una
 * regla que la norma no da.
 */

/** La proporción que fija el Art. 144. */
export const PROPORCION_SUBSANACION = 0.3;

/**
 * El plazo máximo de subsanación, en días enteros, o `null` si no se puede
 * calcular.
 *
 * Se redondea hacia ABAJO: el tope es un máximo, y redondear hacia arriba lo
 * rebasaría.
 *
 * Devuelve `null` también cuando el 30% no llega a un día completo —plazos de
 * ejecución de tres días o menos—. Ahí un tope de cero bloquearía el campo
 * entero, y quedarse sin registrar el plazo es peor que registrar uno que la
 * norma no sabe expresar en días enteros.
 */
export function topeSubsanacion(plazoEjecucion: number | string | null | undefined): number | null {
  const p = typeof plazoEjecucion === "string" ? Number(plazoEjecucion.trim()) : plazoEjecucion;
  if (p === null || p === undefined || !Number.isFinite(p) || p <= 0) return null;
  const tope = Math.floor(p * PROPORCION_SUBSANACION);
  return tope >= 1 ? tope : null;
}
