import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { documentSearchFiltersSchema } from "@/lib/document-search";
import { proposedSpelling, equivalentReference } from "@/lib/search-discovery";
import { supabaseRest } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
const schema = z.object({ query: z.string().trim().min(2).max(200), filters: documentSearchFiltersSchema.default({}) });
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limit = checkRateLimit(getRateLimitKey(request, auth.user.id, "search-suggestions"), RATE_LIMITS.aiSearch);
  if (!limit.allowed) return rateLimitResponse(limit);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Revisa la consulta." }, { status: 400 });
  try {
    const result = await supabaseRest<{ documents: Array<{ documentId: string; title: string; documentType: string }>; vocabulary: string[] }>("rpc/ace_search_suggestions_v3", {
      method: "POST", body: JSON.stringify({ p_query: equivalentReference(input.data.query), p_filters: input.data.filters }),
    });
    return NextResponse.json({ documents: result.documents, correction: proposedSpelling(input.data.query, result.vocabulary), original: input.data.query }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar las sugerencias. Puedes buscar igualmente." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
