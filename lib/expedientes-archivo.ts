
// Biblioteca de Expedientes Archivados: expedientes/documentos terminados de la
// entidad, escaneados (OCR) e indexados en su PROPIO namespace de Pinecone
// (PINECONE_EXPEDIENTES_NAMESPACE), aislado del corpus normativo (Ley 32069) y del
// archivo administrativo. Además del contenido, registra la UBICACIÓN FÍSICA exacta
// del expediente en papel (caja, archivador, color, ambiente). INDEPENDIENTE del
// "expediente de contratación" (módulo contrataciones): otra tratativa y funcionalidad.

// ── Catálogo fijo de ubicación física ──────────────────────────────────────
// Listas predefinidas (selects, no texto libre). Valores por defecto; reemplazar
// por el catálogo real de la municipalidad cuando se entreguen (ver
// docs/MODULO-EXPEDIENTES.md, decisiones tomadas).

export const CONTENEDOR_TIPOS = [
  "folder",
  "archivador",
  "caja",
  "tomo",
  "paquete",
  "estante",
  "otros",
] as const;

export type ContenedorTipo = (typeof CONTENEDOR_TIPOS)[number];

export const CONTENEDOR_TIPO_LABELS: Record<ContenedorTipo, string> = {
  folder: "Folder",
  archivador: "Archivador",
  caja: "Caja",
  tomo: "Tomo",
  paquete: "Paquete",
  estante: "Estante",
  otros: "Otros",
};

// Colores del archivo físico (catálogo fijo). Reemplazar por la paleta real.
export const ARCHIVO_COLORES = [
  "rojo",
  "azul",
  "verde",
  "amarillo",
  "naranja",
  "celeste",
  "negro",
  "blanco",
  "plomo",
  "otros",
] as const;

export type ArchivoColor = (typeof ARCHIVO_COLORES)[number];

// Ambientes/ubicaciones físicas (catálogo fijo). PLACEHOLDER: reemplazar por los
// ambientes reales del archivo de la municipalidad cuando se entreguen.
export const ARCHIVO_AMBIENTES = [
  "Archivo Central",
  "Archivo de Gestión",
  "Archivo Periférico",
  "Depósito",
] as const;

export type ArchivoAmbiente = (typeof ARCHIVO_AMBIENTES)[number];

export function contenedorTipoLabel(value?: string | null) {
  if (value && (CONTENEDOR_TIPOS as readonly string[]).includes(value)) {
    return CONTENEDOR_TIPO_LABELS[value as ContenedorTipo];
  }
  return "Otros";
}

export function normalizeContenedorTipo(value: unknown): ContenedorTipo {
  return typeof value === "string" && (CONTENEDOR_TIPOS as readonly string[]).includes(value)
    ? (value as ContenedorTipo)
    : "otros";
}

// Devuelve el valor solo si pertenece al catálogo fijo; si no, null (no texto libre).
export function normalizeCatalogValue(value: unknown, catalog: readonly string[]): string | null {
  return typeof value === "string" && catalog.includes(value) ? value : null;
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ExpedienteStatus = "uploaded" | "processing" | "indexed" | "error";

export type PersonaTipo = "natural" | "juridica";

// Esquema canónico (single source of truth). Debe coincidir 1:1 con
// app/components/expedientes-archivo/types.ts -> ExpedienteItem.
export type ExpedienteArchivo = {
  id: string;
  // Identificación documental
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  tipo_documento: string | null;
  asunto: string | null;
  materia: string | null;
  resumen: string | null;
  title: string;
  oficina: string | null;
  // Oficina emisora resuelta (FK a expedientes_oficinas), poblada por trigger.
  oficina_id: string | null;
  // Legajo al que pertenece este documento (ver ExpedienteLegajo más abajo).
  // Null solo si el backfill de docs/supabase/expediente-legajo.sql no corrió
  // aún — no debería pasar en producción tras aplicar esa migración.
  expediente_id: string | null;
  // Folio correlativo DENTRO del legajo (1, 2, 3...), lo asigna un trigger al
  // insertar. No confundir con el campo `folio` (nº de páginas del PDF).
  numero_folio: number | null;
  // Almacenamiento físico
  tipo_almacenamiento: ContenedorTipo | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  // Ubicación física exacta
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  folio: string | null;
  observaciones: string | null;
  // Persona interesada
  persona_tipo: PersonaTipo | null;
  persona_documento: string | null;
  persona_nombre: string | null;
  // Archivo digital
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  status: ExpedienteStatus;
  error_message: string | null;
  body_text?: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

// El legajo (expedientes_archivo_legajos): la carpeta física que agrupa uno o
// más documentos. Ver docs/supabase/expediente-legajo.sql para el porqué está
// separado de ExpedienteArchivo (el documento individual).
export type ExpedienteLegajo = {
  id: string;
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  oficina_id: string | null;
  persona_tipo: PersonaTipo | null;
  persona_documento: string | null;
  persona_nombre: string | null;
  tipo_almacenamiento: ContenedorTipo | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  observaciones: string | null;
  documentos_count: number;
  documentos_error_count: number;
  documentos_pending_count: number;
  next_folio: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizePersonaTipo(value: unknown): PersonaTipo | null {
  return value === "natural" || value === "juridica" ? value : null;
}

// ── Extractores deterministas ─────────────────────────────────────────────────

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

// Detecta la fecha de emisión: "15 de enero de 2024" (con/sin tildes) o dd/mm/yyyy.
// Devuelve ISO (YYYY-MM-DD) o null.
//
// El "de" entre el día y el mes es OPCIONAL: la plantilla municipal de
// Challhuahuacho firma "Challhuahuacho,17 setiembre del 2026" (sin "de" ahí,
// solo "del" antes del año), y con el "de" obligatorio la fecha no se
// detectaba nunca en esos documentos.
export function extractFecha(text: string): string | null {
  const source = normalizeForMatch(text.slice(0, 6000));

  const textual = source.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+|del\s+)?(\d{4})\b/);
  if (textual) {
    const day = Number.parseInt(textual[1], 10);
    const month = monthIndex[textual[2]];
    const year = Number.parseInt(textual[3], 10);
    if (month && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const numeric = source.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
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

// Detecta el número de expediente o de documento. Ancla a la palabra clave
// ("expediente", "exp", "oficio", "informe"...) para no capturar un número
// referenciado en el cuerpo. El título (nombre de archivo) va al inicio del
// source, así que su número gana.
const expedienteKeyword =
  "expediente|exp|tr[aá]mite|resoluci[oó]n|acuerdo|ordenanza|decreto|oficio|informe|memorando|carta";
const numeroToken = "[0-9]{1,6}(?:\\s*-\\s*[0-9]{2,4})?(?:\\s*-\\s*[A-Za-z0-9./]+)*";

export function extractExpedienteNumber(title: string, text: string): string | null {
  const source = `${title}\n${text.slice(0, 4000)}`;

  const anchored = source.match(
    new RegExp(`\\b(?:${expedienteKeyword})[^\\n]{0,40}?n[°ºo.\\s]*\\s*(${numeroToken})`, "i"),
  );
  if (anchored?.[1]) {
    return anchored[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "");
  }

  const generic = source.match(new RegExp(`\\bn[°ºo.\\s]*\\s*(${numeroToken})`, "i"));
  return generic?.[1] ? generic[1].replace(/\s+/g, "").replace(/[.,;:]+$/, "") : null;
}

// ── Cabecera oficial municipal ───────────────────────────────────────────────
// Los documentos del archivo llevan SIEMPRE su denominación oficial en la
// cabecera de la primera página: "INFORME N°1555-2026-MDCH/SGEIM-OAD-RTC",
// "MEMORANDO NRO 22-2026-MDCH/OL", "OFICIO MÚLTIPLE N° 012-2024-MDCH-A"...
// De ahí salen la SERIE DOCUMENTAL (literal), el TIPO de documento y el AÑO.

export type SerieDocumentalDetectada = {
  serie: string;
  tipoDocumento: string;
  numero: string;
  anio: number | null;
};

// Mapea el tipo de la cabecera al catálogo del formulario de subida.
const SERIE_TIPO_LABEL: Record<string, string> = {
  CARTA: "Carta",
  DECRETO: "Decreto",
  INFORME: "Informe",
  MEMORANDO: "Memorando",
  MEMORANDUM: "Memorando",
  OFICIO: "Oficio",
  ORDENANZA: "Ordenanza",
  RESOLUCION: "Resolución",
};

// "N°", "Nº", "Nª", "N.", "NRO", "Nro." (variantes reales + ruido de OCR).
// Case-sensitive a propósito: la cabecera va en MAYÚSCULAS; así no captura
// menciones del cuerpo ("mediante informe administrativo...").
//
// El segundo grupo (modificador entre el tipo y "N°") NO estaba pensado para
// resoluciones/decretos: "RESOLUCIÓN DE ALCALDÍA", "RESOLUCIÓN GERENCIAL",
// "DECRETO DE ALCALDÍA" llevan 1-3 palabras variables, no una lista fija como
// los modificadores de OFICIO. Se generaliza a "hasta 5 palabras en
// mayúsculas" (cubre también MÚLTIPLE/CIRCULAR/TÉCNICO/LEGAL sin listarlas).
// El sufijo del código ("-MDCH/GDTI/SGEIM-OAD-RTC") solo puede tener espacios
// HORIZONTALES entre separadores ([ \t], no \s): con \s, un punto final de
// cabecera ("...RTC.") seguido de salto de línea se comía la primera palabra
// de la línea siguiente (el "AL :" del destinatario) porque \s incluye \n.
//
// El `\.?` final (tras el símbolo °/º/ª) cubre "N°." —cabecera real vista en
// Challhuahuacho ("INFORME N°. 0849-2026-...")—: antes el punto solo se
// toleraba ANTES del símbolo de grado, nunca después, así que esa cabecera no
// matcheaba y la serie se colaba desde otra mención del documento (p. ej. la
// de "REF.") en vez de la propia.
const seriePattern = new RegExp(
  "\\b(RESOLUCI[ÓO]N|DECRETO|ORDENANZA|INFORME|MEMOR[ÁA]NDUM|MEMORANDO|OFICIO|CARTA)" +
    "((?:\\s+[A-ZÁÉÍÓÚÑ]{2,}){0,5})" +
    "\\s*N(?:RO|ro)?\\.?\\s*[°ºª]?\\.?\\s*" +
    "(\\d{1,6})\\s*[-–]\\s*(\\d{4})" +
    "((?:[ \\t]*[-/.][ \\t]*[A-ZÑ][A-ZÑ0-9]*(?:[-/.][A-ZÑ0-9]+)*)*)",
);

export function extractSerieDocumental(text: string): SerieDocumentalDetectada | null {
  // Solo el inicio del documento (cabecera de la primera página): el PRIMER
  // match gana; las menciones posteriores (REF., cuerpo) quedan descartadas.
  const source = text.slice(0, 4000);
  const match = seriePattern.exec(source);
  if (!match) {
    return null;
  }

  const [, tipoRaw, , numero, anioRaw] = match;
  const tipoKey = tipoRaw.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const anio = Number.parseInt(anioRaw, 10);

  return {
    // Literal de la cabecera con espacios colapsados y sin puntuación final.
    serie: match[0].replace(/\s+/g, " ").replace(/[\s.,;:]+$/, "").trim(),
    tipoDocumento: SERIE_TIPO_LABEL[tipoKey] ?? "Otro",
    numero,
    anio: Number.isFinite(anio) && anio >= 1950 && anio <= 2100 ? anio : null,
  };
}

// "ASUNTO : ..." de la primera página, hasta el siguiente rótulo de la cabecera
// (-REF., REFERENCIA, FECHA, C.C., ATENCIÓN) o un doble salto de línea.
export function extractAsunto(text: string): string | null {
  const source = text.slice(0, 6000);
  const match = source.match(
    /\bASUNTO\s*[:\-.]{0,2}\s*([\s\S]{4,500}?)(?=\s*(?:[-–]\s*)?(?:REF(?:ERENCIA)?\.?|FECHA|C\.?C\.?|ATENCI[ÓO]N|SE ADJUNTA)\s*[:.]|\n{2,})/,
  );
  if (!match) {
    return null;
  }

  const asunto = match[1].replace(/\s+/g, " ").replace(/[\s:;,.-]+$/, "").trim();
  return asunto.length >= 4 ? asunto : null;
}

// Remitente de la cabecera: rótulo "DE :" o "DEL :" (quien emite/firma).
// Mayúsculas estrictas para no capturar preposiciones del cuerpo.
export function extractRemitente(text: string): string | null {
  const source = text.slice(0, 6000);
  const match = source.match(/\bDEL?\s*:\s*([^\n]{4,160})/);
  if (!match) {
    return null;
  }

  // Si el OCR aplanó los saltos de línea, cortar en el siguiente rótulo.
  const remitente = match[1]
    .split(/\s+(?=(?:ASUNTO|ATENCI[ÓO]N|FECHA|REF\.?|C\.?C\.?)\s*[:.])/)[0]
    .replace(/\s+/g, " ")
    .replace(/[\s:;,]+$/, "")
    .trim();
  return remitente.length >= 4 ? remitente : null;
}

export function getExpedientesNamespace() {
  return process.env.PINECONE_EXPEDIENTES_NAMESPACE ?? "expedientes-archivo";
}
