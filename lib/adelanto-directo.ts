/**
 * Apartado e) del requerimiento: adelanto directo (Art. 137).
 *
 * En bienes y servicios el adelanto directo solo procede en los supuestos
 * tasados del Art. 137, así que muchas contrataciones no lo otorgan. El apartado
 * se resuelve eligiendo UNA opción, nunca dejándolo en blanco:
 *
 *   1. Se otorga — con el detalle (número de adelantos, porcentaje no mayor al
 *      30% en conjunto y plazo para solicitarlos).
 *   2. No corresponde — deja constancia expresa de que no se otorga, en vez de
 *      un vacío que se lee como un olvido.
 *
 * Se guarda en la misma columna de texto que ya existía; el editor compone al
 * escribir y vuelve a leer al abrir, como el resto de cuadros de la ficha.
 */

export type ModalidadAdelanto = "otorga" | "no_corresponde";

export type AdelantoDirecto = {
  modalidad: ModalidadAdelanto | null;
  /** Condiciones del adelanto cuando se otorga (número, porcentaje, plazo). */
  detalle: string;
};

export const TEXTO_NO_CORRESPONDE = "No corresponde.";

/**
 * Estructura del adelanto directo en OBRAS y consultoría de obra (Arts. 178-179).
 *
 * El régimen difiere del de bienes y servicios y por eso tiene su propia
 * plantilla:
 *   - Tope por sistema de entrega: hasta 10% en «solo construcción» y hasta el
 *     30% del componente de diseño en «diseño y construcción» (Art. 178). No es
 *     un 10% plano.
 *   - Plazo de solicitud: diez (10) días desde el perfeccionamiento, adjuntando
 *     la garantía; la entidad entrega en siete (7) días (Art. 179). Este plazo
 *     NO rige en bienes y servicios, donde el Art. 137 no fija ninguno.
 */
export const PLANTILLA_ADELANTO_OBRA =
  "La entidad contratante otorgará adelanto directo por el [PORCENTAJE del monto del contrato " +
  "original: hasta 10% en el sistema «solo construcción»; hasta 30% del componente de diseño en " +
  "«diseño y construcción» (Art. 178)]. El contratista lo solicita dentro de los diez (10) días " +
  "siguientes al perfeccionamiento del contrato, adjuntando el mecanismo de garantía; la entidad lo " +
  "entrega dentro de los siete (7) días de recibida la garantía (Art. 179).";

export function parseAdelantoDirecto(texto: string | null | undefined): AdelantoDirecto {
  const t = (texto ?? "").trim();
  if (!t) return { modalidad: null, detalle: "" };
  if (t === TEXTO_NO_CORRESPONDE) return { modalidad: "no_corresponde", detalle: "" };
  // Cualquier otro texto —incluido el escrito a mano antes de que existiera el
  // cuadro— es el detalle de un adelanto que sí se otorga.
  return { modalidad: "otorga", detalle: t };
}

export function componerAdelantoDirecto(datos: AdelantoDirecto): string {
  if (datos.modalidad === "no_corresponde") return TEXTO_NO_CORRESPONDE;
  if (datos.modalidad === "otorga") return datos.detalle.trim();
  // Sin modalidad elegida no se compone nada: el apartado sigue en blanco.
  return "";
}
