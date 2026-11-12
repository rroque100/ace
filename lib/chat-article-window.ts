// Qué ventana del ARTÍCULO ve el modelo, cuando el artículo quedó partido en varios fragmentos. Módulo puro.
//
// Los PDF se cortan en fragmentos de tamaño fijo y un artículo largo queda repartido: el art. 120 del Reglamento trae la fórmula de
// la penalidad en un fragmento y la tabla de valores de F puede caer en el siguiente. La recuperación sube uno de los dos y el
// modelo contesta «no consta en las fuentes» teniendo la otra mitad en la biblioteca.
//
// El tamaño NO crece (ver chat-excerpt.ts: darle al modelo más texto se midió y salió peor, en tiempo y en qué afirmaciones
// sobreviven a la comprobación). Lo que cambia es DE DÓNDE sale la ventana de 1 400 caracteres: del artículo entero
// (`norma_articulos`) en vez de solo del fragmento. Y solo se cambia si la ventana del artículo cubre MÁS palabras de la pregunta
// que la que ya se mostraba; si empata, queda la de siempre.
import { queryStems, relevantExcerpt } from "./chat-excerpt";

export type ArticleRow = { document_id: string; article_number: string; content: string; page_start: number | null; page_end: number | null };
type WidenableSource = { documentId: string; article: string | null; excerpt: string; pageStart: number | null; pageEnd: number | null };

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cuántas raíces de la consulta aparecen en el texto (la misma medida que usa relevantExcerpt para elegir ventana). */
export function stemCoverage(text: string, query: string) {
  const body = plain(text);
  return queryStems(query).filter((stem) => body.includes(stem)).length;
}

/**
 * Las partes de una pregunta compuesta (después de la primera) que NINGUNA fuente cubre. Se mide con las palabras propias de cada
 * parte, sin las que comparte con la primera: el tema («garantía de fiel cumplimiento») está en casi todas las fuentes y daría por
 * cubierta «cuándo puede reducirse en obras» sin que ninguna hable de la reducción. Cubierta = al menos el 60 % de esas raíces.
 */
export function uncoveredParts(parts: string[], texts: string[]) {
  if (parts.length < 2) return [];
  const first = new Set(queryStems(parts[0]));
  return parts.slice(1).filter((part) => {
    const own = queryStems(part).filter((stem) => !first.has(stem));
    if (!own.length) return false;
    const needed = Math.max(1, Math.ceil(own.length * 0.6));
    return !texts.some((text) => { const body = plain(text); return own.filter((stem) => body.includes(stem)).length >= needed; });
  });
}

/** La fuente que más raíces de `query` cubre; con empate, la primera (el orden del ranking). */
export function bestCoveringSource<S extends { excerpt: string }>(sources: S[], query: string): S | undefined {
  let best: S | undefined, bestScore = -1;
  for (const source of sources) { const score = stemCoverage(source.excerpt, query); if (score > bestScore) { best = source; bestScore = score; } }
  return best;
}

const key = (documentId: string, article: string) => `${documentId}|${article.trim()}`;

/**
 * Sustituye el extracto por la mejor ventana del artículo completo cuando cubre más de la consulta, y ensancha las páginas a las
 * del artículo (la ventana puede venir de la página siguiente). Un artículo con dos filas para el mismo número (dos cuerpos de la
 * norma) no se toca: no se sabe cuál es. Si dos fuentes del mismo artículo acaban con el mismo extracto, queda la primera y el
 * hueco queda para otra fuente.
 */
export function widenToArticles<S extends WidenableSource>(sources: S[], rows: ArticleRow[], query: string, clean: (text: string) => string = (text) => text) {
  const byArticle = new Map<string, ArticleRow[]>();
  // Una fila sin número o sin texto no sirve para elegir ventana y no debe tumbar la respuesta: se ignora.
  for (const row of rows.filter((row) => typeof row?.article_number === "string" && typeof row?.content === "string" && typeof row?.document_id === "string")) byArticle.set(key(row.document_id, row.article_number), [...(byArticle.get(key(row.document_id, row.article_number)) ?? []), row]);
  const widened = sources.map((source) => {
    const matches = source.article ? byArticle.get(key(source.documentId, source.article)) : undefined;
    if (!matches || matches.length !== 1) return source;
    const row = matches[0];
    const candidate = relevantExcerpt(clean(row.content), query);
    if (stemCoverage(candidate, query) <= stemCoverage(source.excerpt, query)) return source;
    const pages = [source.pageStart, source.pageEnd, row.page_start, row.page_end].filter((page): page is number => typeof page === "number");
    return { ...source, excerpt: candidate, pageStart: pages.length ? Math.min(...pages) : null, pageEnd: pages.length ? Math.max(...pages) : null, widenedToArticle: true as const };
  });
  return widened.filter((source, index) => !widened.slice(0, index).some((earlier) => earlier.documentId === source.documentId && earlier.article === source.article && earlier.excerpt === source.excerpt));
}
