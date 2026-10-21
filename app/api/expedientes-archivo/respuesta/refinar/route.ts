import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isTipoDocumento, tipoDocumentoLabel } from "@/lib/document-number";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  // Cuerpo actual del borrador (lo que el usuario esta editando).
  cuerpo: z.string().trim().min(20, "No hay borrador que refinar").max(30000),
  // Instruccion de cambio en lenguaje natural ("mas corto", "agrega...", etc.)
  instruccion: z.string().trim().min(3, "Indica el cambio que quieres").max(1000),
  tipoDocumento: z.string().trim().max(40).optional(),
  tone: z.enum(["cercano", "formal", "tecnico"]).optional(),
});

// POST /api/expedientes-archivo/respuesta/refinar
// Refinamiento conversacional del borrador: aplica SOLO el cambio pedido
// y devuelve el cuerpo completo revisado. No re-genera desde cero.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "respuesta-refinar"),
      RATE_LIMITS.aiSearch,
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Solicitud inválida" },
        { status: 400 },
      );
    }
    const { cuerpo, instruccion, tipoDocumento, tone } = parsed.data;
    const tipoLabel = isTipoDocumento(tipoDocumento) ? tipoDocumentoLabel(tipoDocumento) : "documento oficial";

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Eres un redactor experto de documentos administrativos peruanos. Tienes el borrador de un ${tipoLabel} y una instruccion de cambio del usuario.

REGLAS ESTRICTAS:
- Aplica UNICAMENTE el cambio pedido. Conserva intacto todo lo demas: estructura, datos, fechas, numeros, citas legales y hechos.
- NO inventes hechos, normas, fechas ni nombres que no esten en el borrador.
- NO agregues encabezado, numero de documento, fecha, despedida ni firma (nombre/cargo del responsable): eso lo añade el exportador. Tampoco marcadores tipo '[Nombre]' o '[Cargo]'.
- Manten el tono ${tone ?? "formal"} institucional.
- Devuelve SOLO el cuerpo completo revisado del documento, sin comentarios, sin markdown, sin explicaciones.

BORRADOR ACTUAL:
${cuerpo}

CAMBIO PEDIDO POR EL USUARIO:
${instruccion}`,
          role: "user",
        },
      ],
      max_output_tokens: 4000,
      model,
      temperature: 0.2,
    });

    const revisado = response.output_text.trim();
    if (!revisado) {
      return NextResponse.json({ error: "La IA no devolvió texto. Intenta de nuevo." }, { status: 502 });
    }

    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedCostUsd: roundCostUsd(
        estimateCostUsd(model, response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0),
      ),
    };

    await writeAuditLog({
      action: "respuesta.refinar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { instruccion: instruccion.slice(0, 200), chars: revisado.length, tokenUsage: usage },
      entityType: "respuesta",
      module: "expedientes-archivo",
    }).catch(() => undefined);

    return NextResponse.json({ cuerpo: revisado, tokenUsage: usage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo refinar el borrador" },
      { status: 500 },
    );
  }
}
