import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { queryChunks, queryChunksTotal, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import {
  type DocumentRecord,
  getSupabaseHeaders,
  getSupabaseServerConfig,
  supabaseRest,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChunkResumen = {
  id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  token_count: number | null;
};

// PostgREST cuenta con `Prefer: count=exact` + `limit=0` y devuelve el total en
// el header `content-range` (formato `*/<total>`). `supabaseRest` no expone
// headers, así que el conteo se hace con un fetch aparte que sí los lee.
async function contarChunks(docId: string): Promise<number> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const res = await fetch(`${supabaseUrl}/rest/v1/${queryChunksTotal(docId)}`, {
    headers: { ...getSupabaseHeaders("count=exact") },
    cache: "no-store",
  });
  const range = res.headers.get("content-range");
  const total = range ? Number(range.split("/").pop()) : NaN;
  return Number.isFinite(total) ? total : 0;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const malos = idsDeRutaInvalidos(docId);
    if (malos) return malos;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const rawLimit = Number(url.searchParams.get("limit") ?? "20") || 20;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const q = url.searchParams.get("q") ?? undefined;

    const [items, total] = await Promise.all([
      supabaseRest<ChunkResumen[]>(queryChunks(docId, { q, page, limit })),
      contarChunks(docId),
    ]);

    return NextResponse.json({ items: items ?? [], total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar los fragmentos" },
      { status: 500 },
    );
  }
}
