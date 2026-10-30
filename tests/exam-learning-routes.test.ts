import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  get: vi.fn(),
  history: vi.fn(),
  validate: vi.fn(),
  model: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/exam-server", () => ({
  examRpc: m.rpc,
  getExam: m.get,
  validateExamSources: m.validate,
  examError: (e: Error) => ({ message: e.message, status: 400 }),
}));
vi.mock("@/lib/exam-learning-server", () => ({ ownStudyHistory: m.history }));
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdminClient: async () => ({}),
}));
vi.mock("@/lib/openai-server", () => ({
  legalAnswerModel: "fixture-model",
  getProvider: () => "gemini",
  getOpenAIClient: () => ({ responses: { create: m.model } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  getRateLimitKey: () => "",
  RATE_LIMITS: { chat: {} },
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
import { GET, POST } from "../app/api/exams/learning/route";
import { POST as tutor } from "../app/api/exams/tutor/route";
import { GET as source } from "../app/api/exams/documents/[id]/route";
const actor = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  question = "33333333-3333-4333-8333-333333333333";
const req = (body: unknown) =>
  new Request("https://ace.test/api/exams/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: actor, isAdmin: false } });
  m.rpc.mockResolvedValue(id);
  m.history.mockResolvedValue({
    reviews: [],
    attempts: [],
    answers: [],
    limited: false,
  });
  m.get.mockResolvedValue({
    attempt: { state: "active", questions: [{ id: question }] },
    answers: [],
  });
});
it("sin sesión no consulta historial ni modelos", async () => {
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect(
    (await GET(new Request("https://ace.test/api/exams/learning"))).status,
  ).toBe(401);
  expect((await tutor(req({}))).status).toBe(401);
  expect(m.history).not.toHaveBeenCalled();
  expect(m.model).not.toHaveBeenCalled();
});
it("no entrega claves ni intentos privados en el plan", async () => {
  m.history.mockResolvedValue({
    reviews: [],
    attempts: [{ id, questions: [{ correct_option: "SECRETO" }] }],
    answers: [{ option: "SECRETO" }],
    limited: false,
  });
  const r = await GET(new Request("https://ace.test/api/exams/learning"));
  expect(r.status).toBe(200);
  expect(JSON.stringify(await r.json())).not.toContain("SECRETO");
  expect(m.history).toHaveBeenCalledWith(actor);
});
it("la cola editorial exige administración", async () => {
  expect(
    (await GET(new Request("https://ace.test/api/exams/learning?queue=1")))
      .status,
  ).toBe(403);
  expect(m.history).not.toHaveBeenCalled();
});
it("seguimiento editorial no se permite al estudiante", async () => {
  expect(
    (
      await POST(
        req({
          action: "editorial",
          questionId: question,
          revision: 0,
          state: "reviewing",
          note: "Observación suficientemente larga",
        }),
      )
    ).status,
  ).toBe(403);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("checkpoint usa identidad de sesión y no toma actor del navegador", async () => {
  expect(
    (
      await POST(
        req({
          action: "checkpoint",
          attemptId: id,
          questionId: question,
          actor: "otro",
        }),
      )
    ).status,
  ).toBe(200);
  expect(m.auth).toHaveBeenCalledWith({ usesAI: false });
  expect(m.rpc).toHaveBeenCalledWith("ace_exam_checkpoint", {
    p_actor: actor,
    p_id: id,
    p_question: question,
  });
});
it("repaso solo envía los ids propios vencidos y disponibles", async () => {
  m.history.mockResolvedValue({
    reviews: [
      { questionId: question, due: true, available: true, regime: "32069" },
      { questionId: "otro", due: false, available: true, regime: "32069" },
      { questionId: "retirado", due: true, available: false, regime: "32069" },
    ],
  });
  expect(
    (await POST(req({ action: "scheduled", regime: "32069", ids: ["ajeno"] })))
      .status,
  ).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("ace_exam_start_scheduled", {
    p_actor: actor,
    p_ids: [question],
  });
});
it("no inventa un repaso cuando no hay preguntas disponibles", async () => {
  expect(
    (await POST(req({ action: "scheduled", regime: "32069" }))).status,
  ).toBe(409);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("no revela informe de tiempo antes de entregar", async () => {
  expect(
    (
      await GET(
        new Request("https://ace.test/api/exams/learning?attemptId=" + id),
      )
    ).status,
  ).toBe(409);
  expect(m.get).toHaveBeenCalledWith(actor, id);
});
it("el tutor no consulta IA antes de revelar la pregunta", async () => {
  expect(
    (
      await tutor(
        req({ attemptId: id, questionId: question, action: "mistake" }),
      )
    ).status,
  ).toBe(409);
  expect(m.model).not.toHaveBeenCalled();
});
it("el tutor verifica las fuentes y exige referencias existentes", async () => {
  m.get.mockResolvedValue({
    attempt: {
      state: "submitted",
      regime: "32069",
      questions: [
        {
          id: question,
          correctOption: "B",
          sources: [{ documentId: id, quote: "Fixture", pageStart: 1 }],
        },
      ],
    },
    answers: [],
  });
  m.model.mockResolvedValue({
    output_text: JSON.stringify({
      paragraphs: [{ text: "Fixture", sources: [99] }],
      missing: [],
    }),
  });
  expect(
    (
      await tutor(
        req({ attemptId: id, questionId: question, action: "example" }),
      )
    ).status,
  ).toBe(400);
  expect(m.validate).toHaveBeenCalled();
  expect(m.auth).toHaveBeenCalledWith();
});
it("un fallo del proveedor no produce una explicación inventada", async () => {
  m.get.mockResolvedValue({
    attempt: {
      state: "submitted",
      regime: "32069",
      questions: [
        { id: question, correctOption: "B", sources: [{ documentId: id }] },
      ],
    },
    answers: [],
  });
  m.model.mockRejectedValue(Error("Proveedor no disponible"));
  const r = await tutor(
    req({ attemptId: id, questionId: question, action: "alternatives" }),
  );
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ error: "Proveedor no disponible" });
});
it("no abre un PDF ajeno al intento o aún no revelado", async () => {
  const r = await source(
    new Request(
      "https://ace.test/api/exams/documents/" + id + "?attemptId=" + id,
    ),
    { params: Promise.resolve({ id }) },
  );
  expect(r.status).toBe(404);
  expect(m.get).toHaveBeenCalledWith(actor, id);
});
it("el límite de saldo de IA se informa sin un error técnico crudo", async () => {
  m.get.mockResolvedValue({
    attempt: {
      state: "submitted",
      regime: "32069",
      questions: [
        { id: question, correctOption: "B", sources: [{ documentId: id }] },
      ],
    },
    answers: [],
  });
  m.model.mockRejectedValue(
    Object.assign(Error("402 status code (no body)"), { status: 402 }),
  );
  const r = await tutor(
    req({ attemptId: id, questionId: question, action: "mistake" }),
  );
  expect(r.status).toBe(503);
  expect((await r.json()).error).toContain("saldo o cuota");
});
