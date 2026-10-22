type PageRange = { page_start: number | null; page_end: number | null };

/** Cuenta páginas citadas distintas, incluyendo rangos que cruzan varias páginas. */
export function countReferencedPages(chunks: PageRange[]): number {
  const validPage = (value: number | null): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const ranges = chunks.flatMap((chunk): [number, number][] => {
    const start = validPage(chunk.page_start) ? chunk.page_start : chunk.page_end;
    if (!validPage(start)) return [];
    const end = validPage(chunk.page_end) ? Math.max(start, chunk.page_end) : start;
    return [[start, end]];
  }).sort((a, b) => a[0] - b[0]);
  let count = 0;
  let previousEnd = 0;
  for (const [start, end] of ranges) {
    count += Math.max(0, end - Math.max(start, previousEnd + 1) + 1);
    previousEnd = Math.max(previousEnd, end);
  }
  return count;
}
