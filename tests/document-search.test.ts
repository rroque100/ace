import { expect, it } from "vitest";
import {
  classifySearchDocument,
  compareSearchDocuments,
  documentSearchRequestSchema,
  literalMatchParts,
  matchesSearchCatalogue,
  documentPublication,
  type SearchCatalogueRow,
} from "@/lib/document-search";
const row = (
  metadata: Record<string, unknown> = {},
  title = "Documento sin tema",
): SearchCatalogueRow => ({
  id: "a",
  title,
  document_type: "opinion",
  source_entity: "OECE",
  process_type: "todos",
  metadata,
});
it("normaliza tildes y espacios resaltando el original sin interpretar HTML", () => {
  const parts = literalMatchParts(
    "<script> áMPLIACIÓN\n  del plazo </script>",
    "ampliacion del plazo",
  );
  expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual([
    "áMPLIACIÓN\n  del plazo",
  ]);
  expect(parts.map((p) => p.text).join("")).toBe(
    "<script> áMPLIACIÓN\n  del plazo </script>",
  );
});
it("trata operadores y signos como texto literal", () => {
  expect(literalMatchParts("a.* aZZ", "a.*").filter((p) => p.match)).toEqual([
    { text: "a.*", match: true },
  ]);
  expect(literalMatchParts("texto", "% OR true").some((p) => p.match)).toBe(
    false,
  );
});
it("resalta varias coincidencias sin duplicar caracteres", () => {
  const parts = literalMatchParts("Garantía y garantia", "garantia");
  expect(parts.filter((p) => p.match)).toHaveLength(2);
  expect(parts.map((p) => p.text).join("")).toBe("Garantía y garantia");
});
it("distingue clasificación revisada de sugerencia", () => {
  expect(
    classifySearchDocument(
      row({ topic: "Perfeccionamiento del contrato de bienes" }),
    ),
  ).toMatchObject({
    objects: ["bienes"],
    subjects: ["ejecucion"],
    topics: ["perfeccionamiento"],
    origin: "suggested",
  });
  expect(
    classifySearchDocument(
      row(
        {
          searchClassification: {
            reviewed: true,
            objects: ["obras", "inventado"],
            subjects: ["general"],
            topics: [],
          },
        },
        "bienes",
      ),
    ),
  ).toEqual({
    objects: ["obras"],
    subjects: ["general"],
    topics: [],
    origin: "registered",
  });
});
it("no inventa clasificación ni régimen a partir del año", () => {
  const value = row({ year: 2026 });
  expect(classifySearchDocument(value).origin).toBe("unknown");
  expect(
    matchesSearchCatalogue(value, {
      object: "sin_clasificar",
      regime: "no_determinado",
    }),
  ).toBe(true);
  expect(matchesSearchCatalogue(value, { regime: "32069" })).toBe(false);
});
it("combina jerarquía con filtros y respeta selección múltiple", () => {
  const value = row({ topic: "Garantías en bienes", year: 2025 });
  expect(
    matchesSearchCatalogue(value, {
      object: "bienes",
      subject: "ejecucion",
      guidedTopic: "garantias",
      years: [2025],
      documentTypes: ["opinion"],
    }),
  ).toBe(true);
  expect(matchesSearchCatalogue(value, { subject: "seleccion" })).toBe(false);
  expect(matchesSearchCatalogue(value, { object: "sin_clasificar" })).toBe(
    false,
  );
  expect(matchesSearchCatalogue(value, { year: 2024, years: [2025] })).toBe(
    true,
  );
});
it("vigente no incluye no vigente ni metadatos sin confirmar", () => {
  expect(
    matchesSearchCatalogue(row({ vigencia: "no vigente" }), {
      vigencia: "vigente",
    }),
  ).toBe(false);
  expect(
    matchesSearchCatalogue(row({ vigencia: "vigente" }), {
      vigencia: "vigente",
    }),
  ).toBe(true);
  expect(
    matchesSearchCatalogue(row({ status: "vigente" }), { vigencia: "unknown" }),
  ).toBe(true);
});
it("ordena fechas conocidas primero con desempate estable", () => {
  const undated = { documentId: "a", dateTime: null, rank: 9 };
  const dated = { documentId: "b", dateTime: 100, rank: 1 };
  expect(compareSearchDocuments(undated, dated, "oldest")).toBeGreaterThan(0);
  expect(compareSearchDocuments(undated, dated, "newest")).toBeGreaterThan(0);
  expect(
    compareSearchDocuments({ ...dated, documentId: "a" }, dated, "relevance"),
  ).toBeLessThan(0);
});
it("no confunde carga con publicación y conserva año sin inventar día", () => {
  expect(
    documentPublication(row({ created_at: "2026-10-23" })).time,
  ).toBeNull();
  expect(documentPublication(row({ year: 2025 })).label).toBe("2025");
});
it("rechaza clasificación inventada y paginación fuera de límites", () => {
  expect(
    documentSearchRequestSchema.safeParse({
      query: "abc",
      filters: { object: "privado" },
    }).success,
  ).toBe(false);
  expect(
    documentSearchRequestSchema.safeParse({ query: "abc", page: 0 }).success,
  ).toBe(false);
  expect(
    documentSearchRequestSchema.safeParse({ query: "abc", pageSize: 1000 })
      .success,
  ).toBe(false);
});
