type LocatedSource = { documentTitle: string; pageStart: number | null; pageEnd: number | null; pageCount?: number | null };

export function citedSourceNumbers(answer: string) {
  return [...new Set([...answer.matchAll(/\[F[^\]\n]*\]/g)].flatMap((group) => [...group[0].matchAll(/\bF(\d+)/g)].map((match) => Number(match[1]))))];
}

export function checkedSourcePages(start: number | null, end: number | null, total?: number | null) {
  const valid = (page: number | null): page is number => typeof page === "number" && Number.isSafeInteger(page) && page > 0;
  if (!valid(start) || (end !== null && (!valid(end) || end < start))) return { pageStart: null, pageEnd: null };
  if (valid(total ?? null) && (start > total! || (end ?? start) > total!)) return { pageStart: null, pageEnd: null };
  return { pageStart: start, pageEnd: end };
}

/** Solo publica ubicaciones registradas, nunca páginas inventadas por el modelo. */
export function chatSourceLocations(answer: string, sources: LocatedSource[]) {
  const cited = new Set<number>();
  for (const number of citedSourceNumbers(answer)) {
    const index = number - 1;
    if (index >= 0 && index < sources.length) cited.add(index);
  }
  if (!cited.size) return "";
  const lines = [...cited].sort((a, b) => a - b).map((index) => {
    const source = sources[index];
    const { pageStart: start, pageEnd: end } = checkedSourcePages(source.pageStart, source.pageEnd, source.pageCount);
    const location = start && start > 0
      ? end && end > start ? `páginas ${start}–${end}` : `página ${start}`
      : "página no disponible en la fuente registrada";
    const verification = start ? (source.pageCount ? "rango comprobado contra el número de páginas registrado del PDF" : "ubicación registrada; total de páginas no disponible") : "";
    return `- [F${index + 1}] ${source.documentTitle} · ${location}${verification ? ` (${verification}; no verifica la aplicabilidad jurídica)` : ""}`;
  });
  return `\n\n**Documentos y páginas citados**\n${lines.join("\n")}`;
}
