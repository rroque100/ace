import { NextResponse } from "next/server";
import { canAccessArchivoRow, getArchivoScopeLevel, getOfficeFilter, requireUser } from "@/lib/auth";
import { expedienteChatSchema } from "@/lib/expedientes-archivo-schema";
import { answerExpedienteQuestion } from "@/lib/expedientes-archivo-search";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "chat"),
      RATE_LIMITS.chat,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = expedienteChatSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    if (payload.data.documentId) {
      const [row] = await supabaseRest<Array<{ oficina: string | null; oficina_id: string | null; uploaded_by: string | null }>>(`expedientes_archivo?id=eq.${payload.data.documentId}&select=oficina,oficina_id,uploaded_by`);
      if (!row || !canAccessArchivoRow(auth.user, { oficina: row.oficina, oficinaId: row.oficina_id, owner: row.uploaded_by })) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    }

    // Scope: admin consulta todo; jefe su oficina; el resto solo lo que subió.
    const scope = getArchivoScopeLevel(auth.user);
    const result = await answerExpedienteQuestion({
      ...payload.data,
      oficina: scope === "oficina" ? getOfficeFilter(auth.user) ?? undefined : payload.data.oficina,
      uploadedBy: scope === "own" ? auth.user.id : undefined,
      accessToken: auth.user.accessToken,
    });

    const usage = result.usage;
    await writeAuditLog({
      action: "expedientes.chat",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        query: payload.data.query,
        sufficient: result.sufficient,
        sources: result.sources.length,
        tokenUsage: usage
          ? {
              ...usage,
              estimatedCostUsd: roundCostUsd(
                estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
              ),
            }
          : null,
      },
      entityType: "expediente_chat",
      module: "expedientes",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo responder la consulta" },
      { status: 500 },
    );
  }
}
