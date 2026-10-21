import { NextResponse } from "next/server";
import { canAccessArchivoRow, getArchivoScopeLevel, getOfficeFilter, requireUser } from "@/lib/auth";
import { expedienteSearchSchema } from "@/lib/expedientes-archivo-schema";
import { searchExpedientes } from "@/lib/expedientes-archivo-search";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
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
      RATE_LIMITS.search,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = expedienteSearchSchema.safeParse(await request.json());
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

    // Scope: admin busca en todo; jefe en su oficina; el resto solo en lo suyo.
    const scope = getArchivoScopeLevel(auth.user);
    const results = await searchExpedientes({
      ...payload.data,
      oficina: scope === "oficina" ? getOfficeFilter(auth.user) ?? payload.data.oficina : payload.data.oficina,
      uploadedBy: scope === "own" ? auth.user.id : undefined,
      accessToken: auth.user.accessToken,
    });

    await writeAuditLog({
      action: "expedientes.search",
      actorReference: auth.user.email ?? auth.user.id,
      details: { query: payload.data.query, anio: payload.data.anio ?? null, hits: results.length },
      entityType: "expediente_search",
      module: "expedientes",
    });

    return NextResponse.json({ query: payload.data.query, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la busqueda" },
      { status: 500 },
    );
  }
}
