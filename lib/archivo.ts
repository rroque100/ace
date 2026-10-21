
// Archivo administrativo municipal: documentos propios de la entidad (resoluciones
// de alcaldia, acuerdos de concejo, ordenanzas, oficios, informes). Es un corpus
// SEPARADO del normativo (Ley 32069/OECE): vive en su propio namespace de Pinecone
// y en tablas propias (archivo_documentos / archivo_chunks).

export const ARCHIVO_DOC_KINDS = [
  "resolucion_alcaldia",
  "resolucion_gerencia",
  "acuerdo_concejo",
  "ordenanza",
  "decreto_alcaldia",
  "oficio",
  "informe",
  "otros",
] as const;

export type ArchivoDocKind = (typeof ARCHIVO_DOC_KINDS)[number];

export const ARCHIVO_DOC_KIND_LABELS: Record<ArchivoDocKind, string> = {
  resolucion_alcaldia: "Resolución de Alcaldía",
  resolucion_gerencia: "Resolución de Gerencia",
  acuerdo_concejo: "Acuerdo de Concejo",
  ordenanza: "Ordenanza",
  decreto_alcaldia: "Decreto de Alcaldía",
  oficio: "Oficio",
  informe: "Informe",
  otros: "Otros",
};

export function archivoDocKindLabel(value?: string | null) {
  if (value && (ARCHIVO_DOC_KINDS as readonly string[]).includes(value)) {
    return ARCHIVO_DOC_KIND_LABELS[value as ArchivoDocKind];
  }
  return "Otros";
}

export type ArchivoStatus = "uploaded" | "processing" | "indexed" | "error";

export type ArchivoDocumento = {
  id: string;
  document_number: string | null;
  fecha: string | null;
  asunto: string | null;
  title: string;
  doc_kind: ArchivoDocKind;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  status: ArchivoStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};


const monthIndex: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizeForMatch(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Detecta el numero del acto administrativo. Para "RESOLUCION DE ALCALDIA
// N°004-2024-MDCH-A" => "004-2024-MDCH-A". Ancla a la palabra del tipo de acto
// para no capturar un numero referenciado en el cuerpo. El titulo (nombre de
// archivo) va al inicio del source, asi que su numero gana.
const actoKeyword = "resoluci[oó]n|acuerdo|ordenanza|decreto|oficio|informe";
const numeroToken = "[0-9]{1,5}\\s*-\\s*[0-9]{4}(?:\\s*-\\s*[A-Za-z0-9.\\/]+)*";

export function extractResolutionNumber(title: string, text: string): string | null {
  const source = `${title}\n${text.slice(0, 4000)}`;

  const anchored = source.match(
    new RegExp(
      `\\b(?:${actoKeyword})[^\\n]{0,80}?n[°ºo.\\s]*\\s*(${numeroToken})`,
      "i",
    ),
  );
  if (anchored?.[1]) {
    return anchored[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "");
  }

  // Fallback: cualquier "N° 004-2024-..." en el encabezado.
  const generic = source.match(new RegExp(`\\bn[°ºo.\\s]*\\s*(${numeroToken})`, "i"));
  return generic?.[1] ? generic[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "") : null;
}

// Detecta la fecha de emision. Reconoce "15 de enero de 2024" (con o sin tildes)
// y formatos numericos dd/mm/yyyy o dd-mm-yyyy. Devuelve ISO (YYYY-MM-DD) o null.
export function extractFecha(text: string): string | null {
  const source = normalizeForMatch(text.slice(0, 6000));

  const textual = source.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+|del\s+)?(\d{4})\b/);
  if (textual) {
    const day = Number.parseInt(textual[1], 10);
    const month = monthIndex[textual[2]];
    const year = Number.parseInt(textual[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const numeric = source.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (numeric) {
    const day = Number.parseInt(numeric[1], 10);
    const month = Number.parseInt(numeric[2], 10);
    const year = Number.parseInt(numeric[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

export function normalizeArchivoDocKind(value: unknown): ArchivoDocKind {
  return typeof value === "string" && (ARCHIVO_DOC_KINDS as readonly string[]).includes(value)
    ? (value as ArchivoDocKind)
    : "otros";
}

export function getArchivoNamespace() {
  return process.env.PINECONE_ARCHIVO_NAMESPACE ?? "archivo-municipal";
}
