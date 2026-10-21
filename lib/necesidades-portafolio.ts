// Portafolio del listado de necesidades (E2): qué estados cuentan y con qué
// umbrales de tiempo se marca una necesidad «por vencer» o «estancada».
//
// FUENTE ÚNICA. Vivía copiada en dos sitios —`app/api/necesidades/route.ts`
// (la LISTA que sale al pulsar el chip) y `app/api/necesidades/facetas/route.ts`
// (el CONTADOR del chip)— con los mismos números y estados a mano. Si uno
// cambiaba, el contador y la lista dejaban de cuadrar. Aquí se definen una vez.

import { NECESIDAD_ESTADOS } from "./necesidad-workflow";

/** Estados «en espera de acción»: los que esperan que alguien mueva la necesidad. */
export const ESTADOS_ESPERA: readonly string[] = NECESIDAD_ESTADOS.filter(
  (e) => e.tono === "progreso" || e.tono === "atencion",
).map((e) => e.value);

/** Estados «activos»: todo lo que aún se tramita (ni derivadas ni anuladas). */
export const ESTADOS_ACTIVOS: readonly string[] = NECESIDAD_ESTADOS.filter(
  (e) => e.value !== "incorporado_cmn" && e.value !== "anulada",
).map((e) => e.value);

/** Fecha requerida dentro de estos días (o pasada) ⇒ «por vencer». */
export const DIAS_POR_VENCER = 15;
/** Sin cambio de estado desde hace estos días ⇒ «estancada». */
export const DIAS_ESTANCADA = 7;

/** Hoy ± `dias`, con aritmética en UTC (idéntica en los dos consumidores). */
function enDias(dias: number, hoy: Date): Date {
  const d = new Date(hoy);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

/**
 * Fecha límite «por vencer» en `YYYY-MM-DD` (hoy + DIAS_POR_VENCER). Se compara
 * contra `fecha_requerida`, que es una fecha sin hora, así que basta el día.
 */
export function fechaLimitePorVencer(hoy: Date = new Date()): string {
  return enDias(DIAS_POR_VENCER, hoy).toISOString().slice(0, 10);
}

/**
 * Instante límite «estancada» (hoy − DIAS_ESTANCADA). Se compara contra
 * `updated_at`, que sí lleva hora: se devuelve el `Date` para que cada
 * consumidor lo formatee como necesite (ISO para el filtro, ms para comparar).
 */
export function fechaLimiteEstancada(hoy: Date = new Date()): Date {
  return enDias(-DIAS_ESTANCADA, hoy);
}
