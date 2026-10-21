/**
 * Calificaciones del personal clave · EQUIPAMIENTO ESTRATÉGICO (Art. 72.3.b, C.3).
 *
 * No es un cuadro por puesto: es el equipamiento e infraestructura ESTRATÉGICOS
 * de la contratación. Dos textos fijos del formato OECE (Concurso Público de
 * servicios): el requisito —con su hueco— y cómo se acredita.
 */

/**
 * Texto del requisito. Es el hueco del formato: el área usuaria consigna aquí el
 * equipamiento estratégico. «Redactar con IA» lo deja como marcador para que se
 * vea qué hay que escribir, y se sustituye por el equipamiento real.
 */
export const REQUISITO_EQUIPAMIENTO =
  "[CONSIGNAR SOLO EL EQUIPAMIENTO CLASIFICADO COMO ESTRATÉGICO PARA EJECUTAR LA PRESTACIÓN OBJETO DE LA " +
  "CONVOCATORIA, SEGÚN LA ESTRATEGIA DE CONTRATACIÓN, QUE DEBE SER ACREDITADA]";

/**
 * Cómo se acredita el equipamiento estratégico, texto literal del formato. La
 * advertencia va en viñeta: el Word convierte las líneas «- » en bullets.
 */
export const ACREDITACION_EQUIPAMIENTO = [
  "Copia simple de los documentos que sustenten la propiedad, la posesión, el compromiso de compraventa o alquiler, u otro documento que acredite la disponibilidad del equipamiento estratégico requerido para la ejecución del contrato.",
  "",
  "Advertencia:",
  "- En el caso que el postor sea un consorcio los documentos de acreditación de este requisito pueden estar a nombre del consorcio o de uno de sus integrantes.",
].join("\n");
