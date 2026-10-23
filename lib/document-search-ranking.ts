/** One best fragment per document first, then additional fragments up to three. */
export function diversifyDocumentCandidates<
  T extends { documentId: string; chunkId: string },
>(ranked: T[], limit: number): T[] {
  const selected: T[] = [];
  const chunks = new Set<string>();
  const counts = new Map<string, number>();
  for (const maxPerDocument of [1, 2, 3])
    for (const source of ranked) {
      if (selected.length >= limit) return selected;
      if (
        chunks.has(source.chunkId) ||
        (counts.get(source.documentId) ?? 0) >= maxPerDocument
      )
        continue;
      selected.push(source);
      chunks.add(source.chunkId);
      counts.set(source.documentId, (counts.get(source.documentId) ?? 0) + 1);
    }
  return selected;
}
