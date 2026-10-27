import { expect, it } from "vitest";
import { declaredRegime, documentReviewSummary } from "@/lib/document-review";
it("identifica únicamente una ley declarada en el título", () => {
  expect(declaredRegime("Reglamento de la Ley N.° 32069", {})?.regime).toBe("32069");
  expect(declaredRegime("Ley 30225 — texto actualizado", {})?.regime).toBe("30225");
  expect(declaredRegime("Reglamento de la ley general de contrataciones publicas 32069", {})?.regime).toBe("32069");
  expect(declaredRegime("Opinión 32069-2026", {})).toBeNull();
  expect(declaredRegime("Opinión DTN de 2026", { regime: "32069" })).toBeNull();
  expect(declaredRegime("Comparación Ley 32069 y Ley 30225", {})).toBeNull();
});
it("no inventa revisión humana ni de vigencia", () => {
  expect(documentReviewSummary({ vigencia: "vigente", regimeReview: { humanReviewed: false, method: "explicit-document-title" } })).toMatchObject({ reviewer: "ACE · comprobación documental automática", validityRecord: "vigente" });
  expect(documentReviewSummary({}).reviewer).toBe("Revisor sin registrar");
});
