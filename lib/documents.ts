import { OFFICIAL_CORPUS_TYPES } from "./official-corpus";
const allowedDocumentTypes = [
  ...OFFICIAL_CORPUS_TYPES.map(x => x.value),
  "bases_integradas",
  "contrato",
  "expediente",
  "otros",
] as const;

export type DocumentType = (typeof allowedDocumentTypes)[number];

const allowedProcessTypes = [
  "todos",
  "licitacion_publica",
  "concurso_publico",
  "adjudicacion_simplificada",
  "subasta_inversa_electronica",
  "comparacion_precios",
  "contratacion_directa",
  "acuerdo_marco",
  "seleccion_consultores_individuales",
  "procedimiento_especial",
  "otros",
] as const;

export type ProcessType = (typeof allowedProcessTypes)[number];

export function normalizeDocumentType(value: FormDataEntryValue | null): DocumentType {
  if (typeof value !== "string") {
    return "otros";
  }

  return allowedDocumentTypes.includes(value as DocumentType) ? (value as DocumentType) : "otros";
}

export function normalizeProcessType(value: FormDataEntryValue | null): ProcessType | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return allowedProcessTypes.includes(value as ProcessType) ? (value as ProcessType) : "otros";
}

// Tipos normativos que admiten subirse como modificatoria/cambio de una norma
// existente (Ley, Reglamento, Directiva). El resto no ofrece ese enlace.
export function supportsAmendment(documentType: string): boolean {
  return documentType === "ley" || documentType === "reglamento" || documentType === "directiva";
}

// Alcance del process_type segun el tipo documental (regla unica de negocio):
// Ley y Reglamento aplican a todos los procesos; las Opiniones son de alcance
// general (sin proceso); Directivas, Bases y el resto conservan su proceso.
// Version NO lanzante: usada por el pipeline de indexado para que la inferencia
// de IA nunca sobrescriba el alcance de Ley/Reglamento/Opinion.
export function scopeProcessType(
  documentType: string,
  processType: ProcessType | string | null,
): ProcessType | null {
  if (documentType === "ley" || documentType === "reglamento") {
    return "todos";
  }

  if (documentType === "opinion") {
    return null;
  }

  return (processType as ProcessType | null) ?? null;
}

// Version validante: usada por la API de subida. Ademas del alcance, exige que
// Directivas y Bases tengan un proceso especifico (no vacio ni "todos").
export function resolveDocumentProcessType(
  documentType: DocumentType,
  processType: ProcessType | null,
): { processType: ProcessType | null } | { error: string } {
  if (
    (documentType === "directiva" && !processType) ||
    (["bases_integradas", "bases_estandar"].includes(documentType) && (!processType || processType === "todos"))
  ) {
    return { error: "Indica el alcance de la directiva o un proceso específico para las bases." };
  }

  return { processType: scopeProcessType(documentType, processType) };
}

export function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "documento.pdf";
}

export function buildStoragePath(fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}
