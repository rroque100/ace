import { canonicalSourceEntity, documentaryDates, documentFamily, normalizedDocumentNumber, normalizedArticle } from "./search-document-metadata";
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
    sourceEntity: canonicalSourceEntity(row.source_entity),
    dates: documentaryDates(row.metadata),
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
  const fullCatalogue = await loadSearchCatalogue();
  const catalogue = fullCatalogue.filter((row) =>
    matchesSearchCatalogue(row, input.filters),
  );
  const byId = new Map(catalogue.map((row) => [row.id, row]));
  let documents: DocumentSearchResult[] = [];
  const warnings: string[] = [];
  if (catalogue.length && input.mode !== "semantic") {
    type Hit = { documentId: string; matchCount: number; titleMatch: boolean; matches: DocumentSearchMatch[] };
    const articleQuery = input.query.match(/^(?:art[ií]culo|art\.?)\s*(\d+(?:\.\d+)*)(?:[.°º])?$/i);
    const query = articleQuery ? (articleQuery[1].length === 1 ? `Artículo ${articleQuery[1]}` : articleQuery[1]) : input.query;
    const article = normalizedArticle(input.filters.article || articleQuery?.[1] || "").split(".")[0];
    const terms = input.mode === "all_words" ? [...new Set(query.trim().split(/\s+/))] : [query];
    if (terms.some(term=>term.length<2)) throw new Error("Cada palabra debe tener al menos dos caracteres en este modo.");
    if (terms.length > 10) throw new Error("Usa hasta diez palabras en este modo o cambia a búsqueda por significado.");
    const lists = await Promise.all(terms.map(term => supabaseRest<Hit[]>("rpc/ace_literal_document_search_v1", {
      method: "POST", body: JSON.stringify({ p_query: term, p_ids: catalogue.map(row => row.id), p_article: article }),
    })));
    const hits: Hit[] = (lists[0] ?? []).filter(hit => lists.every(list => list.some(other => other.documentId === hit.documentId)))
      .map(hit => ({ ...hit, titleMatch: lists.every(list=>list.find(other=>other.documentId===hit.documentId)?.titleMatch), matches: [...new Map(lists.flatMap(list => list.find(other => other.documentId === hit.documentId)?.matches ?? [])
        .map(match => [match.chunkId, match])).values()], matchCount: input.mode === "all_words" ? Math.max(...lists.map(list => list.find(other => other.documentId === hit.documentId)?.matchCount ?? 0)) : hit.matchCount }));
    // Format-tolerant identifier matches supplement title hits; never inspect private documents.
    const identifier = normalizedDocumentNumber(input.query);
    if (/\d/.test(identifier) && !articleQuery && !article) for (const row of catalogue) {
      const number = row.metadata.documentNumber ?? row.metadata.number;
      if (typeof number === "string" && normalizedDocumentNumber(number) === identifier && !hits.some(hit => hit.documentId === row.id))
        hits.push({ documentId: row.id, matchCount: 0, titleMatch: true, matches: [] });
    }
    documents = hits
      .filter((hit) => byId.has(hit.documentId))
      .map((hit) =>
        resultDocument(
          byId.get(hit.documentId)!,
          hit.matches,
          (hit.titleMatch ? 100 : 0) + Math.min(3, Math.log1p(hit.matchCount)) +
            (hit.matches.some(match => match.article && normalizedArticle(match.article) === article) && article ? 30 : 0) +
            (hit.matches.some(match => match.excerpt.trim().toLowerCase().startsWith(query.toLowerCase())) ? 8 : 0),
          hit.matchCount,
          hit.titleMatch,
        ),
      );
    warnings.push(
      input.mode === "all_words" ? "Se exigen todas las palabras en el mismo documento; pueden aparecer en pasajes distintos. Los fragmentos mostrados son una selección, no un conteo de ocurrencias." : "La frase se busca sin distinguir mayúsculas, tildes ni espacios repetidos, sobre títulos y texto indexado. Los archivos sin texto indexado no están incluidos.",
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
      "Este modo muestra documentos recuperados por relevancia; no cuenta todas las coincidencias del catálogo. Ordenar por fecha solo ordena los documentos recuperados; no busca los más recientes de toda la biblioteca. Puedes usar la frase exacta para una búsqueda documental completa del texto indexado.",
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
  for (const document of documents) {
    if (input.mode === "all_words") document.matchCount = document.matches.length;
    const row = byId.get(document.documentId)!;
    const family = documentFamily(row.document_type, row.title, row.metadata);
    document.relatedVersions = fullCatalogue.filter(other => other.id !== row.id && documentFamily(other.document_type, other.title, other.metadata) === family)
      .map(other => ({ documentId: other.id, title: other.title }));
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
    scope: input.mode !== "semantic" ? "catalogue" : "retrieved",
    warnings,
    query: input.query,
    mode: input.mode,
  };
}
