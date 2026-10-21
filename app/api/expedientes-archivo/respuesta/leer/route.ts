import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOpenAIClient, legalAnswerModel } from "@/lib/openai-server";
import { extractResponseText } from "@/lib/openai-response";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { extractPdfPlainText } from "@/lib/pdf-processing";
import { writeAuditLog } from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const analysisLimit = 8000;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Lee el PDF de un documento RECIBIDO por mesa de partes: OCR del texto + una
// extracción ligera del asunto y el remitente para autocompletar el formulario.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "respuesta-leer"), RATE_LIMITS.aiSearch);
    if (!rl.allowed) return rateLimitResponse(rl);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el límite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    let texto = "";
    try {
      // Primero texto seleccionable; OCR solo si no hay texto suficiente.
      const extracted = await extractPdfPlainText(file, { forceOcr: false });
      texto = extracted.text ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `No se pudo leer el PDF (${message}).`, retryable: false },
        { status: 422 },
      );
    }

    if (texto.trim().length < 20) {
      return NextResponse.json(
        { error: "El PDF no contiene texto legible ni con OCR. Verifica el escaneo.", retryable: false },
        { status: 422 },
      );
    }

    // Extracción ligera (asunto + remitente) para autocompletar.
    let asunto: string | null = null;
    let remitente: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const openai = getOpenAIClient();
      const response = await openai.responses.create({
        input: [
          {
            content: `Este es un documento RECIBIDO por mesa de partes de una entidad pública. Devuelve SOLO JSON válido, sin markdown, con estas claves (null si no aparece, NO inventes):
{
  "asunto": "sumilla o asunto del documento en una línea",
  "remitente": "nombre de la persona o entidad que ENVÍA el documento (el administrado/solicitante), o null"
}

Texto:
${texto.slice(0, analysisLimit)}`,
            role: "user",
          },
        ],
        max_output_tokens: 300,
        model: legalAnswerModel,
        temperature: 0,
      });
      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;
      const parsed = parseJsonObject(extractResponseText(response));
      asunto = asText(parsed.asunto);
      remitente = asText(parsed.remitente);
    } catch {
      // No bloqueante: el usuario llena asunto/remitente a mano.
    }

    const tokenUsage = {
      model: legalAnswerModel,
      inputTokens,
      outputTokens,
      estimatedCostUsd: roundCostUsd(estimateCostUsd(legalAnswerModel, inputTokens, outputTokens)),
    };

    await writeAuditLog({
      action: "respuesta.leer",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, chars: texto.length, tokenUsage },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ texto: texto.slice(0, 20000), asunto, remitente, tokenUsage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el PDF" },
      { status: 500 },
    );
  }
}
