/** Synthetic evidence evaluation; no database writes or real user conversations. */
import { writeFile } from "node:fs/promises";
import { auditEvidence, type AuditSource } from "../lib/chat-evidence-audit";
import { getOpenAIClient, getProvider, legalAnswerModel } from "../lib/openai-server";

const a: AuditSource = { documentTitle: "Manual ficticio de evaluación, versión Alfa", article: "A", version: "Alfa",
  regime: "prueba A", regimeReviewed: true, excerpt: "En la versión Alfa del manual ficticio, la comisión de evaluación es del 10% del importe de prueba. No se exige garantía. Esta regla solo describe servicios ficticios." };
const cases = [
  { id: "respaldo-directo", answer: "La comisión de evaluación es del 10% del importe de prueba en la versión Alfa del manual ficticio. [F1]", sources: [a], expected: "checked" },
  { id: "misma-cifra-otro-concepto", answer: "La garantía exigida es del 10% del importe de prueba. [F1]", sources: [a], expected: "unchecked" },
  { id: "negación-invertida", answer: "Se exige garantía. [F1]", sources: [a], expected: "unchecked" },
  { id: "objeto-distinto", answer: "La comisión para obras es del 10% del importe de prueba. [F1]", sources: [a], expected: "unchecked" },
  { id: "versión-distinta", answer: "La versión Beta del manual ficticio exige una comisión del 10% del importe de prueba. [F1]", sources: [a], expected: "unchecked" },
  { id: "afirmación-sin-cita", answer: "La comisión es del 10% del importe de prueba.", sources: [a], expected: "unchecked" },
  { id: "ausencia-de-fuentes", answer: "Se exige una garantía. [F1]", sources: [], expected: "unchecked" },
];

async function main() {
  const results = [];
  for (const item of cases) {
    const start = Date.now();
    const review = await auditEvidence(item.answer, item.sources, undefined, async (system, payload) => {
      const response = await getOpenAIClient().responses.create({ model: legalAnswerModel, temperature: 0, max_output_tokens: 1600,
        input: [{ role: "system", content: system }, { role: "user", content: payload }] },
      { timeout: 25000, maxRetries: 0, signal: AbortSignal.timeout(25000) });
      return response.output_text;
    });
    results.push({ id: item.id, expected: item.expected, actual: review.documentary,
      passed: review.documentary === item.expected, elapsedMs: Date.now() - start, review });
    console.log(`${item.id}: ${review.documentary === item.expected ? "PASS" : "FAIL"}`);
  }
  const report = { createdAt: new Date().toISOString(), provider: getProvider(), model: legalAnswerModel,
    kind: "synthetic-evidence-check", humanReview: "pending", legalAccuracy: null, results };
  const output = process.argv[2];
  if (output) await writeFile(output, JSON.stringify(report, null, 2));
  console.log(`${results.filter(r => r.passed).length}/${results.length} controles sintéticos; no mide precisión jurídica.`);
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
main().catch(() => { console.error("No se pudo ejecutar la evaluación; comprueba la configuración del proveedor."); process.exitCode = 1; });
