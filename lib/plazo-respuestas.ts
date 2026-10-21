/**
 * Redacta el apartado j) PLAZO PARA RESPUESTAS ENTRE LAS PARTES.
 *
 * El texto lo fija el formato del OECE y solo tiene un hueco: el plazo. Se
 * compone en vez de generarse, por el mismo motivo que la forma de pago —es
 * texto reglamentario, no prosa que redactar—.
 *
 * El plazo se guarda en el MISMO campo, así que el botón se puede pulsar dos
 * veces: la segunda vez el valor ya es el texto completo. Por eso se recupera el
 * plazo de dentro antes de recomponer, en vez de anidar el texto dentro de sí
 * mismo.
 */

const HUECO = "CONSIGNAR EL PLAZO EN DÍAS CALENDARIO";
const ENCABEZADO = "PLAZO PARA RESPUESTAS ENTRE LAS PARTES";
const ETIQUETA = "Plazo máximo de respuesta:";

/**
 * El plazo que hay dentro de un valor, ya sea el plazo suelto o un texto ya
 * compuesto.
 *
 * Sin esto, pulsar el botón dos veces metía el apartado entero donde va el
 * número.
 */
export function plazoDe(valor: string | null | undefined): string {
  const v = (valor ?? "").trim();
  if (!v) return "";
  if (!v.includes(ENCABEZADO)) return v;
  const linea = v.split(/\r?\n/).find((l) => l.trim().startsWith(ETIQUETA));
  const dentro = (linea ?? "").slice(linea?.indexOf(ETIQUETA) === -1 ? 0 : ETIQUETA.length).trim();
  // El corchete es el hueco sin rellenar: no es un plazo.
  return dentro.startsWith("[") ? "" : dentro;
}

/** ¿Este valor es ya el apartado compuesto? */
export function estaCompuesto(valor: string | null | undefined): boolean {
  return (valor ?? "").includes(ENCABEZADO);
}

/**
 * El texto del apartado con el plazo dentro.
 *
 * Un plazo vacío conserva el corchete del formato: en un documento que se firma,
 * lo que falta tiene que verse como lo que es.
 *
 * El plazo viene del campo numérico de la ficha; se acepta también un texto ya
 * compuesto para que recomponer sea idempotente.
 */
export function componerPlazoRespuestas(valor: string | null | undefined): string {
  const plazo = plazoDe(valor);
  return [
    ENCABEZADO,
    "",
    "Para los plazos de respuesta de las partes sobre aspectos vinculados con la ejecución contractual " +
      "que no han sido específicamente previstos en el Reglamento, aplica el plazo máximo de respuesta del " +
      "siguiente cuadro:",
    "",
    `${ETIQUETA} ${plazo || `[${HUECO}]`}`,
    "",
    "Antes del vencimiento de este plazo máximo, las partes pueden acordar su prórroga para cada situación " +
      "específica considerando la cláusula de notificaciones del contrato.",
  ].join("\n");
}
