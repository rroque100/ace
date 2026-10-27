import {activeValidityReview,reviewedValidity} from "./validity-review";
import { equivalentReference, lexicalTopic, fuseSearchDocuments } from "./search-discovery";
import { normalizeLiteralSearch } from "./document-search-query";
import { missingSearchIndex } from "./document-search-index";
import { canonicalSourceEntity, documentaryDates, documentFamily, normalizedDocumentNumber, normalizedArticle } from "./search-document-metadata";
import { supabaseRest } from "./supabase-server";
import { CORPUS_ANSWER_TYPES } from "./official-corpus";
import { legalValidity } from "./legal-center";
import { documentReviewSummary } from "./document-review";
import {
  classifySearchDocument, passageSearchRank,
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
  let after="";
  for (let pageNumber = 0; pageNumber < 200; pageNumber++) {
    const page = await supabaseRest<SearchCatalogueRow[]>(
      `documents?es_institucional=eq.true&status=eq.indexed&document_type=in.(${CORPUS_ANSWER_TYPES.join(",")})&select=id,title,document_type,source_entity,process_type,metadata&order=id${after?`&id=gt.${encodeURIComponent(after)}`:""}&limit=500`,
    );
    rows.push(...page);
    if (page.length < 500) return rows;
    const next=page[page.length-1].id;
    if(next<=after) throw new Error("El catálogo no avanzó; no se publicará un conteo parcial.");
    after=next;
  }
  throw new Error("El catálogo supera el límite operativo de revisión; no se publica un conteo parcial.");
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
    review: documentReviewSummary(row.metadata),
    title: row.title,
    documentType: row.document_type,
    sourceEntity: canonicalSourceEntity(row.source_entity),
    dates: documentaryDates(row.metadata),
    versionNote:row.document_type==="bases_estandar"&&typeof row.metadata.selectionNote==="string"?row.metadata.selectionNote.slice(0,500):undefined,
    publication: publication.label,
    dateTime: publication.time,
    rank,
    matches,
    matchCount,
    titleMatch,
    classification: classifySearchDocument(row),
    validity: activeValidityReview(row.metadata) ? reviewedValidity(activeValidityReview(row.metadata)!) : legalValidity(
      typeof row.metadata.vigencia === "string" ? row.metadata.vigencia : null,
      typeof row.metadata.status === "string" ? row.metadata.status : null,
    ),
  };
}
export async function searchDocuments(
  input: DocumentSearchInput,
): Promise<DocumentSearchResponse> {
  if(input.mode!=="semantic") {
    // Preserve exact titles. Identifier matching already normalizes references independently.
    const normalized=normalizeLiteralSearch(input.query,input.filters.article);
    const identifier=normalizedDocumentNumber(input.query);
    let indexed: {documents:Array<{row:SearchCatalogueRow;matches:DocumentSearchMatch[];rank:number;matchCount:number;titleMatch:boolean}>;totalDocuments:number;page:number;pages:number}|null=null;
    try {
      indexed=await supabaseRest("rpc/ace_search_documents_page_v2",{method:"POST",body:JSON.stringify({p_query:normalized.query,p_mode:input.mode,p_filters:{...input.filters,article:normalized.article,...(/\d/.test(identifier)&&!normalized.isArticleReference&&!normalized.article?{normalizedIdentifier:identifier}:{})},p_sort:input.sort,p_page:input.page,p_page_size:input.pageSize})});
    } catch(error) {if(!missingSearchIndex(error)) throw error;}
    if(indexed) {
      if(!Array.isArray(indexed.documents)||!Number.isSafeInteger(indexed.totalDocuments)) throw new Error("Respuesta de índice inválida");
      const documents=indexed.documents.map(hit=>resultDocument(hit.row,hit.matches,hit.rank,hit.matchCount,hit.titleMatch));
      const warnings=[input.mode==="literal"?"La frase se comprueba sobre títulos y texto indexado. Se muestran los pasajes mejor relacionados antes de cargar más coincidencias.":"Se exigen todas las palabras en el mismo documento; pueden aparecer en pasajes distintos. Los pasajes mostrados son una selección."];
      if(documents.length) try {
        const related=await supabaseRest<Array<{parentId:string;documentId:string;title:string}>>("rpc/ace_search_document_versions_v2",{method:"POST",body:JSON.stringify({p_ids:documents.map(doc=>doc.documentId)})});
        for(const doc of documents) doc.relatedVersions=related.filter(item=>item.parentId===doc.documentId).map(({documentId,title})=>({documentId,title}));
      } catch {warnings.push("No se pudieron comprobar las otras versiones de estos documentos.");}
      return {documents,totalDocuments:indexed.totalDocuments,page:indexed.page,pages:indexed.pages,pageSize:input.pageSize,scope:"catalogue",warnings,query:input.query,mode:input.mode,engine:"indexed",partialRetrieval:false};
    }
  }
  let indexScope = false;
  let fullCatalogue: SearchCatalogueRow[];
  if (input.mode === "semantic") {
    try {
      const candidates = await supabaseRest<{ overflow: boolean; documents: SearchCatalogueRow[] }>("rpc/ace_search_candidates_v3", { method: "POST", body: JSON.stringify({ p_filters: input.filters }) });
      if (!candidates || !Array.isArray(candidates.documents)) throw new Error("Respuesta de candidatos inválida");
      if (candidates.overflow) throw new Error("Acota los filtros: la búsqueda por significado admite hasta 10.000 documentos candidatos. La búsqueda exacta sigue disponible.");
      fullCatalogue = candidates.documents;
      indexScope = true;
    } catch (error) {
      if (!(error instanceof Error && /PGRST202|42883/.test(error.message) && /ace_search_candidates_v3/.test(error.message))) throw error;
      fullCatalogue = await loadSearchCatalogue();
    }
  } else fullCatalogue = await loadSearchCatalogue();
  const catalogue = fullCatalogue.filter((row) =>
    matchesSearchCatalogue(row, input.filters),
  );
  const byId = new Map(catalogue.map((row) => [row.id, row]));
  let documents: DocumentSearchResult[] = [];
  const warnings: string[] = [];
  let partialRetrieval=false;
  if (catalogue.length && input.mode !== "semantic") {
    if(catalogue.length>2000) throw new Error("Activa el índice documental para buscar este catálogo completo. No se publica una lista truncada.");
    type Hit = { documentId: string; matchCount: number; titleMatch: boolean; matches: DocumentSearchMatch[] };
    const normalized = normalizeLiteralSearch(equivalentReference(input.query),input.filters.article);
    const {query,article} = normalized;
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
    if (/\d/.test(identifier) && !normalized.isArticleReference && !article) for (const row of catalogue) {
      const number = row.metadata.documentNumber ?? row.metadata.number;
      if (typeof number === "string" && normalizedDocumentNumber(number) === identifier && !hits.some(hit => hit.documentId === row.id))
        hits.push({ documentId: row.id, matchCount: 0, titleMatch: true, matches: [] });
    }
    for (const hit of hits) hit.matches.sort((a,b)=>passageSearchRank(input.query,b)-passageSearchRank(input.query,a));
    documents = hits
      .filter((hit) => byId.has(hit.documentId))
      .map((hit) =>
        resultDocument(
          byId.get(hit.documentId)!,
          hit.matches,
          (hit.titleMatch ? 100 : 0) + Math.min(1, Math.log1p(hit.matchCount)) +
            Math.max(0,...hit.matches.map(match=>passageSearchRank(input.query,match))) +
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
    const topic = lexicalTopic(input.query);
    const [meaningResult, wordsResult] = await Promise.allSettled([
      searchLegalSources(
        { query: input.query, topK: 20, filters: indexScope ? { article: input.filters.article?.split(".")[0] } : input.filters },
        { diversifyDocuments: true, allowedDocumentIds: catalogue.map(row => row.id), indexedLexical: indexScope },
      ),
      topic.length >= 2 ? searchDocuments({ ...input, query: topic, mode: /\d/.test(topic) ? "literal" : "all_words", page: 1, pageSize: 20 }) : Promise.resolve(null),
    ]);
    if (meaningResult.status === "rejected" && (wordsResult.status === "rejected" || !wordsResult.value)) throw new Error("No se pudo recuperar documentos por palabras ni significado.");
    const result = meaningResult.status === "fulfilled" ? meaningResult.value : { sources: [], semanticaCaida: true, retrieval: { semantic: "unavailable", lexical: "available", catalogue: "available" } };
    const wordDocuments = wordsResult.status === "fulfilled" ? wordsResult.value?.documents ?? [] : [];
    if (wordsResult.status === "rejected") warnings.push("La recuperación documental por palabras falló. Se conservan los resultados por significado.");
    if (!indexScope) warnings.push("El índice de candidatos filtrados no está disponible; se usó el catálogo de compatibilidad.");
    partialRetrieval=Boolean(wordsResult.status === "rejected" || result.semanticaCaida || result.retrieval?.lexical==="unavailable" || result.retrieval?.catalogue==="unavailable");
    if(result.retrieval?.lexical==="unavailable") warnings.push("La búsqueda por palabras no estuvo disponible. Los resultados por significado pueden ser incompletos.");
    if(result.retrieval?.catalogue==="unavailable") warnings.push("No se pudo completar la comprobación de las referencias documentales solicitadas. La recuperación puede ser incompleta.");
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
          locator:source.locator,locatorLabel:source.locatorLabel,
          excerpt: source.excerpt,
          pageStart: source.pageStart,
          pageEnd: source.pageEnd,
          article: source.article,
          score: source.score,
        })),
        Math.max(...sources.map((source) => source.score)),
      ),
    );
    documents = fuseSearchDocuments(wordDocuments, documents, input.query);
    warnings.push("Se combinan hasta 20 documentos por palabras con hasta 20 pasajes por significado/referencias. El orden combina posiciones, no porcentajes de certeza jurídica.");
    warnings.push(
      "Este modo muestra documentos recuperados por relevancia; no cuenta todas las coincidencias del catálogo. Ordenar por fecha solo ordena los documentos recuperados; no busca los más recientes de toda la biblioteca. Puedes usar la frase exacta para una búsqueda documental completa del texto indexado.",
    );
    if (result.semanticaCaida)
      warnings.push(
        "La búsqueda por significado no estuvo disponible: se utilizó el respaldo por palabras. No interpretes esta lista como cobertura completa.",
      );
    if (!indexScope && (
      input.filters.object ||
      input.filters.subject ||
      input.filters.guidedTopic
    ))
      warnings.push(
        "La clasificación se aplica a los candidatos recuperados. Una lista vacía no demuestra ausencia en el catálogo.",
      );
  }
  for (const document of documents) {
    if (input.mode === "all_words") document.matchCount = document.matches.length;
    const row = byId.get(document.documentId)!;
    const family = documentFamily(row.document_type, row.title, row.metadata);
    document.relatedVersions ??= fullCatalogue.filter(other => other.id !== row.id && documentFamily(other.document_type, other.title, other.metadata) === family)
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
    partialRetrieval,
    query: input.query,
    mode: input.mode,
  };
}
