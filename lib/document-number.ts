// Formato oficial peruano de numeracion de documentos publicos.
//
// Patron comun para los 4 tipos de documento:
//   {TIPO} N° {NNN}-{AAAA}-{ENTIDAD}/{AREA}
//
// Ejemplos:
//   OFICIO      N° 001-2026-MDCH/GM
//   INFORME     N° 0042-2026-MDCH/SG-A
//   CARTA       N° 005-2026-MDCH/OGRD
//   MEMORANDUM  N° 012-2026-MDCH/OAF
//
// Caracteristicas del formato:
//   - {TIPO}      : OFICIO | INFORME | CARTA | MEMORANDUM
//   - {NNN}       : correlativo con padding de ceros a la izquierda (ancho 1-6)
//   - {AAAA}      : anio actual del servidor (4 digitos)
//   - {ENTIDAD}   : codigo de la institucion (1er segmento del sufijo)
//   - {AREA}      : codigo del area (segmentos restantes, opcionales)
//
// El sufijo se descompone SOLO por "/" (entidad / area) y se re-une con "/",
// conservando los "-" internos del area ("JRM-UA-OGA/MDCH" queda igual). Si no
// hay sufijo, el formato se trunca en el anio: OFICIO N° 001-2026
//
// Caracteristicas por tipo (referencia):
//   - OFICIO:     numerado + sello + protocolo formal
//   - INFORME:    numerado, sin sello, secciones I/II/III
//   - CARTA:      numerado, flexible en saludo/despedida
//   - MEMORANDUM: numerado, interno, sin sello

export const TIPOS_DOCUMENTO = [
  "OFICIO",
  "OFICIO MULTIPLE",
  "INFORME",
  "CARTA",
  "MEMORANDUM",
  "MEMORANDUM MULTIPLE",
  "CONTRATO",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

// Etiquetas legibles para la UI (el valor almacenado sigue siendo el codigo).
export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  OFICIO: "Oficio",
  "OFICIO MULTIPLE": "Oficio múltiple",
  INFORME: "Informe",
  CARTA: "Carta",
  MEMORANDUM: "Memorándum simple",
  "MEMORANDUM MULTIPLE": "Memorándum múltiple",
  CONTRATO: "Contrato",
};

export function tipoDocumentoLabel(tipo: string): string {
  return TIPO_DOCUMENTO_LABELS[tipo as TipoDocumento] ?? tipo;
}

// Tipos con los que se siembra una oficina nueva (los mas comunes).
// Cada oficina habilita/deshabilita los suyos en Configuracion → Numeracion.
export const TIPOS_DOCUMENTO_DEFAULT = [
  "OFICIO",
  "INFORME",
  "CARTA",
  "MEMORANDUM",
  "CONTRATO",
] as const;

export function isTipoDocumento(value: unknown): value is TipoDocumento {
  return typeof value === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(value);
}

// Convierte "MDCH/GM" en ["MDCH", "GM"], CONSERVANDO los guiones internos:
// "JRM-UA-OGA/MDCH" -> ["JRM-UA-OGA", "MDCH"]. El "/" separa entidad y área; el
// "-" une sub-segmentos DENTRO del área (p. ej. "UA-OGA") y es parte del código
// que la entidad configuró, así que no se toca. Espacios y segmentos vacíos se
// ignoran. Antes se partía también por "-", lo que colapsaba "JRM-UA-OGA/MDCH"
// en "JRM/UA/OGA/MDCH" y cambiaba el número tal como lo emite la entidad.
export function splitSufijo(sufijo: string | null | undefined): string[] {
  if (!sufijo) return [];
  return sufijo
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Une segmentos con "/". Si no hay segmentos, devuelve string vacio.
function joinSufijo(segments: string[]): string {
  return segments.filter(Boolean).join("/");
}

// Formatea el correlativo con padding de ceros segun el ancho.
// Si el ancho es <1, 0, NaN o null, cae al default 3.
// Si el ancho es >8, se limita a 8.
export function formatCorrelativo(siguiente: number, ancho: number): string {
  const safeAncho = Math.min(
    8,
    Math.max(1, Number.isFinite(ancho) && ancho > 0 ? Math.floor(ancho) : 3),
  );
  const num = Number.isFinite(siguiente) ? Math.max(0, Math.floor(siguiente)) : 0;
  return String(num).padStart(safeAncho, "0");
}

export type FormatDocumentInput = {
  // Numero correlativo (1, 2, 3, ...)
  siguiente: number;
  // Ancho del padding (1-6). Por defecto 3.
  ancho?: number;
  // Sufijo de la oficina: "MDCH/GM", "MDCH-SG-A" o "MDCH". Opcional.
  sufijo?: string | null;
  // Anio. Por defecto el anio actual del servidor.
  year?: number;
  // Tipo de documento (default OFICIO)
  tipo?: TipoDocumento | string;
};

/**
 * Construye el numero oficial de un documento publico peruano.
 * Ej: formatDocumentNumber({ siguiente: 1, ancho: 3, sufijo: "MDCH/GM" })
 *   -> "OFICIO N° 001-2026-MDCH/GM"
 */
export function formatDocumentNumber(input: FormatDocumentInput): string {
  const {
    siguiente,
    ancho = 3,
    sufijo = null,
    year = new Date().getFullYear(),
    tipo = "OFICIO",
  } = input;

  const num = formatCorrelativo(siguiente, ancho);
  const segs = splitSufijo(sufijo);
  const entArea = joinSufijo(segs);

  // {TIPO} N° {NNN}-{AAAA}[-{ENTIDAD}/{AREA}]
  if (entArea) {
    return `${tipo} N° ${num}-${year}-${entArea}`;
  }
  return `${tipo} N° ${num}-${year}`;
}
