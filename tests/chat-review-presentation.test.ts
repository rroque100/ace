import { expect, it } from "vitest";
import { initialEvidenceReview, type EvidenceReview } from "@/lib/chat-evidence-audit";
import { reviewSummary, reviewApplicability, reviewTechnicalNotes, reviewFooter } from "@/lib/chat-review-presentation";
const partial = (): EvidenceReview => ({ ...initialEvidenceReview(), documentary: "partial", presentation: "partial", reviewStatus: "complete", omittedCount: 1, claims: [{ id: 1, status: "supported", reason: "Coincide" }, { id: 2, status: "insufficient", reason: "No consta" }] });
// Synthetic presentation examples only; no legal rules are asserted here.
it("explica que el porcentaje publicado está respaldado y qué quedó pendiente", () => {
  const summary = reviewSummary(partial(), "**Respuesta documental parcial**\nPorcentaje sintético: 10% [F1]\n\n**Disposición y fuente**\nDocumento sintético");
  expect(summary).toBe("El porcentaje indicado está respaldado; una explicación adicional no pudo comprobarse.");
  expect(summary).not.toContain("afirmación(es)");
});
it("no llama porcentaje a una explicación sin cifras ni a cifras ocultas en el desarrollo", () => {
  const answer = "**Respuesta documental parcial**\nExplicación comprobada [F1]\n\n**Disposición y fuente**\nFuente\n\n**Desarrollo comprobado**\nDato sintético 10%";
  expect(reviewSummary(partial(), answer)).toContain("La información mostrada está respaldada");
});
it("un pasaje sin revisión nunca se anuncia como porcentaje comprobado", () => {
  const review = { ...partial(), presentation: "literal" as const, reviewStatus: "failed" as const };
  expect(reviewSummary(review, "Texto literal 10% [F1]")).not.toContain("está respaldado");
  expect(reviewSummary(review)).toContain("no pudo completarse");
});
it("distingue contradicción de explicación no comprobada", () => {
  const review = partial(); review.claims[1].status = "contradicted";
  expect(reviewSummary(review, "10% [F1]")).toContain("contradecía las fuentes");
});
it("mantiene visible la aplicación pendiente y lleva recuentos y catálogo a detalles", () => {
  const review = partial(); review.warnings = ["Hay fuentes cuyo régimen no ha sido revisado en el catálogo."];
  const visible = reviewSummary(review, "10% [F1]") + reviewApplicability(review);
  expect(visible).toContain("Aplicación al caso pendiente de confirmar");
  expect(visible).not.toContain("catálogo");
  expect(visible).not.toContain("Se omitió");
  expect(reviewTechnicalNotes(review).join(" ")).toContain("catálogo");
  expect(reviewTechnicalNotes(review).join(" ")).toContain("Se omitió una afirmación");
});
it("conserva en exportación el resumen correcto y los detalles de revisión", () => {
  expect(reviewFooter(partial(), "10% [F1]")).toContain("El porcentaje indicado está respaldado");
  expect(reviewFooter(partial(), "10% [F1]")).toContain("Detalles de revisión:");
});
it("un contexto completo tampoco confirma aplicación jurídica automáticamente", () => {
  const review = partial(); review.missing = [];
  expect(reviewApplicability(review)).toBe("Aplicación al caso pendiente de confirmar.");
});
