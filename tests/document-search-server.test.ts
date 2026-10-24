import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), semantic: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest }));
vi.mock("@/lib/legal-chat", () => ({ searchLegalSources: mocks.semantic }));
import {
  loadSearchCatalogue,
  searchDocuments,
} from "@/lib/document-search-server";
import { documentSearchRequestSchema } from "@/lib/document-search";
const rows = Array.from({ length: 12 }, (_, i) => ({
  id: `doc-${String(i).padStart(2, "0")}`,
  title: `Documento ${i}`,
  document_type: "opinion",
  source_entity: "OECE",
  process_type: "todos",
  metadata: { year: 2020 + (i % 4) },
}));
beforeEach(() => {
  vi.resetAllMocks();
});
it("consulta solo corpus institucional indexado y tipos permitidos", async () => {
  mocks.rest.mockResolvedValueOnce([]);
  await loadSearchCatalogue();
  expect(mocks.rest.mock.calls[0][0]).toContain(
    "es_institucional=eq.true&status=eq.indexed",
  );
  expect(mocks.rest.mock.calls[0][0]).toContain(
    "document_type=in.(ley,reglamento",
  );
});
it("cuenta documentos antes de paginar sin repetirlos", async () => {
  mocks.rest
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(
      rows.map((row) => ({
        documentId: row.id,
        matchCount: 8,
        matches: [],
        titleMatch: false,
      })),
    );
  const response = await searchDocuments(
    documentSearchRequestSchema.parse({ query: "frase", pageSize: 5, page: 2 }),
  );
  expect(response.totalDocuments).toBe(12);
  expect(response.pages).toBe(3);
  expect(response.documents.map((row) => row.documentId)).toEqual(
    rows.slice(5, 10).map((row) => row.id),
  );
  expect(response.scope).toBe("catalogue");
});
it("filtra catálogo antes de enviar ids a SQL y descarta ids inesperados", async () => {
  mocks.rest
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([
      { documentId: "private", matchCount: 1, matches: [] },
    ]);
  const response = await searchDocuments(
    documentSearchRequestSchema.parse({
      query: "frase",
      filters: { year: 2020 },
    }),
  );
  const body = JSON.parse(mocks.rest.mock.calls[1][1].body);
  expect(body.p_ids).toEqual(
    rows.filter((row) => row.metadata.year === 2020).map((row) => row.id),
  );
  expect(response.totalDocuments).toBe(0);
});
it("un fallo SQL no se presenta como ausencia de coincidencias", async () => {
  mocks.rest
    .mockResolvedValueOnce(rows)
    .mockRejectedValueOnce(new Error("offline"));
  await expect(
    searchDocuments(documentSearchRequestSchema.parse({ query: "frase" })),
  ).rejects.toThrow("offline");
});
it("un catálogo fuera del límite falla sin publicar un conteo truncado", async () => {
  mocks.rest.mockResolvedValue(Array(500).fill(rows[0]));
  await expect(loadSearchCatalogue()).rejects.toThrow("límite");
});
it("el modo semántico agrupa fragmentos y declara alcance recuperado", async () => {
  mocks.rest.mockResolvedValueOnce(rows);
  mocks.semantic.mockResolvedValue({
    sources: [
      { documentId: rows[0].id, chunkId: "c1", score: 0.8, excerpt: "a" },
      { documentId: rows[0].id, chunkId: "c2", score: 0.7, excerpt: "b" },
      { documentId: "private", chunkId: "secret", score: 1 },
    ],
    semanticaCaida: false,
  });
  const response = await searchDocuments(
    documentSearchRequestSchema.parse({ query: "pregunta", mode: "semantic" }),
  );
  expect(response.documents).toHaveLength(1);
  expect(response.documents[0].matches).toHaveLength(2);
  expect(response.scope).toBe("retrieved");
  expect(response.warnings[0]).toContain("no cuenta todas");
});

it("exige todas las palabras dentro del mismo documento y elimina duplicados de pasajes",async()=>{
 const hit=(id:string,chunkId:string)=>({documentId:id,matchCount:1,titleMatch:false,matches:[{chunkId,excerpt:"texto sintético",pageStart:1,pageEnd:1,article:null,score:null}]});
 mocks.rest.mockResolvedValueOnce(rows).mockResolvedValueOnce([hit(rows[0].id,"same"),hit(rows[1].id,"other")]).mockResolvedValueOnce([hit(rows[0].id,"same")]);
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"garantía contrato",mode:"all_words"}));
 expect(result.totalDocuments).toBe(1);expect(result.documents[0].matches).toHaveLength(1);expect(result.scope).toBe("catalogue");
 expect(mocks.rest.mock.calls.slice(1).map(call=>JSON.parse(call[1].body).p_query)).toEqual(["garantía","contrato"]);
});
it("reconoce un identificador normalizado sin fabricar un pasaje",async()=>{
 mocks.rest.mockResolvedValueOnce([{...rows[0],metadata:{number:"D000102-2026-OECE-DTN"}}]).mockResolvedValueOnce([]);
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"Opinión N.º D102/2026/OECE/DTN"}));
 expect(result.totalDocuments).toBe(1);expect(result.documents[0].titleMatch).toBe(true);expect(result.documents[0].matches).toEqual([]);
});
it("normaliza consultas de artículo y mantiene el límite institucional",async()=>{
 mocks.rest.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
 await searchDocuments(documentSearchRequestSchema.parse({query:"Art. 17.2"}));
 const body=JSON.parse(mocks.rest.mock.calls[1][1].body);
 expect(body.p_article).toBe("17");expect(body.p_query).toBe("17.2");expect(body.p_ids).toHaveLength(12);
});
it("advierte que la fecha semántica no representa todo el catálogo",async()=>{
 mocks.rest.mockResolvedValueOnce(rows);mocks.semantic.mockResolvedValue({sources:[],semanticaCaida:false});
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"pregunta",mode:"semantic",sort:"newest"}));
 expect(result.warnings.join(" ")).toContain("solo ordena los documentos recuperados");
});

it("hace visible la caída léxica aunque la búsqueda semántica siga disponible",async()=>{
 mocks.rest.mockResolvedValueOnce(rows);
 mocks.semantic.mockResolvedValue({sources:[],semanticaCaida:false,retrieval:{semantic:"available",lexical:"unavailable",catalogue:"available"}});
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"consulta sintética",mode:"semantic"}));
 expect(result.partialRetrieval).toBe(true);
 expect(result.warnings.join(" ")).toContain("palabras no estuvo disponible");
});
