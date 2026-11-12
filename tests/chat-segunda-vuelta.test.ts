import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: async () => [], rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({ getOpenAIClient: () => ({ responses: { create: vi.fn() } }), legalAnswerModel: "test" }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: vi.fn(async () => []), writeAuditLog: async () => {},
  institutionalAuditDetails: (x: unknown) => x, tragarPeroRegistrar: (contexto: string) => (error: unknown) => mocks.log(contexto, error) }));
import { refineAnswerSources, type LegalSource } from "@/lib/legal-chat";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const fuente = (chunkId: string, excerpt: string, extra: Partial<LegalSource> = {}) =>
  ({ chunkId, documentId: "doc-1", documentTitle: "Documento sintético", article: null, excerpt, pageStart: 3, pageEnd: 3, pageCount: 50, citation: "", ...extra }) as LegalSource;
const partes = ["Qué porcentaje debe tener la constancia sintética", "cuándo puede reducirse en expedientes de prueba constancia sintética"];
const tema = fuente("tema", "La constancia sintética equivale al diez por ciento del importe del expediente.");
const otra = fuente("otra", "La constancia sintética se presenta antes de firmar el acta.");
const reduccion = fuente("reduccion", "En expedientes de prueba, la constancia sintética puede reducirse a la mitad desde la recepción.");
const ajena = fuente("ajena", "El acta sintética se archiva al cierre del periodo.");
const opciones = (search: (query: string) => Promise<LegalSource[]>, extra: Partial<Parameters<typeof refineAnswerSources>[1]> = {}) =>
  ({ query: "¿Qué porcentaje debe tener la constancia sintética?", parts: partes, limit: 8, search, accept: () => true, ...extra });

beforeEach(() => { vi.clearAllMocks(); mocks.rest.mockResolvedValue([]); });

describe("segunda vuelta (caso real: «¿qué porcentaje… y cuándo puede reducirse en obras?» sin ninguna fuente de la reducción)", () => {
  it("busca otra vez la parte sin fuente y añade la que mejor la cubre", async () => {
    const search = vi.fn(async () => [ajena, reduccion]);
    const resultado = await refineAnswerSources([tema, otra], opciones(search));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(partes[1]);
    expect(resultado.map((item) => item.chunkId)).toEqual(["tema", "otra", "reduccion"]);
  });

  it("con el máximo de fuentes ya ocupado, deja sitio quitando la última", async () => {
    const resultado = await refineAnswerSources([tema, otra], opciones(async () => [reduccion], { limit: 2 }));
    expect(resultado.map((item) => item.chunkId)).toEqual(["tema", "reduccion"]);
  });

  it("si todas las partes tienen fuente, no busca nada más", async () => {
    const search = vi.fn(async () => [ajena]);
    await refineAnswerSources([tema, reduccion], opciones(search));
    expect(search).not.toHaveBeenCalled();
  });

  it("no añade una fuente que no cubre la parte, ni una que el filtro rechaza (régimen especial, otro proceso, otra familia)", async () => {
    expect((await refineAnswerSources([tema], opciones(async () => [ajena]))).map((item) => item.chunkId)).toEqual(["tema"]);
    expect((await refineAnswerSources([tema], opciones(async () => [reduccion], { accept: () => false }))).map((item) => item.chunkId)).toEqual(["tema"]);
  });

  it("no repite una fuente que ya estaba", async () => {
    const resultado = await refineAnswerSources([tema, otra], opciones(async () => [tema, otra]));
    expect(resultado).toHaveLength(2);
  });

  it("si la búsqueda falla, se queda lo que había y se registra", async () => {
    const resultado = await refineAnswerSources([tema], opciones(async () => { throw new Error("402"); }));
    expect(resultado.map((item) => item.chunkId)).toEqual(["tema"]);
    expect(mocks.log).toHaveBeenCalledWith("segunda-vuelta", expect.any(Error));
  });
});

describe("ventana del artículo completo dentro del chat", () => {
  const articulo = { document_id: "doc-1", article_number: "7", page_start: 3, page_end: 4,
    content: "Artículo 7. La constancia sintética equivale al diez por ciento del importe. Puede reducirse a la mitad en expedientes de prueba desde la recepción." };

  it("pide a norma_articulos el artículo de cada fuente y rehace la cita con las páginas del artículo", async () => {
    mocks.rest.mockResolvedValue([articulo]);
    const base = fuente("tema", "Artículo 7. La constancia sintética equivale al diez por ciento del importe.", { article: "7" });
    const [ampliada] = await refineAnswerSources([base], opciones(vi.fn(async () => []), { query: "¿Cuándo puede reducirse la constancia sintética en expedientes de prueba?", parts: [] }));
    expect(mocks.rest.mock.calls[0][0]).toMatch(/^norma_articulos\?document_id=in\.\("doc-1"\)&article_number=in\./);
    expect(ampliada.excerpt).toContain("Puede reducirse a la mitad");
    expect(ampliada).toMatchObject({ pageStart: 3, pageEnd: 4 });
    expect(ampliada.citation).toMatch(/paginas 3-4/);
    expect("widenedToArticle" in ampliada).toBe(false);
  });

  it("sin artículo en ninguna fuente no consulta la base de datos", async () => {
    await refineAnswerSources([tema], opciones(vi.fn(async () => []), { parts: [] }));
    expect(mocks.rest).not.toHaveBeenCalled();
  });

  it("si la lectura falla, se queda el extracto del fragmento y se registra", async () => {
    mocks.rest.mockRejectedValue(new Error("timeout"));
    const base = fuente("tema", "Artículo 7. La constancia sintética equivale al diez por ciento del importe.", { article: "7" });
    const [igual] = await refineAnswerSources([base], opciones(vi.fn(async () => []), { parts: [] }));
    expect(igual).toBe(base);
    expect(mocks.log).toHaveBeenCalledWith("articulo-completo", expect.any(Error));
  });
});
