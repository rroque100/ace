import { supabaseRest } from "./supabase-server";
import { CORPUS_ANSWER_TYPES } from "./official-corpus";
import { legalValidity } from "./legal-center";
import {
  classifySearchDocument,
  compareSearchDocuments,
  documentPublication,
  matchesSearchCatalogue,
  type DocumentSearchInput,
  type DocumentSearchMatch,
  type DocumentSearchResponse,
  type DocumentSearchResult,
  type SearchCatalogueRow,
} from "./document-search";

export async function loadSearchCatalogue(): Promise<SearchCatalogueRow[]> {
  const rows: SearchCatalogueRow[] = [];
  for (let offset = 0; offset <= 2000; offset += 500) {
    const page = await supabaseRest<SearchCatalogueRow[]>(
      `documents?es_institucional=eq.true&status=eq.indexed&document_type=in.(${CORPUS_ANSWER_TYPES.join(",")})&select=id,title,document_type,source_entity,process_type,metadata&order=id&offset=${offset}&limit=500`,
    );
    rows.push(...page);
    if (rows.length > 2000)
      throw new Error(
        "El catálogo supera el límite de esta consulta. No se calculó un total parcial; requiere ampliar el índice de catálogo.",
      );
    if (page.length < 500) return rows;
  }
  throw new Error("No se pudo completar el catálogo documental.");
}
function resultDocument(
  row: SearchCatalogueRow,
  matches: DocumentSearchMatch[],
  rank: number,
  matchCount = matches.length,
  titleMatch = false,
): DocumentSearchResult {
  const publication = documentPublication(row);
  return {
    documentId: row.id,
    title: row.title,
    documentType: row.document_type,
    sourceEntity: row.source_entity,
    publication: publication.label,
    dateTime: publication.time,
    rank,
    matches,
    matchCount,
    titleMatch,
    classification: classifySearchDocument(row),
    validity: legalValidity(
      typeof row.metadata.vigencia === "string" ? row.metadata.vigencia : null,
      typeof row.metadata.status === "string" ? row.metadata.status : null,
    ),
  };
}
export async function searchDocuments(
  input: DocumentSearchInput,
): Promise<DocumentSearchResponse> {
  const catalogue = (await loadSearchCatalogue()).filter((row) =>
    matchesSearchCatalogue(row, input.filters),
  );
  const byId = new Map(catalogue.map((row) => [row.id, row]));
  let documents: DocumentSearchResult[] = [];
  const warnings: string[] = [];
  if (catalogue.length && input.mode === "literal") {
    const hits = await supabaseRest<
      Array<{
        documentId: string;
        matchCount: number;
        titleMatch: boolean;
        matches: DocumentSearchMatch[];
      }>
    >("rpc/ace_literal_document_search_v1", {
      method: "POST",
      body: JSON.stringify({
        p_query: input.query,
        p_ids: catalogue.map((row) => row.id),
        p_article: input.filters.article ?? "",
      }),
    });
    documents = hits
      .filter((hit) => byId.has(hit.documentId))
      .map((hit) =>
        resultDocument(
          byId.get(hit.documentId)!,
          hit.matches,
          (hit.titleMatch ? 100 : 0) + Math.log1p(hit.matchCount),
          hit.matchCount,
          hit.titleMatch,
        ),
      );
    warnings.push(
      "La frase se busca sin distinguir mayúsculas, tildes ni espacios repetidos, sobre títulos y texto indexado. Los archivos sin texto indexado no están incluidos.",
    );
  } else if (catalogue.length) {
    const { searchLegalSources } = await import("./legal-chat");
    const result = await searchLegalSources(
      { query: input.query, topK: 20, filters: input.filters },
      {
        diversifyDocuments: true,
        allowedDocumentIds: catalogue.map((row) => row.id),
      },
    );
    const groups = new Map<string, typeof result.sources>();
    for (const source of result.sources)
      if (byId.has(source.documentId))
        groups.set(source.documentId, [
          ...(groups.get(source.documentId) ?? []),
          source,
        ]);
    documents = [...groups].map(([id, sources]) =>
      resultDocument(
        byId.get(id)!,
        sources.map((source) => ({
          chunkId: source.chunkId,
          excerpt: source.excerpt,
          pageStart: source.pageStart,
          pageEnd: source.pageEnd,
          article: source.article,
          score: source.score,
        })),
        Math.max(...sources.map((source) => source.score)),
      ),
    );
    warnings.push(
      "Este modo muestra documentos recuperados por relevancia; no cuenta todas las coincidencias del catálogo. Puedes usar la frase exacta para una búsqueda documental completa del texto indexado.",
    );
    if (result.semanticaCaida)
      warnings.push(
        "La búsqueda por significado no estuvo disponible: se utilizó el respaldo por palabras. No interpretes esta lista como cobertura completa.",
      );
    if (
      input.filters.object ||
      input.filters.subject ||
      input.filters.guidedTopic
    )
      warnings.push(
        "La clasificación se aplica a los candidatos recuperados. Una lista vacía no demuestra ausencia en el catálogo.",
      );
  }
  documents.sort((a, b) => compareSearchDocuments(a, b, input.sort));
  const totalDocuments = documents.length;
  const pages = Math.ceil(totalDocuments / input.pageSize);
  const page = Math.min(input.page, Math.max(1, pages));
  return {
    documents: documents.slice(
      (page - 1) * input.pageSize,
      page * input.pageSize,
    ),
    totalDocuments,
    page,
    pageSize: input.pageSize,
    pages,
    scope: input.mode === "literal" ? "catalogue" : "retrieved",
    warnings,
    query: input.query,
    mode: input.mode,
  };
}
