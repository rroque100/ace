import { expect, it } from "vitest";
import { diversifyDocumentCandidates } from "@/lib/document-search-ranking";
it("presenta documentos diversos antes de repetir el dominante", () => {
  const candidates = [
    ...Array.from({ length: 12 }, (_, i) => ({
      documentId: "a",
      chunkId: `a${i}`,
    })),
    { documentId: "b", chunkId: "b1" },
    { documentId: "c", chunkId: "c1" },
  ];
  const selected = diversifyDocumentCandidates(candidates, 5);
  expect(selected.slice(0, 3).map((s) => s.documentId)).toEqual([
    "a",
    "b",
    "c",
  ]);
  expect(selected.filter((s) => s.documentId === "a")).toHaveLength(3);
});
it("respeta el límite y elimina fragmentos duplicados", () => {
  const source = { documentId: "a", chunkId: "a1" };
  expect(diversifyDocumentCandidates([source, source], 5)).toEqual([source]);
  expect(diversifyDocumentCandidates([source], 0)).toEqual([]);
});
