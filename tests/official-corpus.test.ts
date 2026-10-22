import { expect, it } from "vitest";
import { OFFICIAL_CORPUS_TYPES, CORPUS_ANSWER_TYPES, corpusGroupForType, corpusTypesForGroup, corpusSourceKind, corpusOwnArticle } from "../lib/official-corpus";
import { assessProcedureSourceCoverage } from "../lib/procedure-catalog";
import { normalizeDocumentType, resolveDocumentProcessType } from "../lib/documents";
it("admite diez categorías distintas y conserva tipos anteriores", () => {
  expect(new Set(OFFICIAL_CORPUS_TYPES.map(x => x.value)).size).toBe(10);
  for (const x of OFFICIAL_CORPUS_TYPES) expect(normalizeDocumentType(x.value)).toBe(x.value);
  expect(normalizeDocumentType("bases_integradas")).toBe("bases_integradas");
  expect(normalizeDocumentType("contrato")).toBe("contrato");
});
it("distingue orientación y criterios del fundamento normativo", () => {
  expect(corpusSourceKind("ley")).toBe("norma");
  expect(corpusSourceKind("resolucion")).toBe("criterio");
  expect(corpusSourceKind("bases_estandar")).toBe("orientacion");
  expect(corpusTypesForGroup("jurisprudencia")).toContain("pronunciamiento");
  expect(CORPUS_ANSWER_TYPES).toContain("guia_instructivo");
  expect(CORPUS_ANSWER_TYPES).not.toContain("bases_integradas");
  expect(corpusGroupForType("guia_instructivo")).toBe("orientacion");
  expect(corpusGroupForType("acuerdo_sala_plena")).toBe("jurisprudencia");
});
it("una guía no satisface las fuentes críticas de un procedimiento",()=>{
  const result=assessProcedureSourceCoverage("comparacion_precios",[{documentType:"guia_instructivo",documentTitle:"Guía de comparación de precios",vigencia:"vigente"}]);
  expect(result.missingCritical.length).toBeGreaterThan(0);
});
it("no atribuye artículos citados a una opinión, acuerdo o guía",()=>{
  for(const type of ["opinion","acuerdo_sala_plena","resolucion","pronunciamiento","guia_instructivo"]){
    expect(corpusOwnArticle(type,"25")).toBeNull();
  }
  expect(corpusOwnArticle("ley","25")).toBe("25");
});
it("permite directiva transversal explícita y exige proceso a bases estándar", () => {
  expect(resolveDocumentProcessType("directiva", "todos")).toEqual({processType:"todos"});
  expect(resolveDocumentProcessType("bases_estandar", null)).toHaveProperty("error");
});
