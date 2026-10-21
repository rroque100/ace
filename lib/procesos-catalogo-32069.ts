import { type ProcessTypeSetting } from "@/lib/configuracion-types";
import { PROCESOS_SELECCION, type ProcesoSeleccion } from "@/lib/procesos-seleccion";

/**
 * Catálogo de procedimientos que una oficina puede gestionar.
 *
 * DERIVADO de `PROCESOS_SELECCION`, no escrito aparte. Antes este fichero
 * llevaba su propia lista de 24 entradas, y esa lista era del régimen DEROGADO:
 * "Adjudicación Simplificada" y "Adjudicación Directa" son vocabulario de la Ley
 * 30225 y no existen en la 32069. Sus citas legales, además, no correspondían a
 * ningún artículo real —decía "Licitación Pública, Art. 22" cuando el Art. 22 son
 * los requisitos para designar al jefe de Perú Compras—, y se contradecía a sí
 * misma poniendo la "Adjudicación Simplificada" hasta 8 UIT, que es exactamente
 * el techo del contrato menor (Art. 34.1).
 *
 * Con una sola fuente, un procedimiento nuevo entra por un sitio y aparece en los
 * dos: en la ficha de la necesidad y en la configuración de la oficina.
 *
 * Lo que la Ley 32069 y su Reglamento establecen de verdad:
 *
 *   Art. 54.1 — los competitivos son DOS: licitación pública (bienes y obras) y
 *               concurso público (servicios). El Art. 54.2 remite al Reglamento
 *               para las modalidades abreviadas y diferenciadas.
 *   Art. 93/94/95 del Reglamento — las TABLAS que enumeran los 20 procedimientos
 *               competitivos con su modalidad y sus condiciones de uso (9 + 6 + 5).
 *   Art. 55   — el procedimiento de selección NO competitivo, con supuestos
 *               tasados. Sustituye a todas las "adjudicaciones directas".
 *   Art. 34.1 — el contrato menor (≤ 8 UIT) NO es un procedimiento de selección
 *               —la propia ley dice que no lo requiere—, por eso no está aquí.
 */

const ETIQUETA_OBJETO: Record<string, string> = {
  bienes: "Bienes",
  consultoria_obra: "Consultoría de obra",
  obras: "Obras",
  servicios: "Servicios",
};

/** Clave estable a partir del nombre: es con lo que se guarda la selección. */
export function codigoProceso(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Etiqueta de la columna «Modalidad» de las tablas de los Arts. 93 y 94. */
const ETIQUETA_MODALIDAD: Record<string, string> = {
  abreviada: "Abreviada",
  diferenciada: "Diferenciada",
  sm: "S/M",
};

/**
 * Artículo que sostiene cada procedimiento. Ya no se deduce del nombre: lo
 * declara el propio catálogo (`articulo`), que copia la cita de la tabla del
 * Reglamento. Antes se inferían con `startsWith("Licitación Pública")` y con la
 * palabra «Abreviada» en el nombre, lo que atribuía a la modalidad abreviada un
 * Art. 54.2 genérico en vez del Art. 93 o 94 que de verdad la establece.
 */
function fundamento(proceso: ProcesoSeleccion): {
  legalBasis: string;
  category: ProcessTypeSetting["category"];
} {
  const modalidad = proceso.modalidad ? ` Modalidad: ${ETIQUETA_MODALIDAD[proceso.modalidad]}.` : "";
  return {
    category: proceso.value === "Procedimiento de Selección No Competitivo" ? "no_competitivo" : "competitivo",
    legalBasis: `${proceso.articulo}${modalidad}`,
  };
}

export const LEY_32069_PROCESOS_CATALOGO: ProcessTypeSetting[] = PROCESOS_SELECCION
  // La primera entrada es el "— Por definir —" del desplegable de la ficha: un
  // marcador de la interfaz, no un procedimiento que una oficina pueda gestionar.
  .filter((p) => p.value !== "")
  .map((p, i) => {
    const { category, legalBasis } = fundamento(p);
    return {
      active: false,
      category,
      code: codigoProceso(p.value),
      // Las condiciones de uso son lo que de verdad decide si una oficina puede
      // convocar por ese procedimiento; van tal como las lista el Reglamento.
      description: p.condiciones,
      frequentMunicipality: false,
      label: p.label,
      legalBasis,
      // Los objetos salen del propio catálogo, que es lo que acota qué campos
      // pide la ficha (Art. 44.10).
      object: p.objetos.map((o) => ETIQUETA_OBJETO[o] ?? o).join(", "),
      sortOrder: i + 1,
    };
  });
