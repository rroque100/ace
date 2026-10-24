import { canonicalSourceEntity, documentaryDates } from "@/lib/search-document-metadata";
import { extendedLegalFiltersSchema, matchesExtendedFilters, reviewedRegime } from "@/lib/legal-workspace-filters";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { countReferencedPages } from "@/lib/document-pages";
import { corpusTypesForGroup } from "@/lib/official-corpus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NormRow = {
  id: string;
  title: string;
  document_type: string;
  source_entity: string | null;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  norma_articulos: Array<{ count: number }>;
};

type ChunkRow = {
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  pinecone_vector_id: string | null;
};

type SummaryRow = {
  document_id: string;
};

type ConcordanciaRow = {
  source_document_id: string;
};

function typeFilter(category: string | null) {
  if (category && ["normas", "jurisprudencia", "orientacion"].includes(category)) {
    return `&document_type=in.(${corpusTypesForGroup(category).join(",")})`;
  }
  return "";
}

function exactFilter(column: string, value: string | null) {
  return value ? `&${column}=eq.${encodeURIComponent(value)}` : "";
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const params = new URL(request.url).searchParams;
    const category = params.get("category");
    const extra = extendedLegalFiltersSchema.safeParse({ documentTypes: params.get("documentTypes")?.split(",").filter(Boolean), years: params.get("years")?.split(",").filter(Boolean).map(Number), regime: params.get("regime") ?? "", includeUnknownRegime: params.get("includeUnknownRegime") === "true" });
    if (!extra.success) return NextResponse.json({ error: "Filtros inválidos", norms: [] }, { status: 400 });
    const rows = await supabaseRest<NormRow[]>(
      `documents?select=id,title,document_type,source_entity,process_type,status,metadata,created_at,norma_articulos(count)` +
        `&es_institucional=eq.true&status=eq.indexed${extra.data.documentTypes?.length ? "" : typeFilter(category)}` +
        exactFilter("document_type", extra.data.documentTypes?.length ? null : params.get("documentType")) +
        exactFilter("process_type", params.get("processType")) +

        `&order=document_type.asc,created_at.desc&limit=300`,
    );
    const filteredRows = rows.filter(row => (!params.get("sourceEntity") || (canonicalSourceEntity(row.source_entity) ?? "").toLowerCase().includes((canonicalSourceEntity(params.get("sourceEntity")) ?? "").toLowerCase())) && matchesExtendedFilters({ documentType: row.document_type, year: typeof row.metadata?.year === "number" ? row.metadata.year : null, regime: reviewedRegime(row.metadata ?? {}), regimeReviewed: reviewedRegime(row.metadata ?? {}) !== "no_determinado" }, extra.data));
    const documentIds = filteredRows.map((row) => row.id);
    const idFilter = documentIds.length ? `in.(${documentIds.map((id) => `"${id}"`).join(",")})` : "in.(\"\")";
    const [chunks, summaries, concordancias] = await Promise.all([
      supabaseRest<ChunkRow[]>(
        `document_chunks?document_id=${idFilter}&select=document_id,page_start,page_end,pinecone_vector_id&limit=20000`,
      ).catch(() => []),
      supabaseRest<SummaryRow[]>(
        `document_summaries?document_id=${idFilter}&select=document_id&limit=1000`,
      ).catch(() => []),
      supabaseRest<ConcordanciaRow[]>(
        `norma_concordancias?source_document_id=${idFilter}&select=source_document_id&limit=20000`,
      ).catch(() => []),
    ]);
    const chunksByDocument = new Map<string, ChunkRow[]>();
    const summaryIds = new Set(summaries.map((summary) => summary.document_id));
    const concordanceCount = new Map<string, number>();

    for (const chunk of chunks) {
      chunksByDocument.set(chunk.document_id, [...(chunksByDocument.get(chunk.document_id) ?? []), chunk]);
    }

    for (const concordancia of concordancias) {
      concordanceCount.set(
        concordancia.source_document_id,
        (concordanceCount.get(concordancia.source_document_id) ?? 0) + 1,
      );
    }

    const norms = filteredRows
      .map((row) => {
      const metadata = row.metadata ?? {};
      const documentChunks = chunksByDocument.get(row.id) ?? [];
      const pagesDetected = countReferencedPages(documentChunks);
      const vectorsDetected = documentChunks.filter((chunk) => chunk.pinecone_vector_id).length;
      const pineconeVerification = metadata.pinecone;
      const pineconeVerified = Boolean(
        pineconeVerification &&
          typeof pineconeVerification === "object" &&
          (pineconeVerification as Record<string, unknown>).verification &&
          ((pineconeVerification as Record<string, unknown>).verification as Record<string, unknown>).verified === true,
      );
      return {
        id: row.id,
        title: row.title,
        documentType: row.document_type,
        sourceEntity: canonicalSourceEntity(row.source_entity),
        dates: documentaryDates(metadata),
        processType: row.process_type,
        status: row.status,
        regime: typeof metadata.regime === "string" ? metadata.regime : null,
        articleCount: row.norma_articulos?.[0]?.count ?? 0,
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
        concordanceCount: concordanceCount.get(row.id) ?? 0,
        createdAt: row.created_at,
        hasSummary: summaryIds.has(row.id),
        pagesDetected,
        pineconeVerified,
        qualityStatus:
          documentChunks.length > 0 && pagesDetected > 0 && (pineconeVerified || vectorsDetected > 0)
            ? "lista"
            : "revisar",
        vectorCount: vectorsDetected,
      };
    })
      .filter((row) => {
        const year = params.get("year");
        const vigencia = params.get("vigencia")?.toLowerCase();
        const topic = params.get("topic")?.toLowerCase();

        if (!extra.data.years?.length && year && String(row.year ?? "") !== year) return false;
        if (vigencia && !(row.vigencia ?? "").toLowerCase().includes(vigencia)) return false;
        if (topic && !(row.topic ?? "").toLowerCase().includes(topic)) return false;
        return true;
      });

    return NextResponse.json({ norms });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron listar las normas",
        norms: [],
      },
      { status: 500 },
    );
  }
}
