import { NextResponse } from "next/server";
import { z } from "zod";
import { clasificarSegmentacion, type ObjetoSegmentacion } from "@/lib/actuaciones-preparatorias";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import type { HitosMap } from "@/lib/procurement-fases";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  CAMPOS_SUSTENTO,
  citaNormaLegal,
  type ContextoSustento,
  esCampoSustento,
  promptSustento,
} from "@/lib/sustento-ia";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  campo: z.string().trim().min(1).max(40),
  // El factor o el punto que se sustenta. Viene del cliente porque puede estar
  // en el borrador sin guardar; es texto que el propio usuario escribió.
  detalle: z.string().trim().max(500).optional(),
  // Borrador de partida (la plantilla sugerida o lo ya escrito): la IA lo mejora
  // en vez de empezar de cero. Texto del propio usuario, tratado como dato.
  base: z.string().trim().max(2000).optional(),
});

type ProcesoRow = {
  hitos: HitosMap | null;
  object_type: string | null;
  valor_estimado: number | null;
  amount: number | null;
  nomenclature: string | null;
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * El contexto se arma en el SERVIDOR a partir de lo registrado, no se recibe del
 * cliente: es lo que hace que el borrador hable de este expediente y no de uno
 * inventado, y evita que se pueda inyectar contexto arbitrario en el prompt.
 */
function contextoDe(proceso: ProcesoRow, detalle?: string, base?: string): ContextoSustento {
  const hitos = proceso.hitos ?? {};
  const a2 = (hitos.A2?.data ?? {}) as Record<string, unknown>;
  const a3 = (hitos.A3?.data ?? {}) as Record<string, unknown>;
  const a4 = (hitos.A4?.data ?? {}) as Record<string, unknown>;

  // La categoría solo se afirma si A2 tiene registrado su objeto: deducirla de
  // valores por defecto sería ponerle al borrador una etiqueta que nadie eligió.
  const objetoSeg = texto(a2.objeto) as ObjetoSegmentacion | null;
  const categoria = objetoSeg
    ? clasificarSegmentacion({
        objeto: objetoSeg,
        cuantiaAlta: a2.cuantiaAlta === true,
        condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
        criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
        centralizada: a2.centralizada === true,
      }).categoriaLabel
    : null;

  const plazo = Number(a3.plazo_dias);
  return {
    denominacion: texto(a3.descripcion) ?? texto(proceso.nomenclature),
    objeto: texto(a3.objeto_contractual) ?? texto(proceso.object_type),
    procedimiento: texto(a4.var_a_procedimiento),
    categoria,
    valorEstimado: proceso.valor_estimado ?? proceso.amount ?? null,
    plazoDias: Number.isFinite(plazo) && plazo > 0 ? plazo : null,
    detalle: detalle ?? null,
    base: base ?? null,
  };
}

// POST /api/processes/[id]/sustento → borrador de un texto de sustento de A4.
//
// Devuelve texto para que una persona lo lea y decida. No escribe nada en el
// expediente: aplicarlo es un acto del usuario, no de la IA.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCapability("expediente.manage");
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "sustento-ia"), RATE_LIMITS.aiSearch);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id } = await context.params;
    const malos = idsDeRutaInvalidos(id);
    if (malos) return malos;
    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success || !esCampoSustento(parsed.data.campo)) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    }
    const { campo, detalle, base } = parsed.data;
    if (CAMPOS_SUSTENTO[campo].pideDetalle && !detalle) {
      return NextResponse.json(
        { error: "Escribe primero de qué se trata: sin eso no hay nada que sustentar." },
        { status: 400 },
      );
    }

    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=hitos,object_type,valor_estimado,amount,nomenclature`,
    );
    if (!rows[0]) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [{ content: promptSustento(campo, contextoDe(rows[0], detalle, base)), role: "user" }],
      max_output_tokens: 800,
      model,
      temperature: 0.3,
    });

    const borrador = response.output_text.trim();
    if (!borrador) {
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
      action: "estrategia.sustento_ia",
      actorReference: auth.user.email ?? auth.user.id,
      details: { campo, detalle: detalle?.slice(0, 120), chars: borrador.length, tokenUsage: usage },
      entityId: id,
      entityType: "procurement_process",
    }).catch(() => undefined);

    return NextResponse.json({
      borrador,
      // Se le prohíbe citar normas; si lo hizo igual, que la UI lo avise antes
      // de que acabe en un documento firmado.
      citaNorma: citaNormaLegal(borrador),
      tokenUsage: usage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo redactar el borrador" },
      { status: 500 },
    );
  }
}
