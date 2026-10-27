import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: async () => [], writeAuditLog: async () => {}, institutionalAuditDetails: (x: unknown) => x }));
import { searchLegalSources } from "@/lib/legal-chat";
const query = "Acuerdo de Sala Plena N.° 003-2025/TCP admisibilidad";
const original = { id: "original", title: "Acuerdo de Sala Plena 003-2025/TCP", document_type: "acuerdo_sala_plena", metadata: { number: "003-2025/TCP", pageCount: 4 } };
const chunk = (id: string, originalDocument = false) => ({ id, document_id: originalDocument ? "original" : "other", chunk_index: 0, content: "Admisibilidad del recurso de apelación. Acuerdo de Sala Plena 003-2025/TCP. ".repeat(10), metadata: {}, page_start: 2, page_end: 2, pinecone_vector_id: id, documents: originalDocument ? { ...original, status: "indexed", file_name: "a.pdf", source_entity: "TCP" } : { id: "other", title: "Resolución 7395-2025/TCP", document_type: "resolucion", metadata: {}, status: "indexed", file_name: "r.pdf", source_entity: "TCP" } });
beforeEach(() => { vi.clearAllMocks(); mocks.search.mockResolvedValue([]); });
it("antepone el original aunque otra resolución mencione su identificador", async () => {
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("documents?") ? [original] : path.includes("document_id=in.") ? [chunk("exact", true)] : [chunk("related")]);
  const result = await searchLegalSources({ query, topK: 5 });
  expect(result.sources[0]).toMatchObject({ documentId: "original", requestedOriginal: true, pageCount: 4 });
  expect(result.sources.find((source) => source.documentId === "other")?.requestedOriginal).toBe(false);
  expect(result.sources.find((source) => source.documentId === "other")?.referenceRelation).toBe("cites_requested");
  expect(result.assessment.exactDocument?.status).toBe("found");
  expect(mocks.rest.mock.calls[0][0]).toContain("es_institucional=eq.true");
});
it("declara original no recuperado sin atribuir una mención al documento original", async () => {
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("documents?") ? [] : [chunk("related")]);
  const result = await searchLegalSources({ query, topK: 5 });
  expect(result.assessment.exactDocument?.status).toBe("not_retrieved");
  expect(result.assessment.confidence).toBe("baja");
  expect(result.assessment.evidenceWarnings.join(" ")).toContain("referencias indirectas");
});
it("distingue fallo del catálogo de ausencia del original", async () => {
  mocks.rest.mockImplementation(async (path: string) => { if (path.startsWith("documents?")) throw new Error("offline"); return [chunk("related")]; });
  expect((await searchLegalSources({ query, topK: 5 })).assessment.exactDocument?.status).toBe("unavailable");
});
it("no presenta un fallo total de recuperación como búsqueda sin coincidencias", async () => {
  mocks.rest.mockRejectedValue(new Error("offline")); mocks.search.mockRejectedValue(new Error("offline"));
  await expect(searchLegalSources({ query, topK: 5 })).rejects.toThrow("recuperación documental no está disponible");
});
it("respeta el documento elegido aunque exista otro original en el catálogo", async () => {
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("documents?") ? [original] : path.includes("document_id=in.") ? [chunk("exact", true)] : [chunk("related")]);
  const result = await searchLegalSources({ query, topK: 5, filters: { documentId: "other" } });
  expect(result.sources.every((source) => source.documentId === "other")).toBe(true);
  expect(result.assessment.exactDocument?.status).toBe("not_retrieved");
});

it("aplica candidatos permitidos en Pinecone antes de recuperar y evita el respaldo global cuando el índice lo sustituye",async()=>{
 mocks.rest.mockResolvedValue([]);
 await searchLegalSources({query:"garantía contractual",topK:5},{allowedDocumentIds:["original"],indexedLexical:true});
 expect(mocks.search.mock.calls[0][2]).toMatchObject({documentIds:["original"]});
 expect(mocks.rest).not.toHaveBeenCalled();
});
