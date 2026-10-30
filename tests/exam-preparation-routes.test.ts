import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), author: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth, requireAdmin: m.auth }));
vi.mock("@/lib/exam-server", () => ({
  examRpc: m.rpc,
  examError: (e: Error) => ({ message: e.message, status: 400 }),
}));
vi.mock("@/lib/exam-authoring", () => ({ prepareExamDrafts: m.author }));
import { GET, POST } from "../app/api/exams/preparation/route";
import { POST as activity } from "../app/api/exams/[id]/activity/route";
import { POST as authoring } from "../app/api/exams/authoring/route";
const id = "11111111-1111-4111-8111-111111111111",
  qid = "22222222-2222-4222-8222-222222222222";
const req = (body: unknown) =>
  new Request("https://ace.test/api/exams/preparation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id, isAdmin: false } });
  m.rpc.mockResolvedValue({});
});
it("rechaza lectura sin sesión", async () => {
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET()).status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("no deja ensamblar una edición al usuario ordinario", async () => {
  expect((await POST(req({ action: "assemble" }))).status).toBe(403);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("un reporte usa la identidad de sesión", async () => {
  expect(
    (
      await POST(
        req({
          action: "report",
          attemptId: id,
          questionId: qid,
          reason: "key",
          actor: "otro",
        }),
      )
    ).status,
  ).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith(
    "ace_exam_question_report",
    expect.objectContaining({ p_actor: id, p_id: id, p_question: qid }),
  );
});
it("exige sustento al resolver un reporte", async () => {
  m.auth.mockResolvedValue({ user: { id, isAdmin: true } });
  expect(
    (await POST(req({ action: "resolve", reportId: qid, resolution: "listo" })))
      .status,
  ).toBe(400);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("la actividad no acepta identidades del cliente ni duración inventada", async () => {
  expect(
    (
      await activity(req({ questionId: qid, seconds: 9000, actor: "otro" }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("ace_exam_activity", {
    p_actor: id,
    p_id: id,
    p_question: qid,
  });
});
it("la autoría sin administración no ejecuta el proveedor", async () => {
  m.auth.mockResolvedValue({ error: new Response(null, { status: 403 }) });
  expect((await authoring(req({ code: "1.1", count: 6 }))).status).toBe(403);
  expect(m.author).not.toHaveBeenCalled();
});
