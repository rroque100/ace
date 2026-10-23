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
it("advierte marcadores inexistentes aunque la afirmación no contenga cifras jurídicas", async () => {
  mocks.create.mockResolvedValue({ output_text: "Una conclusión sin respaldo [F99]." });
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth);
  expect(result.assessment.evidenceWarnings.join(" ")).toContain("[F99]");
});
it("declara datos y fuentes faltantes sin generar una conclusión cuando no hay evidencia", async () => {
  mocks.search.mockResolvedValue([]);
  mocks.rest.mockResolvedValue([]);
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth);
  expect(result.answer).toContain("Verificación y límites");
  expect(result.answer).toContain("régimen, fechas, objeto, hechos");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("aplica contexto a búsqueda y reglas de evidencia al generador sin imponer régimen fijo", async () => {
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?", caseContext: context }), auth);
  expect(result.answer).toContain("Acuerdo de Sala Plena · página 2");
  expect(mocks.search.mock.calls[0][0]).toContain("admisibilidad");
  const params = mocks.create.mock.calls[0][0];
  expect(params.input[0].content).toContain("Responde solo con las fuentes disponibles");
  expect(params.input[0].content).toContain("Verificación y límites");
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
  expect(events.some((event) => event.type === "delta" && event.text.includes("Acuerdo de Sala Plena · página 2"))).toBe(true);
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

it("usa documentos C# de la sesión autorizada sin convertirlos en normas F#", async () => {
 const session="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
 mocks.search.mockResolvedValue([]);mocks.rest.mockResolvedValue([]);
 mocks.userRest.mockImplementation(async (_token:string,path:string)=>path.startsWith("chat_sessions?")?[{id:session}]:path.includes("kind=eq.case_attachment")?[{id,metadata:{name:"Caso de prueba.pdf",mime:"application/pdf",storagePath:`case-attachments/alice/${session}/${id}.pdf`,text:"Hecho sintético declarado en el caso.",partial:true}}]:[]);
 const result=await answerLegalQuestion(chatRequestSchema.parse({question:"Resume mi documento del caso, sin conclusión jurídica",sessionId:session,attachmentIds:[id]}),auth);
 expect(mocks.create).toHaveBeenCalled();expect(mocks.create.mock.calls[0][0].input[1].content).toContain("Hecho sintético declarado");expect(mocks.create.mock.calls[0][0].input[1].content).toContain("NO verificados");expect(result.answer).toContain("[C1]");expect(result.sources).toEqual([]);
});

it("rechaza una conversación no autorizada antes de consultar o generar", async () => {
 mocks.userRest.mockResolvedValue([]);
 await expect(answerLegalQuestion(chatRequestSchema.parse({question:"Consulta general sobre un caso",sessionId:"00000000-0000-4000-8000-000000000009"}),auth)).rejects.toThrow("sin permiso");
 expect(mocks.search).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});


it("publica y guarda estados finales solo después de revisar todo el borrador", async () => {
  const draft = "Las fuentes del recurso deben revisarse. [F1]";
  mocks.create.mockResolvedValueOnce({ output_text: draft }).mockResolvedValueOnce({ output_text: JSON.stringify({ claims: [{ id: 1, status: "supported", reason: "Pasaje coincidente", evidence: [{ source: 1, quote: "Las fuentes del recurso deben revisarse." }] }] }) });
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth);
  expect(result.answer).toContain(draft);
  expect(result.assessment.evidenceReview?.documentary).toBe("checked");
  expect(result.assessment.evidenceReview?.applicability).toBe("pending");
  expect(result.confidence).not.toBe("alta");
  expect(result.answer).not.toContain("Nivel de confianza");
});

it("no transmite ninguna parte de una conclusión contradicha antes de sustituirla", async () => {
  const draft = "BORRADOR INSEGURO sobre el recurso [F1]";
  mocks.create.mockResolvedValueOnce((async function* () { yield { type: "response.output_text.delta", delta: draft }; })());
  mocks.create.mockResolvedValueOnce({ output_text: JSON.stringify({ claims: [{ id: 1, status: "contradicted", reason: "El fragmento dice otra cosa", evidence: [] }] }) });
  const events = [];
  for await (const event of streamLegalAnswer(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth)) events.push(event);
  const deltas = events.filter(event => event.type === "delta");
  expect(deltas).toHaveLength(1);
  expect(JSON.stringify(deltas)).not.toContain("BORRADOR INSEGURO");
  expect(deltas[0].text).toContain("Lectura del documento");
  const done = events.at(-1);
  expect(done?.type === "done" && done.assessment?.evidenceReview?.documentary).toBe("unchecked");
  expect(events.findIndex(event => event.type === "progress" && event.stage === "checking")).toBeLessThan(events.findIndex(event => event.type === "delta"));
});

it("persiste el texto revisado y su evidencia con el JWT, nunca el borrador rechazado", async () => {
  mocks.create.mockResolvedValueOnce({ output_text: "BORRADOR RECHAZADO [F1]" }).mockResolvedValueOnce({ output_text: JSON.stringify({ claims: [{ id: 1, status: "insufficient", reason: "No consta", evidence: [] }] }) });
  mocks.userRest.mockImplementation(async (_token: string, path: string, options?: { method?: string }) => {
    if (path === "chat_sessions" && options?.method === "POST") return [{ id: "session" }];
    if (path === "chat_messages" && options?.method === "POST") return [{ id: "assistant", role: "assistant" }];
    return [];
  });
  const result = await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), { ...auth, persist: true });
  const call = mocks.userRest.mock.calls.find(call => call[1] === "chat_messages" && call[2]?.method === "POST");
  const rows = JSON.parse(call?.[2].body);
  expect(call?.[0]).toBe("jwt");
  expect(rows[1].content).toBe(result.answer);
  expect(rows[1].content).not.toContain("BORRADOR RECHAZADO");
  expect(rows[1].metadata.assessment.evidenceReview.documentary).toBe("unchecked");
  expect(rows[1].metadata.assessment.confidence).toBe("baja");
});
