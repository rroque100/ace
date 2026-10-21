/**
 * Apartado h) del requerimiento: fórmula de reajuste.
 *
 * Es opcional ("de ser el caso") y el régimen difiere por objeto:
 *   - Bienes, servicios y consultoría en general de ejecución PERIÓDICA O
 *     CONTINUADA: el reajuste sigue la variación del IPC nacional o de Lima
 *     Metropolitana del mes de pago (Art. 136.2).
 *   - Obras y consultoría de obras: se aplican FÓRMULAS POLINÓMICAS —las del
 *     expediente técnico, con los Índices Unificados de Precios de la
 *     Construcción del INEI en obras; monómicas o polinómicas con el IPC en
 *     consultoría de obras— (Art. 209).
 *
 * El apartado se resuelve eligiendo UNA opción, nunca dejándolo en blanco:
 *   1. Se aplica reajuste — con la(s) fórmula(s) y el procedimiento.
 *   2. No corresponde — deja constancia expresa (p. ej. contratos a suma alzada
 *      o sin reajuste previsto), en vez de un vacío que se lee como olvido.
 *
 * Se guarda en la misma columna de texto que ya existía; el editor compone al
 * escribir y vuelve a leer al abrir, como el resto de cuadros de la ficha.
 */

export type ModalidadReajuste = "aplica" | "no_corresponde";

export type FormulaReajuste = {
  modalidad: ModalidadReajuste | null;
  /** Fórmula(s) y procedimiento cuando se aplica. */
  detalle: string;
};

export const TEXTO_NO_CORRESPONDE = "No corresponde.";

/**
 * Estructura del reajuste en OBRAS y consultoría de obra (Art. 209). Difiere del
 * de bienes/servicios (Art. 136.2, IPC), que vive en la plantilla del catálogo.
 */
export const PLANTILLA_REAJUSTE_OBRA =
  "[CONSIGNAR LA(S) FÓRMULA(S) DE REAJUSTE Y EL PROCEDIMIENTO: en obras, las fórmulas polinómicas del " +
  "expediente técnico aprobado, con los Índices Unificados de Precios de la Construcción del INEI; en " +
  "consultoría de obras, las fórmulas monómicas o polinómicas previstas en las bases, con el IPC del " +
  "INEI (Art. 209 del Reglamento)].";

export function parseFormulaReajuste(texto: string | null | undefined): FormulaReajuste {
  const t = (texto ?? "").trim();
  if (!t) return { modalidad: null, detalle: "" };
  if (t === TEXTO_NO_CORRESPONDE) return { modalidad: "no_corresponde", detalle: "" };
  // Cualquier otro texto —incluido el escrito a mano antes del cuadro— es el
  // detalle de un reajuste que sí se aplica.
  return { modalidad: "aplica", detalle: t };
}

export function componerFormulaReajuste(datos: FormulaReajuste): string {
  if (datos.modalidad === "no_corresponde") return TEXTO_NO_CORRESPONDE;
  if (datos.modalidad === "aplica") return datos.detalle.trim();
  // Sin modalidad elegida no se compone nada: el apartado sigue en blanco.
  return "";
}
