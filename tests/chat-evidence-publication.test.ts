import { expect, it } from "vitest";
import { auditEvidence, initialEvidenceReview, type EvidenceReview } from "@/lib/chat-evidence-audit";
import { publishEvidence, relevantLiteral } from "@/lib/chat-evidence-publication";
import { chatAnswerBody, reviewFooter, reviewTitle, reviewNotices, chatAnswerSections, REVIEW_FOOTER } from "@/lib/chat-review-presentation";
// Fictional text. No rule of public procurement law is encoded here.
const text = "La comisión sintética equivale al 10% del importe original de prueba.";
const sources = [{ documentTitle: "Documento de prueba", article: "X", pageStart: 2, pageEnd: 2, excerpt: text }];
const question = "¿Qué porcentaje del importe original de prueba es la comisión sintética?";
const answer = `${text} [F1]\nSe exige una condición inventada [F1]`;
const raw = (items: unknown[]) => JSON.stringify({ claims: items });
const supported = { id: 1, status: "supported", reason: "Coincide con el pasaje", evidence: [{ source: 1, quote: text }] };

it("conserva lo respaldado y retira solo la afirmación no sustentada", async () => {
  const review = await auditEvidence(answer, sources, undefined, async () => raw([supported, { id: 2, status: "insufficient", reason: "No consta", evidence: [] }]));
  const published = publishEvidence(answer, sources, review, question);
  expect(published).toContain(text);
  expect(published).not.toContain("condición inventada");
  expect(published).toContain("página 2");
  expect(review.presentation).toBe("partial");
  expect(review.omittedCount).toBe(1);
});
it("una fila ausente no borra una afirmación comprobada", async () => {
  const review = await auditEvidence(answer, sources, undefined, async () => raw([supported]));
  expect(review.reviewStatus).toBe("incomplete");
  expect(publishEvidence(answer, sources, review, question)).toContain(text);
  expect(review.presentation).toBe("partial");
});
it("un error de proveedor produce lectura literal, no falsa ausencia de fuentes", async () => {
  const review = await auditEvidence(answer, sources, undefined, async () => { throw new Error("timeout"); });
  const published = publishEvidence(answer, sources, review, question);
  expect(review.failureReason).toBe("provider_error");
  expect(reviewTitle(review)).toContain("no pudo completarse");
  expect(published).toContain(text);
  expect(published).toContain("Lectura del documento");
  expect(published).not.toContain("condición inventada");
  expect(review.documentary).toBe("unchecked");
});
it("distingue falta de fuentes de JSON inválido", async () => {
  const missing = await auditEvidence(answer, [], undefined, async () => "{}");
  const invalid = await auditEvidence(answer, sources, undefined, async () => "{}");
  expect(missing.failureReason).toBe("no_sources");
  expect(invalid.failureReason).toBe("invalid_response");
  expect(reviewTitle(missing)).not.toBe(reviewTitle(invalid));
});
it("un dato numérico equivocado no elimina otra afirmación válida", async () => {
  const draft = `${text} [F1]\nLa comisión equivale al 11% del importe original. [F1]`;
  const review = await auditEvidence(draft, sources, undefined, async () => raw([supported, { ...supported, id: 2 }]));
  const published = publishEvidence(draft, sources, review, question);
  expect(published).toContain("10%");
  expect(published).not.toContain("11%");
});
it("ofrece un pasaje pertinente único y rechaza fragmentos arbitrarios", () => {
  const other = { ...sources[0], excerpt: "Una tabla de inventario muestra el material de oficina disponible." };
  expect(relevantLiteral(question, [other, ...sources])?.index).toBe(1);
  expect(relevantLiteral(question, [other])).toBeNull();
});
it("conserva avisos en exportación y los presenta una sola vez en pantalla", () => {
  const review: EvidenceReview = { ...initialEvidenceReview(), reviewStatus: "failed", failureReason: "provider_error", presentation: "literal", warnings: ["Aviso repetido", "Aviso repetido"] };
  const body = "Texto documental [F1]";
  const content = body + reviewFooter(review) + "\n\n**Documentos y páginas citados**\nFuente A";
  expect(content.split(REVIEW_FOOTER)).toHaveLength(2);
  expect(chatAnswerBody(content, review)).not.toContain("Verificación y límites");
  expect(chatAnswerBody(content, review)).toContain("Fuente A");
  expect(reviewNotices(review).filter(s => s === "Aviso repetido")).toHaveLength(1);
  expect(chatAnswerBody("Respuesta antigua", undefined)).toBe("Respuesta antigua");
});

it("muestra la respuesta y disposición primero y pliega el desarrollo", async () => {
  const draft = `${text} [F1]\nOtra comisión sintética descrita en el documento. [F1]`;
  const review = await auditEvidence(draft, sources, undefined, async () => raw([supported, { ...supported, id: 2 }]));
  const published = publishEvidence(draft, sources, review, question);
  const sections = chatAnswerSections(published + reviewFooter(review), review);
  expect(sections.main).toContain(text);
  expect(sections.main).toContain("Disposición y fuente");
  expect(sections.main).not.toContain("Otra comisión");
  expect(sections.detail).toContain("Otra comisión");
});
it("la lectura literal no arrastra el siguiente numeral ni inventa una cifra", () => {
  const sectioned = [{ ...sources[0], excerpt: `Artículo X. X.1. ${text} 113.2. Una cláusula accesoria ajena a la pregunta.` }];
  const literal = relevantLiteral(question, sectioned);
  expect(literal?.text).toContain(text);
  expect(literal?.text).not.toContain("cláusula accesoria");
});
