type LocatedSource = { article?: string | null; numeral?: string | null; version?: string | null; documentNumber?: string | null; documentTitle: string; pageStart: number | null; pageEnd: number | null; pageCount?: number | null };

/** A recorded version label is not a declaration of legal effectiveness. */
export function recordedVersion(title: string, explicit?: string | null) {
  if (explicit?.trim()) return explicit.trim();
  const label = title.match(/\btexto\s+actualizado\s+al\s+\d{2}[./-]\d{2}[./-]\d{4}\b/i)?.[0];
  return label ? `${label} (según título del documento)` : null;
}

/** Keep article annotations visible, while emitting the clickable [F#] syntax used by the UI. */
export function canonicalSourceMarkers(answer: string) {
  return answer.replace(/(?:[ \t]*,?[ \t]*\[F[^\]\n]*\])+/g, group => {
    const numbers = [...new Set([...group.matchAll(/\bF(\d+)/g)].map(match => match[1]))];
    const annotations = [...group.matchAll(/\[F([^\]\n]*)\]/g)].map(match =>
      (`F${match[1]}`).replace(/\bF\d+\b/g, "").replace(/^[,\s]+|[,\s]+$/g, "")).filter(Boolean);
    return ` ${annotations.length ? `(${[...new Set(annotations)].join("; ")}) ` : ""}${numbers.map(number => `[F${number}]`).join(" ")}`;
  });
}

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
    const provision = source.article ? `artículo ${source.article}${source.numeral ? `, numeral ${source.numeral}` : ", numeral no registrado"}` : "artículo/numeral propio no registrado";
    return `- [F${index + 1}] ${source.documentTitle} · ${location} · ${provision} · versión: ${source.version ?? "no registrada"}${verification ? ` (${verification}; no verifica la aplicabilidad jurídica)` : ""}`;
  });
  return `\n\n**Documentos y páginas citados**\n${lines.join("\n")}`;
}
