export function retrievalMetrics(expected: string[], ranked: string[], k = 10) {
  if (!expected.length) throw new Error("Cada caso debe declarar documentos esperados.");
  const relevant = new Set(expected);
  const top = [...new Set(ranked)].slice(0, k);
  const hits = top.filter(id => relevant.has(id));
  const first = top.findIndex(id => relevant.has(id));
  return { recallAtK: hits.length / relevant.size, reciprocalRank: first < 0 ? 0 : 1 / (first + 1), missing: [...relevant].filter(id => !hits.includes(id)) };
}
