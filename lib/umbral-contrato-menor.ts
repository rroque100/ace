/**
 * Umbral del contrato menor y su consecuencia sobre el agrupamiento por ítems.
 *
 * Dos normas encadenadas:
 *
 *   Ley 32069, Art. 34.1 — son contratos menores los de monto "igual o inferior
 *   a ocho Unidades Impositivas Tributarias (UIT), vigentes al momento de la
 *   contratación".
 *
 *   Reglamento, Art. 52.1.b — se puede convocar según relación de ítems, lotes o
 *   tramos "siempre que el valor de cada contratación individual sea SUPERIOR al
 *   de un contrato menor".
 *
 * De ahí sale el detalle que decide los casos límite: un ítem de exactamente
 * 8 UIT ES un contrato menor (art. 34.1 dice "igual o inferior"), así que NO
 * habilita el agrupamiento por ítems. La comparación es estrictamente mayor.
 */

/** Tope del contrato menor, en UIT (Ley 32069, Art. 34.1). */
export const CONTRATO_MENOR_UIT = 8;

/**
 * Umbral en soles, o `null` si no se puede saber.
 *
 * Devolver `null` en vez de un 0 o un valor por defecto es deliberado: sin la
 * UIT del ejercicio registrada en Configuración, la regla NO se puede evaluar, y
 * dar por buena una comparación contra cero dejaría pasar ítems que la norma
 * rechaza. Quien consuma esto debe distinguir "no cumple" de "no se sabe".
 */
export function umbralContratoMenor(uitValor: number | null | undefined): number | null {
  if (typeof uitValor !== "number" || !Number.isFinite(uitValor) || uitValor <= 0) return null;
  return uitValor * CONTRATO_MENOR_UIT;
}

/** Veredicto de un ítem frente al umbral. `null` = falta la UIT para juzgarlo. */
export function superaContratoMenor(
  monto: number | null | undefined,
  uitValor: number | null | undefined,
): boolean | null {
  const umbral = umbralContratoMenor(uitValor);
  if (umbral === null) return null;
  if (typeof monto !== "number" || !Number.isFinite(monto)) return false;
  // Estrictamente mayor: en el umbral exacto todavía es contrato menor.
  return monto > umbral;
}

export type VeredictoAgrupamiento =
  | { estado: "sin_uit" }
  /** Hay ítems pero ninguno tiene importe todavía: no hay nada que comparar. */
  | { estado: "sin_importes" }
  | { estado: "procede" }
  | { estado: "no_procede"; nrosPorDebajo: number[]; umbral: number };

/**
 * ¿Procede agrupar estos ítems según relación de ítems, lotes o tramos?
 *
 * Solo mira el requisito del Art. 52.1.b (cada uno por encima del contrato
 * menor). Lo demás que el artículo exige —que sean "distintos pero vinculados
 * entre sí" y que agrupar resulte más eficiente— es un juicio que sustenta la
 * DEC en la estrategia de contratación (Art. 52.2), no algo que se pueda
 * calcular aquí.
 */
export function evaluarAgrupamientoPorItems(
  items: Array<{ nro: number; costoTotal: number | null }>,
  uitValor: number | null | undefined,
): VeredictoAgrupamiento {
  const umbral = umbralContratoMenor(uitValor);
  if (umbral === null) return { estado: "sin_uit" };

  // Recién importado del SIGA, ningún ítem trae importe: el export del pedido no
  // incluye precios. Decir entonces que "ninguno supera el tope" sería cierto
  // pero engañoso —no incumplen, es que aún no se han valorizado—, y quien lo
  // lee no puede hacer nada al respecto salvo teclear los importes. Se calla
  // hasta que haya AL MENOS UNO: a partir de ahí los vacíos ya son un descuido.
  if (items.length > 0 && items.every((i) => typeof i.costoTotal !== "number")) {
    return { estado: "sin_importes" };
  }

  const nrosPorDebajo = items
    .filter((i) => superaContratoMenor(i.costoTotal, uitValor) !== true)
    .map((i) => i.nro);

  return nrosPorDebajo.length === 0
    ? { estado: "procede" }
    : { estado: "no_procede", nrosPorDebajo, umbral };
}
