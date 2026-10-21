/**
 * Propuesta de «servicios similares al objeto convocado» para la experiencia
 * del postor (Art. 72.3.c).
 *
 * A diferencia del monto o del texto de acreditación —que son fijos o exactos y
 * se componen— qué se considera SIMILAR es un juicio abierto: depende del objeto
 * y no tiene una respuesta única. Por eso aquí SÍ se le pide al modelo, en vez de
 * copiar mecánicamente un campo. El resultado es una PROPUESTA que el área
 * usuaria revisa; si no se pide, el apartado conserva su corchete.
 *
 * Este módulo solo arma el prompt y limpia la respuesta —lógica pura y
 * testeable—. La llamada al modelo vive en la ruta.
 */

import { objetoConvocatoria } from "./requisitos-experiencia";

/** El prompt para el modelo, a partir de lo que la necesidad ya registró. */
export function promptServiciosSimilares(args: {
  nombre?: string | null;
  descripcion?: string | null;
  tipoObjeto?: string | null;
}): { system: string; user: string } {
  const palabra = objetoConvocatoria(args.tipoObjeto);
  const system =
    "Eres especialista en contratación pública peruana (Ley N° 32069 y su Reglamento). " +
    `Para el requisito de calificación «Experiencia del postor en la especialidad», propón qué ${palabra} ` +
    "se consideran iguales o similares al objeto convocado, describiendo el TIPO en términos genéricos. " +
    "Responde SOLO con la enumeración, en una frase breve separada por comas o punto y coma. " +
    "Sin preámbulo, sin comillas, sin viñetas y SIN el nombre del proyecto de inversión.";
  const user =
    `Objeto de la contratación: ${(args.nombre ?? "").trim() || "(sin registrar)"}.\n` +
    `Descripción genérica: ${(args.descripcion ?? "").trim() || "(sin registrar)"}.\n` +
    `Propón los ${palabra} similares.`;
  return { system, user };
}

/**
 * Sanea lo que devuelve el modelo para que encaje en la frase «Se consideran …
 * a los siguientes: ___.».
 *
 * Quita comillas y viñetas que el modelo a veces añade, junta las líneas en una
 * sola frase, retira el punto final —lo pone la plantilla— y capa al tope del
 * campo. Vacío devuelve vacío, para que el apartado conserve su corchete.
 */
export function limpiarPropuestaSimilares(texto: string | null | undefined, topeCaracteres = 2000): string {
  // Se procesa línea a línea: el modelo a veces devuelve una lista con viñetas y
  // comillas en cada renglón, y limpiarlas solo en los extremos del bloque
  // dejaría las de en medio. Cada renglón pierde su viñeta y sus comillas, y
  // luego se juntan en una frase.
  const partes = (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, "").replace(/^["'«»]+|["'«»]+$/g, "").trim())
    .filter(Boolean);
  // El punto final se quita ANTES de las comillas envolventes: el modelo escribe
  // «…afines». —comilla y luego punto—, así que hay que retirar el punto para
  // que la comilla quede al final y se pueda limpiar.
  const t = partes
    .join(", ")
    .replace(/\.\s*$/, "")
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .trim();
  return t.length > topeCaracteres ? t.slice(0, topeCaracteres).trim() : t;
}
