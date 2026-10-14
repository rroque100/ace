import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), rest: vi.fn(), userRest: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({ getOpenAIClient: () => ({ responses: { create: mocks.create } }), legalAnswerModel: "test" }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: mocks.userRest, writeAuditLog: async () => {}, institutionalAuditDetails: (x: unknown) => x }));
import { answerLegalQuestion, streamLegalAnswer, chatRequestSchema } from "@/lib/legal-chat";
const context = { regime: "No determinado", dates: "Fecha pendiente", facts: "Se necesita revisar la admisibilidad del recurso" };
const auth = { ownerId: "alice", accessToken: "jwt", persist: false };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue([{ _id: "vector", _score: 0.95 }]);
  mocks.rest.mockResolvedValue([{
    id: "chunk", document_id: "doc", chunk_index: 0, pinecone_vector_id: "vector", page_start: 2, page_end: 2,
    content: "Admisibilidad del recurso de apelación. Las fuentes del recurso deben revisarse. ".repeat(12), metadata: {},
    documents: { id: "doc", title: "Acuerdo de Sala Plena", document_type: "acuerdo_sala_plena", source_entity: "OECE", file_name: "acuerdo.pdf", status: "indexed", metadata: { vigencia: "desconocida" } },
  }]);
  mocks.userRest.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ output_text: "Orientación con fuentes [F1]. Información faltante: régimen y fechas." });
});
it("mantiene compatibles las solicitudes anteriores", () => {
  expect(chatRequestSchema.safeParse({ question: "Consulta general" }).success).toBe(true);
  expect(chatRequestSchema.safeParse({ question: "Consulta", caseContext: { facts: "a".repeat(6001) } }).success).toBe(false);
});
it("declara datos y fuentes faltantes sin generar una conclusión cuando no hay evidencia", async () => {
  mocks.search.mockResolvedValue([]);
  mocks.rest.mockResolvedValue([]);
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth);
  expect(result.answer).toContain("Información faltante y límites");
  expect(result.answer).toContain("régimen aplicable, fechas relevantes, hechos del caso");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("aplica contexto a búsqueda y reglas de evidencia al generador sin imponer régimen fijo", async () => {
  await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?", caseContext: context }), auth);
  expect(mocks.search.mock.calls[0][0]).toContain("admisibilidad");
  const params = mocks.create.mock.calls[0][0];
  expect(params.input[0].content).toContain("Responde solo con las fuentes disponibles");
  expect(params.input[0].content).toContain("Información faltante y límites");
  expect(params.input[0].content).not.toContain("El marco vigente es");
  expect(params.input[1].content).toContain(JSON.stringify(context));
  expect(params.input[1].content).toContain("Acuerdo de Sala Plena, pagina 2");
  expect(mocks.userRest).not.toHaveBeenCalled();
});
it("aplica la misma regla al streaming", async () => {
  mocks.create.mockImplementation(async () => (async function* () { yield { type: "response.output_text.delta", delta: "Respuesta [F1]" }; })());
  const events = [];
  for await (const event of streamLegalAnswer(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?", caseContext: context }), auth)) events.push(event);
  expect(mocks.create.mock.calls[0][0].input[0].content).toContain("cita documento y página");
  expect(mocks.create.mock.calls[0][0].stream).toBe(true);
  expect(events.at(-1)?.type).toBe("done");
});

it("guarda contexto con cada turno mediante el JWT del usuario", async () => {
  mocks.userRest.mockImplementation(async (_token: string, path: string, options?: { method?: string }) => {
    if (path === "chat_sessions" && options?.method === "POST") return [{ id: "session" }];
    if (path === "chat_messages" && options?.method === "POST") return [{ id: "assistant", role: "assistant" }];
    return [];
  });
  await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?", caseContext: context }), { ...auth, persist: true });
  const call = mocks.userRest.mock.calls.find((call) => call[1] === "chat_messages");
  expect(call?.[0]).toBe("jwt");
  const rows = JSON.parse(call?.[2].body);
  expect(rows[0].metadata.caseContext).toEqual(context);
  expect(rows[1].metadata.caseContext).toEqual(context);
});
