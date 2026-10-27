import { legalCenterHref } from "@/lib/legal-center";
import { expect, it } from "vitest";
import {
  extendedLegalFiltersSchema,
  matchesExtendedFilters,
  reviewedRegime,
  extendedFiltersFromParams,
} from "@/lib/legal-workspace-filters";
import { compactFilter } from "@/lib/pinecone";
const source = {
  documentType: "opinion",
  year: 2025,
  regime: "32069",
  regimeReviewed: true,
};
it("aplica OR dentro de tipos/años y AND entre grupos", () => {
  expect(
    matchesExtendedFilters(source, {
      documentTypes: ["ley", "opinion"],
      years: [2024, 2025],
      regime: "32069",
    }),
  ).toBe(true);
  expect(
    matchesExtendedFilters(source, { documentTypes: ["ley"], years: [2025] }),
  ).toBe(false);
  expect(
    matchesExtendedFilters(source, {
      documentTypes: ["opinion"],
      years: [2024],
    }),
  ).toBe(false);
});
it("no inventa un régimen revisado por año o etiqueta sin revisión", () => {
  expect(reviewedRegime({ year: 2026, regime: "32069" })).toBe(
    "no_determinado",
  );
  expect(reviewedRegime({ regime: "32069", regimeReviewed: true })).toBe(
    "32069",
  );
  expect(
    matchesExtendedFilters(
      { ...source, regimeReviewed: false },
      { regime: "32069" },
    ),
  ).toBe(false);
  expect(
    matchesExtendedFilters(
      { ...source, regimeReviewed: false },
      { regime: "32069", includeUnknownRegime: true },
    ),
  ).toBe(true);
  expect(
    matchesExtendedFilters(
      { ...source, regimeReviewed: false },
      { regime: "no_determinado" },
    ),
  ).toBe(true);
});
it("los valores múltiples dominan a los filtros antiguos y no inventan metadatos de vectores", () => {
  expect(
    compactFilter({
      documentType: "ley",
      documentTypes: ["opinion", "directiva"],
      year: 2023,
      years: [2024, 2025],
      regime: "32069",
    }),
  ).toEqual({
    document_type: { $in: ["opinion", "directiva"] },
    year: { $in: [2024, 2025] },
  });
  expect(extendedLegalFiltersSchema.safeParse({ years: [9999] }).success).toBe(
    false,
  );
  expect(
    extendedLegalFiltersSchema.safeParse({
      documentTypes: Array(13).fill("ley"),
    }).success,
  ).toBe(false);
});

it("conserva filtros entre vistas sin trasladar hechos privados por URL",()=>{
 const params=new URLSearchParams("documentTypes=opinion,directiva&years=2024,2025&regime=no_determinado&includeUnknownRegime=true");
 expect(extendedFiltersFromParams(params)).toEqual({documentTypes:["opinion","directiva"],years:[2024,2025],regime:"no_determinado",includeUnknownRegime:true});
 expect(extendedFiltersFromParams(new URLSearchParams("years=bad&regime=inventado"))).toEqual({});
});

it("traslada solo valores de régimen documentales reconocidos",()=>{
 const href=legalCenterHref("normas",{regime:"32069",documentTypes:["opinion","directiva"],years:[2024,2025],facts:"Dato privado",question:"Dato privado"});
 expect(href).toContain("regime=32069");expect(href).toContain("documentTypes=opinion%2Cdirectiva");expect(href).not.toContain("privado");
 expect(legalCenterHref("chat",{regime:"texto privado",years:["secreto"],includeUnknownRegime:false})).toBe("/chat");
});
