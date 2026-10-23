import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { documentSearchRequestSchema } from "@/lib/document-search";
import { searchDocuments } from "@/lib/document-search-server";
import { supabaseUserRest } from "@/lib/supabase-server";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rate = checkRateLimit(
    getRateLimitKey(request, auth.user.id, "document-search"),
    RATE_LIMITS.aiSearch,
  );
  if (!rate.allowed) return rateLimitResponse(rate);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "La solicitud no tiene un formato válido." },
      { status: 400 },
    );
  }
  const parsed = documentSearchRequestSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Revisa la consulta y los filtros." },
      { status: 400 },
    );
  if (parsed.data.mode === "semantic" && parsed.data.query.length < 5)
    return NextResponse.json(
      {
        error: "Escribe al menos cinco caracteres para buscar por significado.",
      },
      { status: 400 },
    );
  try {
    const result = await searchDocuments(parsed.data);
    if (parsed.data.page === 1)
      await supabaseUserRest(auth.user.accessToken, "chat_sessions", {
        method: "POST",
        body: JSON.stringify({
          owner_id: auth.user.id,
          title: parsed.data.query.slice(0, 90),
          metadata: {
            kind: "legal_search",
            query: parsed.data.query,
            filters: parsed.data.filters,
            searchMode: parsed.data.mode,
            sort: parsed.data.sort,
            pageSize: parsed.data.pageSize,
          },
        }),
      }).catch(() => {
        result.historyWarning =
          "La búsqueda terminó, pero no se pudo guardar en tu historial.";
      });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo completar la búsqueda documental. Reintenta; no se ha comprobado ausencia de documentos.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
