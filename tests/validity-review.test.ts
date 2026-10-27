import { expect, it } from "vitest";
import { activeValidityReview, officialEvidenceUrl, reviewedValidity, validityReviewInput, type ValidityRecord } from "@/lib/validity-review";
import { documentReviewSummary } from "@/lib/document-review";
import { legalValidity } from "@/lib/legal-center";
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const input = { result: "current", scope: "document", articleIds: [], version: "Versión comprobada", asOf: "2026-01-01", sourceUrl: "https://www.gob.pe/institucion/example", basis: "Se contrastó esta versión con las publicaciones indicadas.", revision: 0 };
const record: ValidityRecord = { ...input, id, result: "current", scope: "document", reviewer: "Revisor", recordedAt: "2026-01-01T12:00:00Z", revision: 1 };
it("exige sustento, versión y fecha, sin aceptar sitios parecidos", () => {
  expect(validityReviewInput.safeParse(input).success).toBe(true);
  for (const sourceUrl of ["https://gob.pe.evil.test/foo", "javascript:alert(1)", "http://www.gob.pe/foo", "https://user:pass@www.gob.pe/foo"]) expect(officialEvidenceUrl(sourceUrl)).toBe(false);
  expect(validityReviewInput.safeParse({ ...input, basis: "corto" }).success).toBe(false);
  expect(validityReviewInput.safeParse({ ...input, asOf: "2099-01-01" }).success).toBe(false);
});
it("no convierte una revisión de artículo en revisión del documento", () => {
  const metadata = { validityReviews: { articles: { [id]: { ...record, scope: "articles", articleIds: [id] } } } };
  expect(activeValidityReview(metadata)).toBeNull();
  expect(activeValidityReview(metadata, id)?.scope).toBe("articles");
  expect(activeValidityReview(metadata, other)).toBeNull();
});
it("aplica la revisión más reciente del artículo o documento, sin reactivar una antigua", () => {
  const article = { ...record, scope: "articles", articleIds: [id], result: "not_current" };
  const metadata = { validityReviews: { document: { ...record, revision: 2 }, articles: { [id]: article } } };
  expect(activeValidityReview(metadata, id)?.result).toBe("current");
  expect(activeValidityReview({ validityReviews: { ...metadata.validityReviews, articles: { [id]: { ...article, revision: 3 } } } }, id)?.result).toBe("not_current");
});
it("separa realizado y resultado: información insuficiente no es vigencia confirmada", () => {
  expect(reviewedValidity({ ...record, result: "insufficient" }).state).toBe("unknown");
  expect(reviewedValidity({ ...record, result: "not_current" }).label).toContain("no vigente");
  expect(legalValidity("parcialmente vigente").state).toBe("unknown");
  expect(documentReviewSummary({ vigencia: "vigente" }).validity).toBeNull();
});
it("rechaza alcances contradictorios y metadatos incompletos", () => {
  expect(validityReviewInput.safeParse({ ...input, scope: "articles" }).success).toBe(false);
  expect(validityReviewInput.safeParse({ ...input, articleIds: [id] }).success).toBe(false);
  expect(activeValidityReview({ validityReviews: { document: { result: "current" } } })).toBeNull();
});
