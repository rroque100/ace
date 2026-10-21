import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { orchestrateProcurementQuery, orchestratorRequestSchema } from "@/lib/agent-orchestrator";
import { institutionalAuditDetails, writeAuditLog } from "@/lib/supabase-server";
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
      getRateLimitKey(request, auth.user.id, "orchestrate"),
      RATE_LIMITS.chat,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = orchestratorRequestSchema.safeParse(await request.json().catch(() => ({})));

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await orchestrateProcurementQuery(payload.data);

    await writeAuditLog({
      action: "agent.orchestrate",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        ...institutionalAuditDetails({
          conclusion: result.rules?.conclusion ?? (result.critical.ok ? "fuentes_criticas_ok" : "fuentes_criticas_faltantes"),
          entity: auth.user.entity,
          processId: payload.data.processId || null,
          processType: result.inferredContext.procedureType || null,
          query: payload.data.query,
          role: auth.user.role,
          sources: result.legal?.sources ?? [],
          userEmail: auth.user.email,
          userId: auth.user.id,
        }),
        actor: {
          email: auth.user.email,
          entity: auth.user.entity,
          id: auth.user.id,
          role: auth.user.role,
        },
        agents: result.plan.agents,
        critical: result.critical,
        conclusion: result.rules?.conclusion ?? null,
        intent: result.plan.intent,
        procedureType: result.rules?.procedureType ?? result.inferredContext.procedureType,
        processId: payload.data.processId || null,
        query: payload.data.query,
        sourceArticles: result.legal?.sources.slice(0, 6).map((source) => ({
          article: source.article,
          documentTitle: source.documentTitle,
          documentType: source.documentType,
          pageStart: source.pageStart,
          processType: source.processType,
        })),
        sourceCount: result.legal?.sources.length ?? 0,
      },
      entityType: "agent_orchestrator",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo ejecutar el orquestador",
      },
      { status: 500 },
    );
  }
}
