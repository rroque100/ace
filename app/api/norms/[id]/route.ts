import {activeValidityReview} from "@/lib/validity-review";
import { articleBodyIdentity, checkReferenceDestination } from "@/lib/normative-identity";
import { annotateArticleSections } from "@/lib/normative-library";
import { z } from "zod";
import { documentaryDates, canonicalSourceEntity } from "@/lib/search-document-metadata";
import { reviewedRegime } from "@/lib/legal-workspace-filters";
import { documentReviewSummary } from "@/lib/document-review";
import { loadNormativeRows } from "@/lib/normative-server";
import { NextResponse } from "next/server";
import { countReferencedPages } from "@/lib/document-pages";
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
  metadata?: Record<string,unknown>;
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
  targetDoc: { id: string; title: string; document_type?:string; es_institucional?:boolean; metadata?:Record<string,unknown> } | null;
  targetArt: { id:string; document_id:string; article_number: string } | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Falta id de la norma" }, { status: 400 });
    }

    const warnings: string[] = [];
    const [documents, articles, summaries, concordancias, chunks] = await Promise.all([
      supabaseRest<DocumentRow[]>(
        `documents?id=eq.${id}&es_institucional=eq.true&status=eq.indexed&select=id,title,document_type,source_entity,process_type,status,metadata`,
      ),
      loadNormativeRows<ArticleRow>(
        `norma_articulos?document_id=eq.${id}` +
          `&select=id,article_number,article_label,section_title,ordinal,content,page_start,page_end,status,vigencia,metadata` +
          ``,
      ),
      supabaseRest<SummaryRow[]>(
        `document_summaries?document_id=eq.${id}&select=content,metadata&order=created_at.desc&limit=1`,
      ).catch(() => { warnings.push("No se pudo comprobar el resumen asistido."); return []; }),
      loadNormativeRows<ConcordanciaRow>(
        `norma_concordancias?source_document_id=eq.${id}` +
          `&select=id,source_article_id,ref_type,ref_document_number,ref_article_number,relation_type,raw_text,resolved,target_document_id,target_article_id,targetDoc:documents!target_document_id(id,title,document_type,metadata,es_institucional),targetArt:norma_articulos!target_article_id(id,document_id,article_number)`,
      ).catch(() => { warnings.push("No se pudieron comprobar las referencias relacionadas."); return []; }),
      loadNormativeRows<ChunkRow>(
        `document_chunks?document_id=eq.${id}&select=id,page_start,page_end,pinecone_vector_id`,
      ).catch(() => { warnings.push("No se pudieron comprobar las páginas del documento."); return []; }),
    ]);

    articles.sort((a,b)=>a.ordinal-b.ordinal || a.id.localeCompare(b.id));
    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Norma no encontrada" }, { status: 404 });
    }

    const metadata = document.metadata ?? {};
    const pagesDetected = countReferencedPages(chunks);
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
        destinationCheck:checkReferenceDestination({targetDocumentId:row.target_document_id,targetArticleId:row.target_article_id,refArticleNumber:row.ref_article_number,refDocumentNumber:row.ref_document_number,refType:row.ref_type,sourceDocumentId:id},row.targetDoc?.es_institucional?{documentId:row.targetArt?.document_id??row.targetDoc.id,documentType:row.targetDoc.document_type,articleId:row.targetArt?.id,articleNumber:row.targetArt?.article_number,documentNumber:String(row.targetDoc.metadata?.documentNumber??row.targetDoc.metadata?.number??"")}:null),
        targetDocumentId: row.targetDoc?.es_institucional?row.target_document_id:null,
        targetDocumentTitle: row.targetDoc?.es_institucional?row.targetDoc.title:null,
        targetArticleId: row.targetDoc?.es_institucional?row.target_article_id:null,
        targetArticleNumber: row.targetDoc?.es_institucional?row.targetArt?.article_number??row.ref_article_number:row.ref_article_number,
      });
      concordanciasByArticle[row.source_article_id] = list;
    }

    return NextResponse.json({
      warnings,
      canCorrectReferences:auth.user.isAdmin||auth.user.isEditor||auth.user.isLegal,
      concordanciasByArticle,
      norm: {
        id: document.id,
        title: document.title,
        documentType: document.document_type,
        sourceEntity: canonicalSourceEntity(document.source_entity),
        dates: documentaryDates(metadata),
        review: documentReviewSummary(metadata),
        sourceUrl: typeof metadata.officialPublicationUrl === "string" && /^https:\/\/(?:www\.)?gob\.pe\//.test(metadata.officialPublicationUrl) ? metadata.officialPublicationUrl : null,
        processType: document.process_type,
        status: typeof metadata.status === "string" ? metadata.status : document.status,
        regime: reviewedRegime(metadata),
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
          chunks.length > 0 && pagesDetected > 0 && (pineconeVerified || vectorCount > 0)
            ? "lista"
            : "revisar",
        summary: summaries[0]?.content ?? null,
        vectorCount,
      },
      articles: annotateArticleSections(articles).map((article) => ({
        id: article.id,
        articleNumber: article.article_number,
        validityReview:activeValidityReview(metadata,article.id),
        ...articleBodyIdentity(id,article.metadata),
        bodyRevision:Number(article.metadata?.bodyRevision??0),
        version:documentaryDates(metadata).version,
        label: article.article_label,
        sectionTitle: article.section_title,
        sectionOrigin: article.sectionOrigin,
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
