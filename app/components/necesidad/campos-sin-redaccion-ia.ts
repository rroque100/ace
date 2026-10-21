import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

// El botón "Redactar con IA" solo aporta en campos de prosa (finalidad,
// alcance, condiciones…). En Identificación y Programación y presupuesto los
// campos son datos factuales (entidad, meta, monto, fechas), así que se omite.
export const CAMPOS_SIN_REDACCION_IA: ReadonlySet<string> = new Set([
  ...FICHA_SECCIONES.filter(
    (s) => s.title === "Identificación" || s.title === "Programación y presupuesto",
  ).flatMap((s) => s.fields.map((f) => f.api)),
  // Estos cuatro son de prosa pero NO se redactan: su contenido tiene una
  // fuente externa que la IA no puede sustituir sin inventarse el dato.
  //
  //  * catálogo (código y descripción): salen del CUBSO/SIGA. Redactarlos sería
  //    describir un bien con palabras que no están en el catálogo, y el Art.
  //    44.6 prohíbe orientar la contratación hacia una marca o fabricante.
  //  * EETT/TDR: las escribe el área usuaria, o llegan del PDF por el traslado
  //    con visto bueno. Ese es el circuito, y tiene control de calidad.
  //  * Lugar de entrega: es un domicilio, no un texto.
  "codigoCatalogo",
  "descripcionCatalogo",
  "descripcionDetallada",
  "lugarEntrega",
]);

// Campos cuyo botón NO llama al modelo: COMPONE el texto del formato con datos ya
// registrados (Art. 67 forma de pago; apartado j) plazo de respuestas). El botón
// se rotula "Redactar del formato" en ellos, para no llamar "IA" a un compositor
// de plantilla —coherente con el principio del producto: los textos legales salen
// del formato/código, no de un modelo—. La lógica vive en `pedirRedactarIA`
// (necesidad-detail.tsx); mantener ambas en sincronía.
//
// `recepcionConformidad` queda FUERA a propósito: compone, pero cae al copiloto
// (IA real) cuando el compositor no cubre el caso, así que "Redactar con IA" no
// miente en él.
export const CAMPOS_COMPOSICION_LOCAL: ReadonlySet<string> = new Set(["formaPago", "plazoRespuestasTexto"]);
