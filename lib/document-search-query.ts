import { normalizedArticle } from "./search-document-metadata";

/** Shared by initial literal retrieval and subsequent pages. */
export function normalizeLiteralSearch(query: string, article?: string) {
  const reference=query.match(/^(?:art[ií]culo|art\.?)\s*(\d+(?:\.\d+)*)(?:[.°º])?$/i);
  return {
    query:reference ? (reference[1].length===1 ? `Artículo ${reference[1]}` : reference[1]) : query,
    article:normalizedArticle(article || reference?.[1] || "").split(".")[0],
    isArticleReference:Boolean(reference),
  };
}
