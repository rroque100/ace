import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { extractPdfText } from "@/lib/pdf-processing";
import { getOpenAIClient, legalAnswerModel } from "@/lib/openai-server";
import { extractResponseText } from "@/lib/openai-response";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ANALYSIS_LIMIT = 12000;
const SUMMARY_MAX_TOKENS = 700;
const TIMEOUT_MS = 12000;

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

// POST /api/expedientes-archivo/respuesta/analizar
// Body: FormData con `file` (PDF) y opcional `antecedenteId` (si ya esta persistido).
// Devuelve un resumen tecnico del documento: tipo, materia, partes, normativa
// identificada, puntos clave y consultas sugeridas para la biblioteca.
//
// Estrategia de bajo costo:
// 1) extractPdfText() — local, gratis
// 2) GPT-4.1-mini con max_output_tokens=700 + timeout 12s
// 3) Devuelve SOLO el resumen, NO el texto completo (ahorra 10k+ tokens downstream)
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "respuesta-analizar"),
      RATE_LIMITS.aiSearch,
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json(
        { error: `El PDF supera el límite de ${maxPdfSizeLabel}` },
        { status: 400 },
      );
    }

    // 1) Extraccion local (sin tokens)
    let text = "";
    let pageCount: number | null = null;
    let extractionMethod = "pdf-text";
    try {
      const extracted = await extractPdfText(file, { forceOcr: false });
      text = extracted.text ?? "";
      pageCount = extracted.pageCount;
      extractionMethod = extracted.extractionMethod;
    } catch (err) {
      return NextResponse.json(
        {
          error: `No se pudo leer el PDF: ${err instanceof Error ? err.message : String(err)}`,
        },
        { status: 422 },
      );
    }

    if (text.trim().length < 50) {
      return NextResponse.json(
        { error: "El PDF no tiene texto legible. Verifica el escaneo." },
        { status: 422 },
      );
    }

    // 2) Resumen tecnico con IA (1 sola llamada, max 700 tokens de salida)
    let inputTokens = 0;
    let outputTokens = 0;
    let analysis: Record<string, unknown> = {};
    try {
      const openai = getOpenAIClient();
      const response = await Promise.race([
        openai.responses.create({
          input: [
            {
              content: `Analiza este documento administrativo/legislativo/judicial de una entidad publica peruana. Devuelve SOLO JSON valido, sin markdown, con estas claves (cada texto en espanol, maximo 2-3 frases por campo):

{
  "tipoDocumento": "tipo exacto: solicitud, oficio, informe, recurso, queja, memorial, contrato, resolucion, otro, etc.",
  "materia": "asunto o materia principal del documento (ej: solicitud de licencia de funcionamiento, recurso de reconsideracion, queja administrativa, etc.)",
  "partes": "quienes son las partes involucradas (administrado, empresa, entidad publica, etc.)",
  "puntosClave": "los 2-4 puntos mas importantes que el funcionario debe responder (resumen ejecutivo)",
  "normativaIdentificada": "las normas que el documento menciona o aplica directamente (ej: 'Ley 32069 art. 55, TUPA item 4.2')",
  "consultasSugeridas": ["consulta 1 para buscar en la biblioteca de normas", "consulta 2", "consulta 3"],
  "tipoRespuestaEsperada": "OFICIO, INFORME, CARTA, MEMORANDUM, RESOLUCION, otro"
}

Texto del documento:
${text.slice(0, ANALYSIS_LIMIT)}`,
              role: "user",
            },
          ],
          max_output_tokens: SUMMARY_MAX_TOKENS,
          model: legalAnswerModel,
          temperature: 0.1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Analisis IA timeout")), TIMEOUT_MS),
        ),
      ]);
      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;
      // Acepta output_text (legacy) o output[0].content[0].text (nuevo formato).
      analysis = parseJsonObject(extractResponseText(response));
    } catch (err) {
      console.warn(`[respuesta.analizar] IA fallo: ${err instanceof Error ? err.message : String(err)}`);
      // Continua sin resumen tecnico. El cliente recibe un fallback.
    }

    const fallback = (key: string, fallback: string) =>
      typeof analysis[key] === "string" && (analysis[key] as string).trim()
        ? (analysis[key] as string).trim()
        : fallback;

    const result = {
      consultasSugeridas: Array.isArray(analysis.consultasSugeridas)
        ? (analysis.consultasSugeridas as unknown[]).filter((x) => typeof x === "string" && (x as string).trim())
        : [],
      extractionMethod,
      pageCount,
      puntosClave: fallback("puntosClave", "No se pudo extraer el resumen tecnico automaticamente."),
      materia: fallback("materia", ""),
      normativaIdentificada: fallback("normativaIdentificada", ""),
      partes: fallback("partes", ""),
      resumenCorto: fallback("puntosClave", ""), // alias para UI
      textLength: text.length,
      tipoDocumento: fallback("tipoDocumento", "desconocido"),
      tipoRespuestaEsperada: fallback("tipoRespuestaEsperada", "OFICIO"),
      tokenUsage: {
        estimatedCostUsd: roundCostUsd(estimateCostUsd(legalAnswerModel, inputTokens, outputTokens)),
        inputTokens,
        model: legalAnswerModel,
        outputTokens,
      },
    };

    await writeAuditLog({
      action: "respuesta.analizar",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        pageCount,
        textLength: text.length,
        tokenUsage: result.tokenUsage,
        tipoDocumento: result.tipoDocumento,
      },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el PDF" },
      { status: 500 },
    );
  }
}
