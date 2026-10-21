import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchLegalSources, semanticSearchRequestSchema } from "@/lib/legal-chat";
import { institutionalAuditDetails, writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "search"),
      RATE_LIMITS.aiSearch,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = semanticSearchRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await searchLegalSources(payload.data);

    await writeAuditLog({
      action: "search.hybrid",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        ...institutionalAuditDetails({
          conclusion: result.assessment.sufficient ? "fuente_suficiente" : "fuente_insuficiente",
          entity: auth.user.entity,
          processType: payload.data.filters?.processType,
          query: payload.data.query,
          role: auth.user.role,
          sources: result.sources,
          userEmail: auth.user.email,
          userId: auth.user.id,
        }),
        actor: {
          email: auth.user.email,
          entity: auth.user.entity,
          id: auth.user.id,
          role: auth.user.role,
        },
        confidence: result.assessment.confidence,
        evidenceQuality: result.assessment.evidenceQuality,
        evidenceWarnings: result.assessment.evidenceWarnings,
        filters: payload.data.filters ?? null,
        query: payload.data.query,
        queryUsed: result.assessment.queryUsed,
        sourceCount: result.sources.length,
        sufficient: result.assessment.sufficient,
        topScore: result.assessment.topScore,
      },
      entityType: "search",
      module: "busqueda",
      processType: payload.data.filters?.processType ?? null,
      user: {
        email: auth.user.email,
        entity: auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({
      query: payload.data.query,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo ejecutar la busqueda",
      },
      { status: 500 },
    );
  }
}
