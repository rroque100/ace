import { expect, it } from "vitest";
import { equivalentReference, proposedSpelling, lexicalTopic, fuseSearchDocuments } from "@/lib/search-discovery";
import type { DocumentSearchResult } from "@/lib/document-search";

it("propone una corrección única y respaldada por el vocabulario", () => {
  expect(proposedSpelling("garantua contractual", ["garantia", "contractual"])).toBe("garantia contractual");
  expect(proposedSpelling("contrato", ["contrato"])).toBeNull();
  expect(proposedSpelling("cartas", ["cargas", "cartas"])).toBeNull();
  expect(proposedSpelling("cartas", ["cargas", "cantas"])).toBeNull();
});
it("conserva cifras, artículos, frases exactas y siglas", () => {
  for (const query of ["garantua 2026", "Art. 113", '"garantua"', "GARANTUA DTN"]) expect(proposedSpelling(query, ["garantia"])).toBeNull();
});
it("normaliza presentación sin cambiar la identidad documental", () => {
  expect(equivalentReference("Opinión N.º D000102/2026/OECE/DTN")).toBe("Opinión D102-2026/OECE/DTN");
  expect(equivalentReference("Art. 113.1")).toBe("Art. 113.1");
});
it("extrae palabras temáticas sin reescribir números documentales", () => {
  expect(lexicalTopic("qué documentos necesito para garantía contractual")).toBe("garantia contractual");
  expect(lexicalTopic("Opinión 001-2026/DTN")).toContain("1-2026/DTN");
});
const doc = (id: string, rank: number) => ({ documentId: id, rank, matches: [{ chunkId: id, excerpt: "texto", pageStart: 1 }], matchCount: 1 }) as DocumentSearchResult;
it("prioriza el documento encontrado por ambos métodos sin sumar scores", () => {
  const result = fuseSearchDocuments([doc("a", 10000), doc("b", 1)], [doc("b", 0.2), doc("c", 0.9)]);
  expect(result[0].documentId).toBe("b");
  expect(result[0].foundBy).toEqual(["words", "meaning"]);
  expect(result[0].matches).toHaveLength(1);
  expect(result).toHaveLength(3);
});
it("no duplica la contribución si un proveedor repite un documento", () => {
  expect(fuseSearchDocuments([doc("a", 1), doc("a", 1)], [])[0].rank).toBe(1 / 61);
});
it("elige un pasaje centrado en el tema antes de una mención incidental", () => {
  const lexical = { ...doc("a", 1), matches: [{ chunkId: "incidental", excerpt: "Introducción general. ".repeat(30) + "Documentación contractual", pageStart: 1, pageEnd: 2, article: null, score: null }] };
  const semantic = { ...doc("a", .5), matches: [{ chunkId: "direct", excerpt: "Documentación contractual: condiciones y requisitos del documento.", pageStart: 5, pageEnd: 5, article: null, score: null }] };
  expect(fuseSearchDocuments([lexical], [semantic], "documentación contractual")[0].matches[0].chunkId).toBe("direct");
});
