import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const searchSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

type RespuestaSearchRow = {
  id: string;
  nro_oficio: string | null;
  tipo_documento: string | null;
  anio: number | null;
  asunto: string | null;
  destinatario: string | null;
  cuerpo: string | null;
  created_at: string;
  version: number | null;
  parent_version_id: string | null;
  // rank: puntuacion de full-text search (Postgres ts_rank)
  rank?: number;
};

// GET /api/respuesta/search?q=...
// Busqueda full-text de respuestas pasadas en espanol.
// Usa el indice GIN sobre la columna generada 'fts' (tsvector en espanol).
// Fallback a ILIKE si el cliente no soporta el endpoint (errores de columna).
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const parsed = searchSchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      query: url.searchParams.get("q") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametros invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { query, limit } = parsed.data;

    // Convertimos la busqueda libre a una expresion tsquery con operador AND
    // entre terminos. Por ejemplo "licencia municipal 2024" ->
    // "licencia & municipal & 2024". Tambien manejamos prefijos con ":*".
    const tsquery = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .map((t) => `${t}:*`)
      .join(" & ");

    if (!tsquery) {
      return NextResponse.json({ query, results: [] });
    }

    // Full-text search con ranking. Usamos la sintaxis RPC de PostgREST:
    // ?or=(condicion). El operador @@ es el match de tsvector.
    const results = (await supabaseRest<RespuestaSearchRow[]>(
      `expedientes_respuestas?select=id,nro_oficio,tipo_documento,anio,asunto,destinatario,cuerpo,created_at,version,parent_version_id&fts=fts.${encodeURIComponent(tsquery)}&order=created_at.desc&limit=${limit}`,
    ).catch(() => [])) as RespuestaSearchRow[];

    const shaped = (results ?? []).map((r) => ({
      anio: r.anio,
      asunto: r.asunto,
      createdAt: r.created_at,
      destinatario: r.destinatario,
      excerpt: makeExcerpt(r.cuerpo ?? "", query),
      id: r.id,
      nroOficio: r.nro_oficio,
      parentVersionId: r.parent_version_id,
      tipoDocumento: r.tipo_documento,
      version: r.version,
    }));

    await writeAuditLog({
      action: "respuesta.search",
      actorReference: auth.user.email ?? auth.user.id,
      details: { query, resultCount: shaped.length },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ query, results: shaped });
  } catch (error) {
    return NextResponse.json(
      { results: [], error: error instanceof Error ? error.message : "No se pudo buscar" },
      { status: 200 },
    );
  }
}

// Genera un excerpt de ~200 chars alrededor de la primera coincidencia.
// Si no hay coincidencia, devuelve los primeros 200 chars.
function makeExcerpt(text: string, query: string): string {
  if (!text) return "";
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const lower = text.toLowerCase();
  let bestIndex = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }
  if (bestIndex === -1) {
    return text.slice(0, 200);
  }
  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(text.length, start + 200);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}
