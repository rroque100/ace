// Extracción con IA de los datos del requerimiento a partir de las
// Especificaciones Técnicas (EETT) o Términos de Referencia (TDR) en PDF.
// Lee el texto del PDF (con OCR para escaneados) y devuelve los campos de la
// Necesidad para que el usuario los revise y aplique a la ficha.

import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { extractPdfText } from "./pdf-processing";

export type NecesidadExtraccion = {
  // Campos detectados (clave camelCase = api del schema de Necesidad).
  campos: Record<string, string | number>;
  resumen: string | null;
  method: "ai" | "sin_texto";
  // Diagnóstico de la lectura del PDF.
  extractionMethod: string; // "pdf-text" | "openai-ocr" | ...
  pageCount: number;
  textLength: number;
  textPreview: string;
};

const TEXT_LIMIT = 16000;

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asText(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    // Sin dígitos reales (ej. "no aplica") → no es un número.
    if (!/\d/.test(cleaned)) return undefined;
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// Mapea el JSON devuelto por la IA a los campos de la Necesidad. Solo incluye
// campos con valor real (no null/vacío). Puro y testeable.
export function mapExtractedToNecesidad(
  parsed: Record<string, unknown>,
): { campos: Record<string, string | number>; resumen: string | null } {
  const campos: Record<string, string | number> = {};
  const setT = (key: string, v: unknown) => {
    const t = asText(v);
    if (t) campos[key] = t;
  };
  const setN = (key: string, v: unknown) => {
    const n = asNum(v);
    if (n !== undefined) campos[key] = n;
  };

  setT("nombre", parsed.nombre);
  setT("finalidadPublica", parsed.finalidadPublica);
  setT("descripcionDetallada", parsed.descripcionDetallada);
  setN("cantidad", parsed.cantidad);
  setT("unidadMedida", parsed.unidadMedida);
  setN("plazoEjecucion", parsed.plazoEjecucion);
  setT("lugarEntrega", parsed.lugarEntrega);
  setT("alcance", parsed.alcance);
  setT("condicionesEjecucion", parsed.condicionesEjecucion);
  setT("requisitosCalificacion", parsed.requisitosCalificacion);
  setT("equipamientoMinimo", parsed.equipamientoMinimo);
  setT("modalidadPago", parsed.modalidadPago);
  setT("sistemaEntrega", parsed.sistemaEntrega);

  const resumen = asText(parsed.resumen);
  if (resumen) campos.summary = resumen;

  return { campos, resumen };
}

async function analyzeEett(text: string): Promise<Record<string, unknown>> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    input: [
      {
        role: "user",
        content: `Eres un asistente de contrataciones públicas del Perú (Ley N° 32069). Analiza estas ESPECIFICACIONES TÉCNICAS (EETT) o TÉRMINOS DE REFERENCIA (TDR) y extrae los datos del requerimiento del área usuaria.

Devuelve SOLO JSON válido, sin markdown. Usa null si el dato NO aparece en el texto; NO inventes.
{
  "nombre": "denominación / objeto de la contratación, en una línea",
  "finalidadPublica": "finalidad pública que se satisface con la contratación",
  "descripcionDetallada": "descripción y características técnicas del bien o servicio",
  "cantidad": número de unidades requeridas (solo el número) o null,
  "unidadMedida": "unidad de medida (ej: UNIDAD, SERVICIO, MES, GLOBAL)",
  "plazoEjecucion": número de días del plazo de ejecución o entrega (solo el número) o null,
  "lugarEntrega": "lugar de entrega o de prestación del servicio",
  "alcance": "alcance de la contratación",
  "condicionesEjecucion": "condiciones de ejecución o entrega",
  "requisitosCalificacion": "requisitos de calificación del postor",
  "equipamientoMinimo": "equipamiento mínimo (para servicios/obras)",
  "modalidadPago": "forma o modalidad de pago",
  "sistemaEntrega": "sistema de entrega (si aplica)",
  "resumen": "resumen ejecutivo de 2 a 4 líneas del requerimiento"
}

Texto del documento:
${text.slice(0, TEXT_LIMIT)}`,
      },
    ],
    model: legalAnswerModel,
    temperature: 0,
    max_output_tokens: 1300,
  });
  return parseJsonObject(response.output_text);
}

// Lee el PDF de EETT/TDR y devuelve los campos de la Necesidad detectados.
export async function extractNecesidadFromDocumento(file: File): Promise<NecesidadExtraccion> {
  const extracted = await extractPdfText(file, { forceOcr: true });
  const text = (extracted.text ?? "").trim();
  const diag = {
    extractionMethod: extracted.extractionMethod,
    pageCount: extracted.pageCount,
    textLength: text.length,
    textPreview: text.slice(0, 600),
  };
  if (text.length < 50) {
    return { campos: {}, resumen: null, method: "sin_texto", ...diag };
  }
  const parsed = await analyzeEett(text);
  const { campos, resumen } = mapExtractedToNecesidad(parsed);
  return { campos, resumen, method: "ai", ...diag };
}
