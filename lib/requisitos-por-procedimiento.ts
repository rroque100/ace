// Matriz de requisitos de calificación por procedimiento (Art. 72.4 / Bases Estándar).
//
// El Art. 72.3 del Reglamento fija los CINCO tipos de requisito; el Art. 72.4
// delega en las BASES ESTÁNDAR (R.D. N° 0001-2026-EF/54.01) cuáles son
// OBLIGATORIOS y cuáles FACULTATIVOS según el procedimiento y su objeto. La
// obligatoriedad, por tanto, la manda la norma, no la decide la DEC; los
// facultativos sí son elección de la entidad (y, una vez elegidos e incorporados
// a las bases, se vuelven exigibles en ese proceso).
//
// IMPORTANTE: esa resolución NO está en el corpus del RAG del proyecto (solo la
// Ley 32069 y el Reglamento), así que esta matriz se codifica según la
// especificación de dominio proporcionada, NO verificada verbatim. Vive aislada
// en este módulo para poder ajustarla de un sitio cuando esas bases se carguen.

import { procedimientoGenerico } from "./estrategia-formato";
import {
  labelTipoArt72,
  TIPOS_REQUISITO_ART72,
  type EstadoRequisito,
  type EstadoTipoRequisito,
  type TipoRequisitoArt72,
} from "./requisitos-calificacion";

// La precalificación NO se decide aquí: la marca el catálogo de procesos
// (`tienePrecalificacion` en ./procesos-seleccion, por el flag `precalificacion`
// de cada proceso). El llamador la calcula y la pasa como `precalif`, para que
// esta matriz y el editor usen la misma fuente curada.

/**
 * Estado (obligatorio/facultativo/no) de cada uno de los 5 tipos del Art. 72.3
 * según el procedimiento.
 *
 * - `causal` no vacío ⇒ procedimiento NO competitivo: la DEC incorpora los
 *   requisitos de manera facultativa según el objeto (Art. 101).
 * - La capacidad económica solo aparece si hay precalificación; si no, es "no".
 * - La capacidad legal se marca obligatoria "si la normativa del objeto exige
 *   habilitación": el sistema no puede saberlo, así que la matriz la deja
 *   obligatoria y el texto lo advierte para que la DEC lo confirme.
 */
export function requisitosDeProcedimiento(
  proceso: string | null | undefined,
  causal: string | null | undefined,
  precalif: boolean,
): Record<TipoRequisitoArt72, EstadoRequisito> {
  const base: Record<TipoRequisitoArt72, EstadoRequisito> = {
    capacidad_legal: "facultativo",
    capacidad_tecnica: "facultativo",
    experiencia_postor: "facultativo",
    consorcio: "facultativo",
    capacidad_economica: precalif ? "facultativo" : "no",
  };
  // No competitivo: todo facultativo (la DEC decide según el objeto).
  if ((causal ?? "").trim()) return base;

  switch (procedimientoGenerico(proceso)) {
    // Licitación (bienes y obras): capacidad legal + experiencia del postor.
    case "licitacion_publica":
    case "licitacion_publica_abreviada":
      return { ...base, capacidad_legal: "obligatorio", experiencia_postor: "obligatorio" };
    // Concurso (servicios y consultoría; incluye proyectos arquitectónicos y el
    // abreviado de expertos y gerentes): capacidad técnica + experiencia.
    case "concurso_publico":
    case "concurso_publico_abreviado":
      return { ...base, capacidad_tecnica: "obligatorio", experiencia_postor: "obligatorio" };
    // Comparación de precios: pese a ser simplificado, capacidad legal +
    // experiencia del postor son obligatorios.
    case "comparacion_precios":
      return { ...base, capacidad_legal: "obligatorio", experiencia_postor: "obligatorio" };
    // Subasta inversa electrónica: solo la habilitación (capacidad legal) de la
    // ficha técnica; el resto queda facultativo.
    case "subasta_inversa_electronica":
      return { ...base, capacidad_legal: "obligatorio" };
    // Compra por innovación / precomercial / asociación / sin definir: la spec no
    // fija obligatorios → la DEC decide (facultativos).
    default:
      return base;
  }
}

/**
 * Texto con el que se imprime cada requisito OBLIGATORIO en la variable f) del
 * formato de estrategia: el DETALLE que registró la DEC (para que la previa y el
 * frontend coincidan) más una nota de obligatoriedad, ya que la ley la fija por
 * el procedimiento (Art. 72.4), no la DEC. Sin detalle, se imprime solo el nombre
 * del tipo. La capacidad legal arrastra su condición "(si… exige habilitación)".
 */
export function textoRequisitoObligatorio(tipo: TipoRequisitoArt72, detalle = ""): string {
  const d = detalle.trim();
  const base =
    tipo === "capacidad_legal" && !d
      ? "Capacidad legal (si la normativa del objeto exige habilitación)"
      : d
        ? `${labelTipoArt72(tipo)}: ${d}`
        : labelTipoArt72(tipo);
  return `${base} — Obligatorio por bases estándar (R.D. N° 0001-2026-EF/54.01).`;
}

export type AnalisisRequisitos = {
  /** Requisitos activos como obligatorios (la matriz manda sobre el marcado). */
  obligatorios: number;
  /** Requisitos activos como facultativos. */
  facultativos: number;
  /** Facultativos activos sin sustento (los únicos que la DEC puede excluir). */
  faltaSustento: TipoRequisitoArt72[];
  /**
   * Capacidad económica marcada pese a que el procedimiento no tiene
   * precalificación (Art. 72.3.e): solo aplica en esa etapa.
   */
  economicaSinPrecalificacion: boolean;
};

/**
 * Analiza el reparto de requisitos contra la matriz de bases estándar. Base del
 * resumen del editor y de la validación de calidad del paso. La obligatoriedad la
 * fija la matriz (Art. 72.4), no el marcado manual.
 *
 * NO reporta "falta detalle": la capacidad legal es condicional ("si la normativa
 * exige habilitación; si no, se omite") y el contenido de la capacidad técnica
 * vive en columnas aparte (personal clave), así que un vacío ahí no es un fallo
 * fiable. Solo se afirma lo evidente.
 */
export function analizarRequisitos(
  porTipo: ReadonlyMap<TipoRequisitoArt72, EstadoTipoRequisito>,
  matriz: Record<TipoRequisitoArt72, EstadoRequisito>,
  precalif: boolean,
): AnalisisRequisitos {
  let obligatorios = 0;
  let facultativos = 0;
  const faltaSustento: TipoRequisitoArt72[] = [];
  let economicaSinPrecalificacion = false;
  for (const tipo of TIPOS_REQUISITO_ART72) {
    const e = porTipo.get(tipo.key);
    const estado: EstadoRequisito = matriz[tipo.key] === "obligatorio" ? "obligatorio" : (e?.estado ?? "no");
    if (tipo.key === "capacidad_economica" && !precalif && estado !== "no") economicaSinPrecalificacion = true;
    if (estado === "no") continue;
    if (estado === "obligatorio") obligatorios++;
    else facultativos++;
    if (estado === "facultativo" && !(e?.sustento ?? "").trim()) faltaSustento.push(tipo.key);
  }
  return { obligatorios, facultativos, faltaSustento, economicaSinPrecalificacion };
}

/**
 * Facultativos que el área usuaria propuso y la decisión (DEC) excluye. Es el
 * único cambio de requisitos que exige la no objeción del área usuaria (Guía
 * Cap. III, f) · Art. 44.8): fijar obligatorios o perfeccionar el detalle es
 * potestad de la DEC (Art. 72.1). Un obligatorio de la matriz nunca puede
 * excluirse, así que no entra aquí.
 */
export function facultativosExcluidos(
  propuestaPorTipo: ReadonlyMap<TipoRequisitoArt72, EstadoTipoRequisito> | null | undefined,
  decisionPorTipo: ReadonlyMap<TipoRequisitoArt72, EstadoTipoRequisito>,
  matriz: Record<TipoRequisitoArt72, EstadoRequisito>,
): TipoRequisitoArt72[] {
  if (!propuestaPorTipo) return [];
  const out: TipoRequisitoArt72[] = [];
  for (const tipo of TIPOS_REQUISITO_ART72) {
    if (propuestaPorTipo.get(tipo.key)?.estado !== "facultativo") continue;
    const estadoDec =
      matriz[tipo.key] === "obligatorio" ? "obligatorio" : (decisionPorTipo.get(tipo.key)?.estado ?? "no");
    if (estadoDec === "no") out.push(tipo.key);
  }
  return out;
}
