import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
const schema = z.object({
  documentId: z.string().uuid(),
  query: z.string().trim().min(2).max(500),
  offset: z.number().int().min(0).max(10000),
  article: z.string().max(50).optional(),
});
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rate = checkRateLimit(
    getRateLimitKey(request, auth.user.id, "document-search-matches"),
    RATE_LIMITS.aiSearch,
  );
  if (!rate.allowed) return rateLimitResponse(rate);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    return NextResponse.json(
      await supabaseRest("rpc/ace_literal_document_matches_v1", {
        method: "POST",
        body: JSON.stringify({
          p_query: parsed.data.query,
          p_id: parsed.data.documentId,
          p_offset: parsed.data.offset,
          p_article: parsed.data.article ?? "",
        }),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron recuperar las coincidencias." },
      { status: 503 },
    );
  }
}
