import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  source_entity: string | null;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

type ArticleRow = {
  id: string;
  article_number: string;
  article_label: string | null;
  section_title: string | null;
  ordinal: number;
  content: string;
  page_start: number | null;
  page_end: number | null;
  status: string | null;
  vigencia: string | null;
};

type SummaryRow = {
  content: string;
  metadata: Record<string, unknown>;
};

type ChunkRow = {
  page_start: number | null;
  page_end: number | null;
  pinecone_vector_id: string | null;
};

type ConcordanciaRow = {
  id: string;
  source_article_id: string | null;
  ref_type: string | null;
  ref_document_number: string | null;
  ref_article_number: string | null;
  relation_type: string | null;
  raw_text: string;
  resolved: boolean;
  target_document_id: string | null;
  target_article_id: string | null;
  targetDoc: { id: string; title: string } | null;
  targetArt: { article_number: string } | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id de la norma" }, { status: 400 });
    }

    const [documents, articles, summaries, concordancias, chunks] = await Promise.all([
      supabaseRest<DocumentRow[]>(
        `documents?id=eq.${id}&select=id,title,document_type,source_entity,process_type,status,metadata`,
      ),
      supabaseRest<ArticleRow[]>(
        `norma_articulos?document_id=eq.${id}` +
          `&select=id,article_number,article_label,section_title,ordinal,content,page_start,page_end,status,vigencia` +
          `&order=ordinal.asc&limit=5000`,
      ),
      supabaseRest<SummaryRow[]>(
        `document_summaries?document_id=eq.${id}&select=content,metadata&order=created_at.desc&limit=1`,
      ),
      supabaseRest<ConcordanciaRow[]>(
        `norma_concordancias?source_document_id=eq.${id}` +
          `&select=id,source_article_id,ref_type,ref_document_number,ref_article_number,relation_type,raw_text,resolved,target_document_id,target_article_id,targetDoc:documents!target_document_id(id,title),targetArt:norma_articulos!target_article_id(article_number)`,
      ).catch(() => []),
      supabaseRest<ChunkRow[]>(
        `document_chunks?document_id=eq.${id}&select=page_start,page_end,pinecone_vector_id&limit=20000`,
      ).catch(() => []),
    ]);

    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Norma no encontrada" }, { status: 404 });
    }

    const metadata = document.metadata ?? {};
    const pagesDetected = chunks.filter((chunk) => chunk.page_start || chunk.page_end).length;
    const vectorCount = chunks.filter((chunk) => chunk.pinecone_vector_id).length;
    const pinecone = metadata.pinecone;
    const pineconeVerified = Boolean(
      pinecone &&
        typeof pinecone === "object" &&
        (pinecone as Record<string, unknown>).verification &&
        ((pinecone as Record<string, unknown>).verification as Record<string, unknown>).verified === true,
    );

    const concordanciasByArticle: Record<string, unknown[]> = {};
    for (const row of concordancias) {
      if (!row.source_article_id) {
        continue;
      }
      const list = concordanciasByArticle[row.source_article_id] ?? [];
      list.push({
        id: row.id,
        refType: row.ref_type,
        relationType: row.relation_type ?? "concordancia",
        refDocumentNumber: row.ref_document_number,
        refArticleNumber: row.ref_article_number,
        rawText: row.raw_text,
        resolved: row.resolved,
        targetDocumentId: row.target_document_id,
        targetDocumentTitle: row.targetDoc?.title ?? null,
        targetArticleId: row.target_article_id,
        targetArticleNumber: row.targetArt?.article_number ?? row.ref_article_number,
      });
      concordanciasByArticle[row.source_article_id] = list;
    }

    return NextResponse.json({
      concordanciasByArticle,
      norm: {
        id: document.id,
        title: document.title,
        documentType: document.document_type,
        sourceEntity: document.source_entity,
        processType: document.process_type,
        status: document.status,
        documentNumber:
          typeof metadata.documentNumber === "string"
            ? metadata.documentNumber
            : typeof metadata.number === "string"
              ? metadata.number
              : null,
        vigencia: typeof metadata.vigencia === "string" ? metadata.vigencia : null,
        topic: typeof metadata.topic === "string" ? metadata.topic : null,
        year: typeof metadata.year === "number" ? metadata.year : null,
        amends: typeof metadata.amends === "string" ? metadata.amends : null,
        articleCount: articles.length,
        concordanceCount: concordancias.length,
        hasSummary: Boolean(summaries[0]),
        pagesDetected,
        pineconeVerified,
        qualityStatus:
          articles.length > 0 && pagesDetected > 0 && (pineconeVerified || vectorCount > 0)
            ? "lista"
            : "revisar",
        summary: summaries[0]?.content ?? null,
        vectorCount,
      },
      articles: articles.map((article) => ({
        id: article.id,
        articleNumber: article.article_number,
        label: article.article_label,
        sectionTitle: article.section_title,
        ordinal: article.ordinal,
        content: article.content,
        pageStart: article.page_start,
        pageEnd: article.page_end,
        status: article.status,
        vigencia: article.vigencia,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar la norma",
      },
      { status: 500 },
    );
  }
}
