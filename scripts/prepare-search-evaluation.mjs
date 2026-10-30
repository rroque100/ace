import { readFile, writeFile } from "node:fs/promises";
const catalogue = JSON.parse(await readFile("docs/evaluaciones/catalogue-review-2026-10-24.json", "utf8")).documents;
const cases = [];
for (const type of [...new Set(catalogue.map(row => row.type))]) {
  for (const row of catalogue.filter(row => row.type === type).slice(0, 2)) {
    cases.push({ id: `identity-${row.id}`, input: { query: row.title, mode: "literal", filters: { documentType: type } }, expectedDocumentIds: [row.id] });
  }
}
const regulation = catalogue.find(row => row.type === "reglamento" && row.title.includes("32069"));
for (const input of [
  { query: "garantía fiel cumplimiento", mode: "all_words", filters: { documentType: "reglamento", regime: "32069" } },
  { query: "garantía de fiel cumplimiento", mode: "semantic", filters: { documentType: "reglamento", regime: "32069" } },
  { query: "Artículo 113", mode: "literal", filters: { documentId: regulation.id, regime: "32069" } },
  { query: "garantía", mode: "literal", filters: { documentId: regulation.id, regime: "32069" }, pageSize: 5 },
]) cases.push({ id: `topic-${cases.length}`, input, expectedDocumentIds: [regulation.id] });
for (const input of [
  { query: "zzzzdocumentoinexistentezzzz", mode: "literal", filters: {} },
  { query: regulation.title, mode: "literal", filters: { documentId: regulation.id, regime: "30225" } },
  { query: "nulidad", mode: "all_words", filters: { documentType: "informe_vicio_nulidad" } },
]) cases.push({ id: `negative-${cases.length}`, input, expectEmpty: true, expectedDocumentIds: [] });
await writeFile("docs/evaluaciones/search-expanded-cases-2026-10-24.json", JSON.stringify({ name: "documentary-regression-expanded-v2", humanReview: "pending", description: "Regresión documental por identidad, tipos, modos, filtros y negativos. Las expectativas no constituyen juicios de pertinencia jurídica; requieren ampliación por especialista con consultas reales.", cases }, null, 2) + "\n");
console.log(`${cases.length} casos preparados`);
