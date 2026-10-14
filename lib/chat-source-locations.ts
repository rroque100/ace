type LocatedSource = { documentTitle: string; pageStart: number | null; pageEnd: number | null };

/** Solo publica ubicaciones registradas, nunca páginas inventadas por el modelo. */
export function chatSourceLocations(answer: string, sources: LocatedSource[]) {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[F(\d+)(?:[^\]\n]*)\]/g)) {
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < sources.length) cited.add(index);
  }
  if (!cited.size) return "";
  const lines = [...cited].sort((a, b) => a - b).map((index) => {
    const source = sources[index];
    const start = source.pageStart;
    const end = source.pageEnd;
    const location = start && start > 0
      ? end && end > start ? `páginas ${start}–${end}` : `página ${start}`
      : "página no disponible en la fuente registrada";
    return `- [F${index + 1}] ${source.documentTitle} · ${location}`;
  });
  return `\n\n**Documentos y páginas citados**\n${lines.join("\n")}`;
}
