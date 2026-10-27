import { z } from "zod";
import { loadNormativeRows } from "@/lib/normative-server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CitingRow = {
  id: string;
  source_article_id: string | null;
  raw_text: string;
  sourceDoc: { id: string; title: string } | null;
  sourceArt: { article_number: string } | null;
};

// "Citado por": concordancias entrantes resueltas a este articulo.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Falta id del articulo" }, { status: 400 });
    }

    const rows = await loadNormativeRows<CitingRow>(
      `norma_concordancias?target_article_id=eq.${id}&resolved=eq.true` +
        `&sourceDoc.es_institucional=eq.true&select=id,source_article_id,raw_text,sourceDoc:documents!source_document_id!inner(id,title),sourceArt:norma_articulos!source_article_id(article_number)`,
    );

    return NextResponse.json({
      citing: rows.map((row) => ({
        id: row.id,
        sourceDocumentId: row.sourceDoc?.id ?? null,
        sourceDocumentTitle: row.sourceDoc?.title ?? null,
        sourceArticleId: row.source_article_id,
        sourceArticleNumber: row.sourceArt?.article_number ?? null,
        rawText: row.raw_text,
      })),
    });
  } catch {
    return NextResponse.json(
      {
        citing: [],
        error: "No se pudo comprobar qué documentos citan este artículo.",
      },
      { status: 500 },
    );
  }
}
