import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), rest: vi.fn(), userRest: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({ getOpenAIClient: () => ({ responses: { create: mocks.create } }), legalAnswerModel: "test" }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: mocks.userRest, writeAuditLog: async () => {}, institutionalAuditDetails: (x: unknown) => x }));
import { answerLegalQuestion, chatRequestSchema, clearLexicalCache } from "@/lib/legal-chat";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública. Solo importa de qué norma viene cada fragmento.
const fila = (id: string, titulo: string, numero: string, contenido: string) => ({
  id, document_id: `doc-${id}`, chunk_index: 0, pinecone_vector_id: `v-${id}`, page_start: 3, page_end: 3, content: contenido, metadata: { article: id === "vigente" ? "12" : "189" },
  documents: { id: `doc-${id}`, title: titulo, document_type: "reglamento", source_entity: "MEF", file_name: `${id}.pdf`, status: "indexed", metadata: { document_number: numero } },
});
const vigente = fila("vigente", "Reglamento de la ley general de contrataciones publicas 32069", "009-2025-EF",
  "Artículo 12. La comisión sintética corre por cuenta de quien demora.");
// La derogada repite casi literal las DOS partes de la pregunta: por coincidencia de palabras gana como semilla de ambas.
const derogada = fila("derogada", "Decreto Supremo N.° 344-2018-EF — Reglamento de la Ley N.° 30225", "344-2018-EF",
  "Artículo 189. Si se atrasa la obra sintética, la comisión sintética de supervisión la asume quien causa el atraso. Cuando la valorización sintética acumulada es menor a lo programado el supervisor sintético ordena un calendario sintético acelerado nuevo de la obra sintética.");

describe("las semillas de cada parte respetan el régimen de la pregunta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLexicalCache();
    mocks.search.mockResolvedValue([{ _id: "v-vigente", _score: 0.9 }, { _id: "v-derogada", _score: 0.92 }]);
    mocks.rest.mockResolvedValue([vigente, derogada]);
    mocks.userRest.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ output_text: "La comisión sintética de supervisión la asume quien causa el atraso de la obra sintética [F1]" });
  });

  it("sin nombrar una ley, la parte que mejor casa con la norma derogada no la mete en las fuentes", async () => {
    await answerLegalQuestion(chatRequestSchema.parse({
      question: "¿Quién asume la comisión sintética de supervisión si se atrasa la obra sintética y qué ordena el supervisor sintético cuando la valorización sintética acumulada es menor a lo programado?",
    }), { ownerId: "alice", accessToken: "jwt", persist: false });
    const generacion = mocks.create.mock.calls.map(([params]) => params as { input: Array<{ content: string }> })
      .find((params) => params.input?.[1]?.content?.includes("Fuentes recuperadas:"));
    expect(generacion, "llegó a generar").toBeTruthy();
    const fuentes = generacion!.input[1].content;
    expect(fuentes).toContain("32069");
    expect(fuentes).not.toMatch(/344-2018/);
  });
});
