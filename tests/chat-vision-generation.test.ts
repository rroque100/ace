import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  rest: vi.fn(),
  userRest: vi.fn(),
  create: vi.fn(),
  readCaseFile: vi.fn(),
}));

vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({
  getOpenAIClient: () => ({ responses: { create: mocks.create } }),
  legalAnswerModel: "text-test-model",
  legalAnswerVisionModel: "vision-test-model",
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseRest: mocks.rest,
  supabaseUserRest: mocks.userRest,
  writeAuditLog: async () => {},
  institutionalAuditDetails: (value: unknown) => value,
}));
vi.mock("@/lib/chat-case-attachments", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/chat-case-attachments")>(),
  readCaseFile: mocks.readCaseFile,
}));

import { answerLegalQuestion, chatRequestSchema } from "@/lib/legal-chat";

const session = "00000000-0000-4000-8000-000000000001";
const attachmentId = "00000000-0000-4000-8000-000000000002";
const auth = { ownerId: "alice", accessToken: "jwt", persist: false };
const imageText = "La tabla indica Área usuaria | S/ 250 | requerimiento.";
const alternativeText = "¿Qué elemento debe contener el requerimiento? a) La propuesta de factores de evaluación b) La propuesta de modalidad de pago";
const legalExcerpt = "Artículo 44. El requerimiento contiene la propuesta de modalidad de pago como condición de contratación.";
let nextDraftResponse: string | null = null;
let caseReviewStatus: "supported" | "insufficient" = "supported";

function makeGenerationResponse(question: string) {
  if (question.startsWith("Resuelve esto")) {
    return JSON.stringify({
      choice: "b",
      options: [
        { key: "a", status: "does_not_answer", reason: "No coincide con el pasaje." },
        { key: "b", status: "answers", reason: "Coincide con el pasaje." },
      ],
      evidence: [{ source: 1, quote: "propuesta de modalidad de pago" }],
      reason: "El pasaje incluye esa propuesta.",
    });
  }
  return "Respuesta de prueba con respaldo [F1].";
}

beforeEach(() => {
  vi.clearAllMocks();
  nextDraftResponse = null;
  caseReviewStatus = "supported";
  mocks.search.mockResolvedValue([{ _id: "vector", _score: 0.95 }]);
  mocks.rest.mockResolvedValue([{
    id: "chunk",
    document_id: "doc",
    chunk_index: 0,
    pinecone_vector_id: "vector",
    page_start: 24,
    page_end: 24,
    content: legalExcerpt,
    metadata: { article: "44" },
    documents: {
      id: "doc",
      title: "Reglamento de prueba",
      document_type: "reglamento",
      source_entity: "OECE",
      file_name: "reglamento.pdf",
      status: "indexed",
      metadata: {},
    },
  }]);
  mocks.userRest.mockImplementation(async (_token: string, path: string, options?: { method?: string }) => {
    if (path.startsWith("chat_sessions?")) return [{ id: session }];
    if (path.includes("kind=eq.case_attachment")) return [{
      id: attachmentId,
      metadata: {
        kind: "case_attachment",
        name: "enunciado.png",
        mime: "image/png",
        storagePath: `case-attachments/alice/${session}/${attachmentId}.png`,
        text: imageText,
        partial: true,
      },
    }];
    if (path === "chat_messages" && options?.method === "POST") return [{ id: "assistant", role: "assistant" }];
    return [];
  });
  mocks.readCaseFile.mockResolvedValue(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]));
  mocks.create.mockImplementation(async (params: { input: Array<{ role?: string; content: string | Array<{ type: string; text?: string }> }> }) => {
    const system = params.input[0]?.content;
    const systemText = typeof system === "string" ? system : "";
    const user = params.input.find((message) => message.role === "user")?.content;
    const payloadText = typeof user === "string" ? user : "";
    if (systemText.includes("revisor de fidelidad de lectura documental")) {
      const payload = JSON.parse(payloadText) as { claims: Array<{ id: number }>; sources: Array<{ excerpt: string }> };
      return { output_text: JSON.stringify({ claims: payload.claims.map((claim) => ({
        id: claim.id,
        status: caseReviewStatus,
        reason: "Cotejo con la transcripción OCR.",
        evidence: caseReviewStatus === "supported" ? [{ source: 1, quote: payload.sources[0].excerpt }] : [],
      })) }) };
    }
    if (systemText.includes("Eres un revisor de evidencia")) {
      const payload = JSON.parse(payloadText) as {
        claims: Array<{ id: number; markers: number[] }>;
        sources: Array<{ excerpt: string }>;
      };
      return { output_text: JSON.stringify({ claims: payload.claims.map((claim) => ({
        id: claim.id,
        status: "supported",
        reason: "Cotejo con la fuente oficial.",
        evidence: [{ source: claim.markers[0], quote: payload.sources[claim.markers[0] - 1].excerpt }],
      })) }) };
    }
    const text = params.input.flatMap((message) => typeof message.content === "string"
      ? [message.content]
      : message.content.filter((part): part is { type: "input_text"; text: string } => part.type === "input_text").map((part) => part.text)).join("\n");
    const question = text.includes("Resuelve esto") ? "Resuelve esto" : "";
    const output = nextDraftResponse ?? makeGenerationResponse(question);
    nextDraftResponse = null;
    return { output_text: output };
  });
});

async function generate(question: string, ocr = imageText, persist = false) {
  mocks.userRest.mockImplementation(async (_token: string, path: string, options?: { method?: string }) => {
    if (path.startsWith("chat_sessions?")) return [{ id: session }];
    if (path.includes("kind=eq.case_attachment")) return [{
      id: attachmentId,
      metadata: {
        kind: "case_attachment",
        name: "enunciado.png",
        mime: "image/png",
        storagePath: `case-attachments/alice/${session}/${attachmentId}.png`,
        text: ocr,
        partial: true,
      },
    }];
    if (path === "chat_messages" && options?.method === "POST") return [{ id: "assistant", role: "assistant" }];
    return [];
  });
  const input = chatRequestSchema.parse({ question, sessionId: session, attachmentIds: [attachmentId] });
  return answerLegalQuestion(input, { ...auth, persist });
}

function generationCall() {
  return mocks.create.mock.calls.find(([params]) => params.input.some((message: { role: string }) => message.role === "user"));
}

function userMessage(call: ReturnType<typeof generationCall>) {
  return call?.[0].input.find((message: { role: string }) => message.role === "user");
}

it.each([
  ["normal", "Analiza esta imagen adjunta y dime qué dice.", imageText],
  ["comparison", "Compara la Ley 30225 con la Ley 32069 según este documento.", imageText],
] as const)("envía el adjunto al modelo de visión en modo %s", async (_mode, question, ocr) => {
  await generate(question, ocr);
  const call = generationCall();
  expect(call?.[0].model).toBe("vision-test-model");
  expect(userMessage(call)?.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "input_text" }),
    expect.objectContaining({ type: "input_image", detail: "auto" }),
  ]));
  expect(call?.[0].input[0].content).toContain("enunciados y preguntas impresos");
  expect(call?.[0].input[0].content).toContain("objeto de la consulta");
});

it("detecta alternativas desde OCR, envía imagen y conserva la pregunta original del turno", async () => {
  const result = await generate("Resuelve esto", alternativeText, true);
  const call = generationCall();
  expect(call?.[0].model).toBe("vision-test-model");
  expect(userMessage(call)?.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "input_text" }),
    expect.objectContaining({ type: "input_image" }),
  ]));
  const generatedText = userMessage(call)?.content.find((part: { type: string }) => part.type === "input_text").text;
  expect(generatedText).toContain("Pregunta con alternativas");
  expect(generatedText).toContain("Resuelve esto");
  expect(call?.[0].input[0].content).toContain("enunciados y preguntas impresos");
  expect(call?.[0].input[0].content).toContain("objeto de la consulta");
  expect(result.answer).toContain("Alternativa correcta: b) La propuesta de modalidad de pago [F1]");
  const persistedCall = mocks.userRest.mock.calls.find(([, path, options]) => path === "chat_messages" && options?.method === "POST");
  const persistedRows = JSON.parse(persistedCall?.[2].body as string);
  expect(persistedRows[0].content).toBe("Resuelve esto");
});

it("publica por separado la lectura OCR [C1] y el análisis normativo [F1]", async () => {
  nextDraftResponse = "**Lectura del documento**\nEn el documento se lee: Área usuaria | S/ 250 | requerimiento [C1]\n\n**Análisis normativo**\nEl expediente contiene el requerimiento final [F1]";

  const result = await generate("¿Qué dice el documento y qué regla aplica?", "Área usuaria | S/ 250 | requerimiento");
  const call = generationCall();
  const publishedReading = result.answer.indexOf("Lectura del documento");
  const publishedLegalClaim = result.answer.indexOf("El expediente contiene el requerimiento final");
  const caseReviewCall = mocks.create.mock.calls.find(([params]) => params.input[0].content.includes("revisor de fidelidad de lectura documental"));
  const officialReviewCall = mocks.create.mock.calls.find(([params]) => params.input[0].content.includes("Eres un revisor de evidencia"));
  const casePayload = JSON.parse(caseReviewCall?.[0].input[1].content as string);
  const officialPayload = JSON.parse(officialReviewCall?.[0].input[1].content as string);

  expect(mocks.search.mock.calls[0][0]).toContain("documento");
  expect(mocks.search.mock.calls[0][0]).toContain("area usuaria");
  expect(mocks.search.mock.calls[0][0]).toContain("requerimiento");
  expect(casePayload.claims).toHaveLength(1);
  expect(casePayload.claims[0].text).toContain("Área usuaria | S/ 250 | requerimiento");
  expect(casePayload.claims[0].text).not.toContain("expediente contiene");
  expect(casePayload.sources[0].excerpt).toBe("Área usuaria | S/ 250 | requerimiento");
  expect(officialPayload.claims).toHaveLength(1);
  expect(officialPayload.claims[0].text).toContain("expediente contiene el requerimiento final");
  expect(officialPayload.claims[0].text).not.toContain("Área usuaria");
  expect(officialPayload.sources[0].excerpt).toBe(legalExcerpt);
  expect(call?.[0].model).toBe("vision-test-model");
  expect(call?.[0].input.some((message: { content: unknown }) => Array.isArray(message.content)
    && message.content.some((part: { type: string }) => part.type === "input_image"))).toBe(true);
  expect(result.answer).toContain("Área usuaria | S/ 250 | requerimiento");
  expect(result.answer).toContain("El expediente contiene el requerimiento final [F1]");
  expect(publishedReading).toBeGreaterThanOrEqual(0);
  expect(publishedReading).toBeLessThan(publishedLegalClaim);
  expect(result.answer.slice(publishedLegalClaim).split("**Documentos del caso")[0]).not.toContain("[C1]");
  expect(result.answer).toContain("Documentos del caso · no son fuentes normativas");
});

it("deja una lectura visual no confirmada pendiente de cotejo cuando el OCR es ilegible", async () => {
  nextDraftResponse = "**Lectura del documento**\nÁrea usuaria: S/ 80 [C1]\n\n**Análisis normativo**\nEl expediente contiene el requerimiento final [F1]";
  caseReviewStatus = "insufficient";

  const result = await generate(
    "¿Qué dice el documento y qué regla aplica?",
    "No se detectó texto legible; revisa el original y analiza la imagen visualmente.",
  );
  const call = generationCall();
  expect(result.answer).not.toContain("En el documento se lee: Área usuaria: S/ 80 [C1]");
  expect(result.answer).not.toContain("**Lectura del documento**");
  expect(result.answer).toContain("Lectura visual pendiente de cotejo");
  expect(result.answer).toContain("La lectura visual pendiente parece indicar: Área usuaria: S/ 80 [C1]");
  expect(result.answer).toMatch(/revisa el original/i);
  expect(result.answer).toContain("El expediente contiene el requerimiento final [F1]");
  expect(call?.[0].input.some((message: { content: unknown }) => Array.isArray(message.content)
    && message.content.some((part: { type: string }) => part.type === "input_image"))).toBe(true);
});

it("mantiene modelo y content string en una solicitud sin adjuntos", async () => {
  await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo revisar un recurso de apelación?" }), auth);
  const call = generationCall();
  expect(call?.[0].model).toBe("text-test-model");
  expect(userMessage(call)?.content).toBeTypeOf("string");
  expect(call?.[0].input.flatMap((message: { content: unknown }) => Array.isArray(message.content) ? message.content : [])
    .some((part: { type: string }) => part.type === "input_image")).toBe(false);
  expect(call?.[0].input[0].content).not.toContain("enunciados y preguntas impresos");
});
