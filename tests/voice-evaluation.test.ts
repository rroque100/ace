import { expect, it } from "vitest";
import { voiceEvaluation } from "@/lib/voice-evaluation";
it("mide referencias exactas aunque el texto parezca fluido", () => {
  const result = voiceEvaluation("Artículo ciento trece", "Artículo trece", ["113"]);
  expect(result.referencesExact).toBe(false); expect(result.missingReferences).toEqual(["113"]); expect(result.extraReferences).toEqual(["13"]);
});
it("distingue normalización numérica de error acústico", () => {
  const result = voiceEvaluation("Artículo ciento trece, numeral uno", "Artículo 113.1", ["113.1"]);
  expect(result.wordErrorRate).toBeGreaterThan(0); expect(result.normalizedWordErrorRate).toBe(0); expect(result.referencesExact).toBe(true);
});
