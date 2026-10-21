import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { filtroConsultaDoc, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { searchTextRecords } from "@/lib/pinecone";
import { type DocumentRecord, getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST → recupera fragmentos del propio documento para una consulta de prueba.
// Sirve para verificar que el RAG «sabe» responder sobre ese TDR. topK fijo en 8.
const TOP_K = 8;

export async function POST(
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

    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "Escribe una consulta." }, { status: 400 });
    }

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const hits = await searchTextRecords(query, TOP_K, filtroConsultaDoc(docId));
    const resultados = hits.map((h) => {
      const md = (h as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      const content = String((h as Record<string, unknown>).content ?? md?.content ?? "");
      return {
        chunk_index: Number((h as Record<string, unknown>).chunk_index ?? md?.chunk_index ?? -1),
        page_start: (() => {
          const v = (h as Record<string, unknown>).page_start ?? md?.page_start;
          return v === undefined ? null : Number(v);
        })(),
        score: Number((h as Record<string, unknown>)._score ?? 0),
        extracto: content.slice(0, 320),
      };
    });

    return NextResponse.json({ resultados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo consultar el RAG" },
      { status: 500 },
    );
  }
}
