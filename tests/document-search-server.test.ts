import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), semantic: vi.fn(), indexed: vi.fn(), candidates: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: (path: string, options?: unknown) => path === "rpc/ace_search_documents_page_v2" ? mocks.indexed(path,options) : path === "rpc/ace_search_candidates_v3" ? mocks.candidates(path,options) : mocks.rest(path,options) }));
vi.mock("@/lib/legal-chat", () => ({ searchLegalSources: mocks.semantic }));
// La búsqueda por régimen consulta `documents?` para ubicar la Ley y el Reglamento de cada régimen; este test comprueba que el
// FILTRADO de candidatos no baja el catálogo, así que esa búsqueda de ids se aísla aquí.
vi.mock("@/lib/regime-documents", () => ({ getRegimeDocumentIds: async () => ({ "32069": [], "30225": [] }) }));
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
  mocks.candidates.mockRejectedValue(new Error("PGRST202 ace_search_candidates_v3 missing"));
  mocks.indexed.mockRejectedValue(new Error("PGRST202 ace_search_documents_page_v2 missing"));
});
it("conserva el título literal incluso cuando contiene numeración o prefijos", async () => {
  mocks.indexed.mockResolvedValue({ documents: [], totalDocuments: 0, page: 1, pages: 0 });
  for (const query of ["Acuerdo de Sala Plena N.° 003-2022-TCE", "Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026", "Directiva-n-0001-2026-ef-5401"]) {
    await searchDocuments(documentSearchRequestSchema.parse({ query }));
    expect(JSON.parse(mocks.indexed.mock.calls.at(-1)![1].body).p_query).toBe(query);
  }
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
it("una página repetida del catálogo falla sin publicar un conteo truncado", async () => {
  mocks.rest.mockResolvedValue(Array(500).fill(rows[0]));
  await expect(loadSearchCatalogue()).rejects.toThrow("no avanzó");
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
  expect(response.warnings.join(" ")).toContain("no cuenta todas");
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

it("pagina catálogos superiores a 2000 con cursor sin perder documentos",async()=>{
 for(let page=0;page<5;page++) mocks.rest.mockResolvedValueOnce(Array.from({length:500},(_,i)=>({...rows[0],id:String(page*500+i).padStart(6,"0")})));
 mocks.rest.mockResolvedValueOnce([]);
 expect(await loadSearchCatalogue()).toHaveLength(2500);
 expect(mocks.rest.mock.calls[1][0]).toContain("id=gt.000499");
});
it("el índice filtra y pagina sin descargar el catálogo completo",async()=>{
 mocks.indexed.mockResolvedValue({documents:[{row:rows[0],matches:[],rank:100,matchCount:0,titleMatch:true}],totalDocuments:2501,page:2,pages:251});
 mocks.rest.mockResolvedValue([]);
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"Opinión 123",page:2,filters:{documentType:"opinion",year:2026}}));
 expect(result.engine).toBe("indexed");expect(result.totalDocuments).toBe(2501);
 expect(mocks.rest.mock.calls.every(call=>!String(call[0]).startsWith("documents?"))).toBe(true);
 expect(JSON.parse(mocks.indexed.mock.calls[0][1].body)).toMatchObject({p_page:2,p_filters:{documentType:"opinion",year:2026}});
});
it("un fallo del índice no se oculta usando la búsqueda anterior",async()=>{
 mocks.indexed.mockRejectedValue(new Error("HTTP 503 database unavailable"));
 await expect(searchDocuments(documentSearchRequestSchema.parse({query:"texto"}))).rejects.toThrow("503");expect(mocks.rest).not.toHaveBeenCalled();
});

it("filtra candidatos en el índice y pasa el conjunto antes de recuperar por significado",async()=>{
 mocks.candidates.mockResolvedValue({overflow:false,documents:[rows[0]]});
 mocks.indexed.mockResolvedValue({documents:[],totalDocuments:0,page:1,pages:0});
 mocks.semantic.mockResolvedValue({sources:[],semanticaCaida:false});
 await searchDocuments(documentSearchRequestSchema.parse({query:"garantía contractual",mode:"semantic",filters:{documentType:"opinion"}}));
 expect(JSON.parse(mocks.candidates.mock.calls[0][1].body).p_filters.documentType).toBe("opinion");
 expect(mocks.semantic.mock.calls[0][1]).toMatchObject({allowedDocumentIds:[rows[0].id],indexedLexical:true});
 expect(mocks.rest.mock.calls.some(call=>String(call[0]).startsWith("documents?"))).toBe(false);
});
it("no trunca candidatos ni publica ausencia si el índice falla",async()=>{
 mocks.candidates.mockResolvedValue({overflow:true,documents:[]});
 await expect(searchDocuments(documentSearchRequestSchema.parse({query:"garantía",mode:"semantic"}))).rejects.toThrow("10.000");
 mocks.candidates.mockRejectedValue(new Error("503 offline"));
 await expect(searchDocuments(documentSearchRequestSchema.parse({query:"garantía",mode:"semantic"}))).rejects.toThrow("503");
});
it("conserva documentos por palabras si el proveedor semántico falla",async()=>{
 mocks.candidates.mockResolvedValue({overflow:false,documents:[rows[0]]});
 mocks.indexed.mockResolvedValue({documents:[{row:rows[0],matches:[],rank:1,matchCount:0,titleMatch:true}],totalDocuments:1,page:1,pages:1});
 mocks.rest.mockResolvedValue([]);mocks.semantic.mockRejectedValue(new Error("IA offline"));
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"garantía contractual",mode:"semantic"}));
 expect(result.documents[0].documentId).toBe(rows[0].id);expect(result.documents[0].foundBy).toEqual(["words"]);expect(result.partialRetrieval).toBe(true);
});
it("conserva significado si falla la búsqueda por palabras y avisa",async()=>{
 mocks.candidates.mockResolvedValue({overflow:false,documents:[rows[0]]});
 mocks.indexed.mockRejectedValue(new Error("503 index offline"));
 mocks.semantic.mockResolvedValue({sources:[{documentId:rows[0].id,chunkId:"c",excerpt:"contenido",score:.8}],semanticaCaida:false});
 const result=await searchDocuments(documentSearchRequestSchema.parse({query:"garantía contractual",mode:"semantic"}));
 expect(result.documents[0].foundBy).toEqual(["meaning"]);expect(result.partialRetrieval).toBe(true);
});
