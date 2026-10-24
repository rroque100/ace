import { expect, it } from "vitest";
import { retrievalMetrics } from "@/lib/search-evaluation";
it("mide omisiones y posición sin contar documentos repetidos", () => {
  expect(retrievalMetrics(["a", "b"], ["x", "a", "a"], 3)).toEqual({ recallAtK: .5, reciprocalRank: .5, missing: ["b"] });
  expect(retrievalMetrics(["a"], ["b"])).toMatchObject({ recallAtK: 0, reciprocalRank: 0 });
});
it("no publica éxito vacío para casos sin respuesta esperada", () => {
  expect(() => retrievalMetrics([], [])).toThrow();
});
