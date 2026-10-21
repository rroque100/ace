/**
 * Calificaciones del personal clave · INFRAESTRUCTURA ESTRATÉGICA (Art. 72.3.b, C.3).
 *
 * Como el equipamiento estratégico: no es un cuadro por puesto, son dos textos
 * fijos del formato OECE (Concurso Público de servicios) —el requisito, con su
 * hueco, y cómo se acredita—.
 */

/**
 * Texto del requisito. Es el hueco del formato: el área usuaria consigna aquí la
 * infraestructura estratégica. «Redactar con IA» lo deja como marcador, y se
 * sustituye por la infraestructura real.
 */
export const REQUISITO_INFRAESTRUCTURA =
  "[CONSIGNAR SOLO LA INFRAESTRUCTURA CLASIFICADA COMO ESTRATÉGICA PARA EJECUTAR LA PRESTACIÓN OBJETO DE LA " +
  "CONVOCATORIA, SEGÚN LA ESTRATEGIA DE CONTRATACIÓN, QUE DEBE SER ACREDITADA]";

/**
 * Cómo se acredita la infraestructura estratégica, texto literal del formato. La
 * advertencia va en viñeta: el Word convierte las líneas «- » en bullets.
 */
export const ACREDITACION_INFRAESTRUCTURA = [
  "Copia simple de los documentos que sustenten la propiedad, la posesión, el compromiso de compraventa o alquiler, u otro documento que acredite la disponibilidad de la infraestructura estratégica requerida para la ejecución del contrato.",
  "",
  "Advertencia:",
  "- En el caso que el postor sea un consorcio los documentos de acreditación de este requisito pueden estar a nombre del consorcio o de uno de sus integrantes.",
].join("\n");
