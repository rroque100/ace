import { describe, expect, it } from "vitest";
import {
  estadoIndexacion,
  esDocxEett,
  filtroConsultaDoc,
  normalizarMetadatosRag,
  queryChunks,
  queryChunksTotal,
  validarPertenenciaEett,
} from "@/lib/eett-tdr-analiza";

describe("estadoIndexacion", () => {
  it("un .docx nunca se indexa", () => {
    expect(estadoIndexacion("uploaded", true)).toEqual({
      label: "No indexado",
      tone: "muted",
      razon: "Los .docx no entran en el RAG; solo se indexan los PDF.",
    });
    expect(estadoIndexacion("indexed", true).tone).toBe("muted");
  });

  it.each([
    ["uploaded", "Subido", "pending"],
    ["processing", "Procesando", "info"],
    ["indexed", "Indexado", "ok"],
    ["error", "Error", "error"],
  ] as const)("status %s -> %s / %s", (status, label, tone) => {
    const r = estadoIndexacion(status, false);
    expect(r.label).toBe(label);
    expect(r.tone).toBe(tone);
  });
});

describe("esDocxEett", () => {
  it("cierra por extensión sin importar mayúsculas", () => {
    expect(esDocxEett("tdr.docx")).toBe(true);
    expect(esDocxEett("tdr.DOCX")).toBe(true);
    expect(esDocxEett("tdr.pdf")).toBe(false);
  });
});

describe("validarPertenenciaEett", () => {
  const doc = (necesidadId: string, kind: string) => ({ metadata: { necesidadId, kind } });
  it("pertenece cuando coincide necesidadId y kind", () => {
    expect(validarPertenenciaEett(doc("N1", "eett_tdr"), "N1")).toBe(true);
  });
  it("no pertenece si la necesidad es otra", () => {
    expect(validarPertenenciaEett(doc("N1", "eett_tdr"), "N2")).toBe(false);
  });
  it("no pertenece si no es EETT/TDR", () => {
    expect(validarPertenenciaEett(doc("N1", "ley"), "N1")).toBe(false);
  });
  it("no pertenece si falta metadata", () => {
    expect(validarPertenenciaEett({ metadata: null }, "N1")).toBe(false);
    expect(validarPertenenciaEett({}, "N1")).toBe(false);
  });
});

describe("queryChunks", () => {
  it("pagina por chunk_index y respeta limit/offset", () => {
    expect(queryChunks("D1", { page: 1, limit: 20 })).toBe(
      "document_chunks?document_id=eq.D1&select=id,chunk_index,page_start,page_end,content,token_count,metadata&order=chunk_index.asc&limit=20&offset=0",
    );
    expect(queryChunks("D1", { page: 2, limit: 10 })).toMatch(/&limit=10&offset=10$/);
  });
  it("filtra por contenido cuando llega q", () => {
    expect(queryChunks("D1", { q: "plazo", page: 1, limit: 20 })).toMatch(
      /&content=ilike\.\*plazo\*/,
    );
  });
  it("no filtra por q vacío", () => {
    expect(queryChunks("D1", { q: "  ", page: 1, limit: 20 })).not.toContain("content=ilike");
  });
});

describe("queryChunksTotal", () => {
  it("cuenta con limit=0 sobre la misma raíz", () => {
    expect(queryChunksTotal("D1")).toBe(
      "document_chunks?document_id=eq.D1&select=id&limit=0",
    );
  });
});

describe("filtroConsultaDoc", () => {
  it("ancla la recuperación a un solo documento", () => {
    expect(filtroConsultaDoc("D1")).toEqual({ documentId: "D1" });
  });
});

describe("normalizarMetadatosRag", () => {
  it("aplana pinecone y normaliza flags", () => {
    const m = normalizarMetadatosRag({
      extractionMethod: "openai-ocr",
      ocrPartial: true,
      indexedTextComplete: false,
      pageCount: 30,
      chunkCount: 42,
      pinecone: { namespace: "legal-documents", recordCount: 42 },
      contentHash: "abc",
      indexingPipelineVersion: "legal-page-aware-v2",
    });
    expect(m).toEqual({
      extractionMethod: "openai-ocr",
      ocrParcial: true,
      indexedTextComplete: false,
      pageCount: 30,
      chunkCount: 42,
      recordCount: 42,
      namespace: "legal-documents",
      contentHash: "abc",
      pipelineVersion: "legal-page-aware-v2",
    });
  });
  it("metadata ausente -> valores por defecto seguros", () => {
    const m = normalizarMetadatosRag(null);
    expect(m.ocrParcial).toBe(false);
    expect(m.indexedTextComplete).toBe(true);
    expect(m.recordCount).toBeUndefined();
  });
});
