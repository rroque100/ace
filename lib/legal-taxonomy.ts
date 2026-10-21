// Fuente unica de verdad para las opciones de tipo documental y tipo de proceso
// usadas en los selectores de Chat, Consultas y Documentos.
// Los `value` deben mantenerse alineados con `allowedDocumentTypes` y
// `allowedProcessTypes` de `lib/documents.ts`.

export type TaxonomyOption = {
  label: string;
  value: string;
};

export const DOCUMENT_TYPES: TaxonomyOption[] = [
  { label: "Ley", value: "ley" },
  { label: "Reglamento", value: "reglamento" },
  { label: "Opinion", value: "opinion" },
  { label: "Directiva", value: "directiva" },
  { label: "Bases integradas", value: "bases_integradas" },
  { label: "Resolucion", value: "resolucion" },
  { label: "Contrato", value: "contrato" },
  { label: "Expediente", value: "expediente" },
  { label: "Otros", value: "otros" },
];

// Tipos documentales que el chat puede usar como fundamento de una respuesta.
export const ANSWERABLE_DOCUMENT_TYPES = ["ley", "reglamento", "opinion", "directiva"];

export const ANSWERABLE_DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.filter((item) =>
  ANSWERABLE_DOCUMENT_TYPES.includes(item.value),
);

export const PROCESS_TYPES: TaxonomyOption[] = [
  { label: "Todos los procesos", value: "todos" },
  { label: "Licitacion publica", value: "licitacion_publica" },
  { label: "Concurso publico", value: "concurso_publico" },
  { label: "Adjudicacion simplificada", value: "adjudicacion_simplificada" },
  { label: "Subasta inversa electronica", value: "subasta_inversa_electronica" },
  { label: "Comparacion de precios", value: "comparacion_precios" },
  { label: "Contratacion directa", value: "contratacion_directa" },
  { label: "Acuerdo marco", value: "acuerdo_marco" },
  { label: "Seleccion de consultores individuales", value: "seleccion_consultores_individuales" },
  { label: "Procedimiento especial", value: "procedimiento_especial" },
  { label: "Otros", value: "otros" },
];

/**
 * Procedimientos de la Ley 32069 (Art. 54 y Reglamento), para etiquetar.
 *
 * PROCESS_TYPES de arriba es la taxonomía de la Ley 30225 y se CONSERVA a
 * propósito: el módulo documental filtra documentos históricos con esos
 * valores. Pero los expedientes nuevos guardan estos códigos —los del select
 * de A4 (`PROCEDIMIENTOS_COMPETITIVOS`) y los del catálogo de Configuración
 * (`process_type_settings`)— y `processTypeLabel` los devolvía null: la
 * cabecera de la variable a) del Formato de Estrategia salía vacía.
 */
const PROCESS_TYPES_LEY_32069: TaxonomyOption[] = [
  // Códigos del select de A4 (lib/estrategia-formato.ts).
  { label: "Licitación pública", value: "licitacion_publica" },
  { label: "Licitación pública abreviada", value: "licitacion_publica_abreviada" },
  { label: "Concurso público", value: "concurso_publico" },
  { label: "Concurso público abreviado", value: "concurso_publico_abreviado" },
  { label: "Compra pública de innovación", value: "compra_publica_innovacion" },
  // Códigos del catálogo de Configuración (process_type_settings).
  { label: "Licitación Pública para Bienes", value: "licitacion_publica_bienes" },
  { label: "Licitación Pública Abreviada para Bienes", value: "licitacion_publica_abreviada_bienes" },
  { label: "Licitación Pública para Obras", value: "licitacion_publica_obras" },
  { label: "Licitación Pública Abreviada para Obras", value: "licitacion_publica_abreviada_obras" },
  { label: "Concurso Público de Servicios", value: "concurso_publico_servicios" },
  { label: "Concurso Público Abreviado de Servicios", value: "concurso_publico_abreviado_servicios" },
  { label: "Concurso Público para Consultorías", value: "concurso_publico_consultoria" },
  { label: "Concurso Público Abreviado para Consultorías", value: "concurso_publico_abreviado_consultoria" },
  { label: "Concurso Público Abreviado para Expertos", value: "concurso_publico_expertos" },
  { label: "Concurso Público para Gerentes de Proyecto", value: "concurso_publico_gerente_proyecto" },
  { label: "Concurso de Proyectos Arquitectónicos", value: "concurso_proyectos_arquitectonicos" },
  { label: "Procedimiento de Selección No Competitivo", value: "procedimiento_no_competitivo" },
  { label: "Contrato Menor", value: "contrato_menor" },
];

// Expedientes (SDD): tipo de objeto, estado y clases de documento de trabajo.
export const OBJECT_TYPES: TaxonomyOption[] = [
  { label: "Bienes", value: "bienes" },
  { label: "Servicios", value: "servicios" },
  { label: "Obras", value: "obras" },
  { label: "Consultoría", value: "consultoria" },
];

// Estados = etapas del ciclo de vida de la contratación (Ley 32069), alineados a
// CICLO_CONTRATACION en lib/contratacion-modulos.ts. "desierto" es salida alterna.
export const PROCESS_STATUSES: TaxonomyOption[] = [
  { label: "Necesidad", value: "necesidad" },
  { label: "Actuaciones preparatorias", value: "actuaciones_preparatorias" },
  { label: "Expediente", value: "expediente" },
  { label: "Aprobación AGA", value: "aprobacion_aga" },
  { label: "Selección", value: "seleccion" },
  { label: "Buena pro", value: "buena_pro" },
  { label: "Desierto", value: "desierto" },
  { label: "Contrato", value: "contrato" },
  { label: "Ejecución", value: "ejecucion" },
  { label: "Conformidad", value: "conformidad" },
  { label: "Liquidación", value: "liquidacion" },
  { label: "Archivo", value: "archivo" },
];

// Estados de una Necesidad (Módulo 1). Fuente canónica del workflow por actor:
// lib/necesidad-workflow.ts (NECESIDAD_ESTADOS). Se replican aquí como opciones
// de taxonomía por compatibilidad.
export const NECESIDAD_STATUSES: TaxonomyOption[] = [
  { label: "Borrador", value: "borrador" },
  { label: "Remitido a la DEC", value: "remitido_dec" },
  { label: "En revisión (DEC)", value: "en_revision_dec" },
  { label: "Observado", value: "observado" },
  { label: "No objeción pendiente", value: "no_objecion_pendiente" },
  { label: "Requerimiento conforme", value: "conforme" },
  { label: "Incorporado al CMN (Derivado)", value: "incorporado_cmn" },
];

// Clases de documento SELECCIONABLES al adjuntar en una Necesidad (Módulo 1).
//
// El TDR y las EE.TT. NO están aquí a propósito: su sitio es el panel EETT/TDR del
// campo 3.4, que sí los indexa al RAG, genera la propuesta con IA y los lista como
// anexo en el Word. En Adjuntos (que solo guarda) serían un archivo muerto que
// desvía del panel correcto. Sus ETIQUETAS sí se conservan más abajo, para que los
// adjuntos antiguos con esos kinds no se muestren como texto crudo.
export const NECESIDAD_DOC_KINDS: TaxonomyOption[] = [
  { label: "Requerimiento firmado", value: "requerimiento" },
  { label: "Expediente técnico", value: "expediente_tecnico" },
  { label: "Memoria descriptiva", value: "memoria_descriptiva" },
  { label: "Informe de necesidad", value: "informe_necesidad" },
  { label: "Otros", value: "otros" },
];

export const PROCESS_DOC_KINDS: TaxonomyOption[] = [
  { label: "Bases", value: "bases" },
  { label: "Bases integradas", value: "bases_integradas" },
  { label: "Oferta de postor", value: "oferta" },
  { label: "Contrato", value: "contrato" },
  { label: "Acta", value: "acta" },
  { label: "Requerimiento", value: "requerimiento" },
  { label: "Términos de referencia", value: "tdr" },
  { label: "Especificaciones técnicas", value: "ee_tt" },
  { label: "Informe", value: "informe" },
  { label: "Carta", value: "carta" },
  { label: "Documento generado", value: "generado" },
  { label: "Otros", value: "otros" },
];

const documentTypeLabels = new Map(DOCUMENT_TYPES.map((item) => [item.value, item.label]));
// La Ley 32069 va DESPUÉS: si un código coincide (p. ej. "licitacion_publica"
// existe en las dos), gana la etiqueta con tildes de la ley vigente.
const processTypeLabels = new Map(
  [...PROCESS_TYPES, ...PROCESS_TYPES_LEY_32069].map((item) => [item.value, item.label]),
);
const objectTypeLabels = new Map(OBJECT_TYPES.map((item) => [item.value, item.label]));
const processStatusLabels = new Map(PROCESS_STATUSES.map((item) => [item.value, item.label]));
const processDocKindLabels = new Map(PROCESS_DOC_KINDS.map((item) => [item.value, item.label]));
const necesidadStatusLabels = new Map(NECESIDAD_STATUSES.map((item) => [item.value, item.label]));
// Las etiquetas incluyen las clases seleccionables MÁS las HEREDADAS (tdr/ee_tt),
// que ya no se ofrecen al adjuntar pero pueden existir en adjuntos antiguos: sin
// esto se mostrarían como "tdr"/"ee_tt" crudo.
const necesidadDocKindLabels = new Map<string, string>([
  ...NECESIDAD_DOC_KINDS.map((item) => [item.value, item.label] as [string, string]),
  ["tdr", "Términos de referencia"],
  ["ee_tt", "Especificaciones técnicas"],
]);

export function necesidadStatusLabel(value?: string | null): string {
  if (!value) return "Sin estado";
  return necesidadStatusLabels.get(value) ?? value;
}

export function necesidadDocKindLabel(value?: string | null): string {
  if (!value) return "Otros";
  return necesidadDocKindLabels.get(value) ?? value;
}

export function objectTypeLabel(value?: string | null): string {
  if (!value) return "Sin objeto";
  return objectTypeLabels.get(value) ?? value;
}

export function processStatusLabel(value?: string | null): string {
  if (!value) return "Sin estado";
  return processStatusLabels.get(value) ?? value;
}

export function processDocKindLabel(value?: string | null): string {
  if (!value) return "Otros";
  return processDocKindLabels.get(value) ?? value;
}

export function documentTypeLabel(value?: string | null): string {
  if (!value) {
    return "Sin tipo";
  }

  return documentTypeLabels.get(value) ?? value;
}

export function processTypeLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return processTypeLabels.get(value) ?? null;
}
