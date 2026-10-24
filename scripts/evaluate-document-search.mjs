// Explicit, read-only evaluation. No conversations, history or source writes.
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
process.loadEnvFile(".env.local");
const dataset = JSON.parse(await readFile(process.argv[2] || "docs/evaluaciones/search-retrieval-cases-2026-10-24.json", "utf8"));
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { searchDocuments } = await server.ssrLoadModule("/lib/document-search-server.ts");
  const { documentSearchRequestSchema } = await server.ssrLoadModule("/lib/document-search.ts");
  const { retrievalMetrics } = await server.ssrLoadModule("/lib/search-evaluation.ts");
  const results = [];
  for (const item of dataset.cases) {
    const started = performance.now();
    try {
      const result = await searchDocuments(documentSearchRequestSchema.parse(item.input));
      results.push({ id: item.id, input: item.input, elapsedMs: Math.round(performance.now() - started), ...retrievalMetrics(item.expectedDocumentIds, result.documents.map(document => document.documentId)), partial: Boolean(result.partialRetrieval), scope: result.scope, warnings: result.warnings, results: result.documents.map(document => ({ documentId: document.documentId, title: document.title, foundBy: document.foundBy, pages: document.matches.map(match => [match.pageStart, match.pageEnd]) })) });
    } catch {
      results.push({ id: item.id, elapsedMs: Math.round(performance.now() - started), failed: true, recallAtK: 0, reciprocalRank: 0 });
    }
  }
  const report = { dataset: dataset.name, humanReview: dataset.humanReview, legalAccuracy: null, runAt: new Date().toISOString(), meanRecallAt10: results.reduce((sum, row) => sum + row.recallAtK, 0) / results.length, meanReciprocalRank: results.reduce((sum, row) => sum + row.reciprocalRank, 0) / results.length, results };
  const output = process.argv[3];
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ cases: results.length, failed: results.filter(row => row.failed).length, meanRecallAt10: report.meanRecallAt10, meanReciprocalRank: report.meanReciprocalRank, humanReview: report.humanReview }));
  if (results.some(row => row.failed || row.partial || row.recallAtK === 0)) process.exitCode = 1;
} finally { await server.close(); }
