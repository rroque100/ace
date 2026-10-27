import { foldSearchText, passageSearchRank, type DocumentSearchResult } from "./document-search";

/** Formatting only: digits and issuer names retain their identity. */
export function equivalentReference(query: string) {
  return query.replace(/\b(opini[oó]n|resoluci[oó]n|pronunciamiento|directiva|ley)\s+(?:n(?:ro|[úu]mero)?[.°ºo\s]*\s*)?/gi, "$1 ")
    .replace(/\b(d?)0+(\d+)(?=\s*[-/])/gi, "$1$2")
    .replace(/(?<=\d)\s*\/\s*(?=\d{4}\b)/g, "-");
}

function editDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = next;
  }
  return previous[b.length];
}

/** Only propose unique, close, catalogue-backed words. Never change a reference. */
export function proposedSpelling(query: string, vocabulary: string[]) {
  if (/\d|["“”]/.test(query) || /\b(?:art[ií]culo|art\.)/i.test(query)) return null;
  const dictionary = new Set(vocabulary.map(foldSearchText));
  let changed = false;
  const corrected = query.replace(/[a-záéíóúüñ]+/gi, (word) => {
    const token = foldSearchText(word);
    if (token.length < 5 || word === word.toUpperCase() || dictionary.has(token)) return word;
    const ranked = [...dictionary].filter(candidate => Math.abs(candidate.length - token.length) <= 1)
      .map(candidate => ({ candidate, distance: editDistance(token, candidate) }))
      .filter(item => item.distance <= 1).sort((a, b) => a.distance - b.distance);
    if (!ranked.length || (ranked[1] && ranked[0].distance === ranked[1].distance)) return word;
    changed = true;
    return ranked[0].candidate;
  });
  return changed ? corrected : null;
}

const stopWords = new Set("que qué como cómo para sobre entre estas estos esta este del las los una unos con por debe puedo puede son sus hay me se de el la en y o un al es a opiniones opinion dtn resoluciones resolucion documentos buscar necesito".split(" ").map(foldSearchText));
export function lexicalTopic(query: string) {
  // Explicit references stay intact instead of being rewritten into topic words.
  if (/\d/.test(query)) return equivalentReference(query).slice(0, 500);
  return [...new Set(foldSearchText(query).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word)))].slice(0, 10).join(" ");
}

/** Reciprocal rank fusion: incomparable provider scores are never added directly. */
export function fuseSearchDocuments(lexical: DocumentSearchResult[], semantic: DocumentSearchResult[], query = "") {
  const combined = new Map<string, DocumentSearchResult>();
  for (const [method, list] of [["words", lexical], ["meaning", semantic]] as const) {
    const seen = new Set<string>();
    list.forEach((document, index) => {
      if (seen.has(document.documentId)) return;
      seen.add(document.documentId);
      const existing = combined.get(document.documentId);
      const matches = [...new Map([...(existing?.matches ?? []), ...document.matches].map(match => [match.chunkId, match])).values()];
      combined.set(document.documentId, {
        ...document, matches, matchCount: matches.length,
        titleMatch: Boolean(existing?.titleMatch || document.titleMatch),
        rank: (existing?.rank ?? 0) + 1 / (60 + index + 1),
        foundBy: [...(existing?.foundBy ?? []), method],
      });
    });
  }
  const passageRank = (match: DocumentSearchResult["matches"][number]) => passageSearchRank(query, match)
    + passageSearchRank(query, { excerpt: match.excerpt.slice(0, 250), article: null }) / 2;
  return [...combined.values()].map(document => ({ ...document, matches: query ? document.matches.sort((a, b) => passageRank(b) - passageRank(a) || (a.pageStart ?? Infinity) - (b.pageStart ?? Infinity) || a.chunkId.localeCompare(b.chunkId)) : document.matches }))
    .sort((a, b) => b.rank - a.rank || a.documentId.localeCompare(b.documentId));
}
