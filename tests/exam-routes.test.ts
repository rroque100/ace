import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  get: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth, requireAdmin: m.admin }));
vi.mock("@/lib/exam-server", () => ({
  examRpc: m.rpc,
  getExam: m.get,
  validateExamSources: m.validate,
  examError: (e: Error) => ({ status: 400, message: e.message }),
}));
vi.mock("next/server", () => ({
  NextResponse: { json: (x: unknown, o?: ResponseInit) => Response.json(x, o) },
}));
import { GET, POST } from "@/app/api/exams/route";
import {
  GET as attemptGet,
  PATCH,
  POST as finish,
} from "@/app/api/exams/[id]/route";
import { GET as bankGet, POST as bankPost } from "@/app/api/exams/bank/route";
const id = "11111111-1111-4111-8111-111111111111",
  ctx = { params: Promise.resolve({ id }) };
const request = (body: unknown) =>
  new Request("https://ace.test/api/exams", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  m.admin.mockResolvedValue({ error: new Response(null, { status: 403 }) });
});
it("no accede a la base sin sesión", async () => {
  for (const r of [
    await GET(),
    await POST(request({})),
    await attemptGet(request({}), ctx),
    await PATCH(request({}), ctx),
    await finish(request({}), ctx),
  ])
    expect(r.status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
  expect(m.get).not.toHaveBeenCalled();
});
it("no abre ni modifica el banco para un usuario común", async () => {
  expect((await bankGet(request({}))).status).toBe(403);
  expect((await bankPost(request({}))).status).toBe(403);
  expect(m.validate).not.toHaveBeenCalled();
});
it("los borradores no pueden ser usados por usuarios comunes", async () => {
  m.auth.mockResolvedValue({ user: { id, isAdmin: false } });
  const r = await POST(
    request({ mode: "practice", count: 1, regime: "32069", preview: true }),
  );
  expect(r.status).toBe(403);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("el actor se toma de la sesión y no del cuerpo", async () => {
  m.auth.mockResolvedValue({ user: { id, isAdmin: false } });
  m.rpc.mockResolvedValue(id);
  expect(
    (
      await POST(
        request({ ownerId: "otro", mode: "exam", count: 1, regime: "32069" }),
      )
    ).status,
  ).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith(
    "ace_exam_start_prepared",
    expect.objectContaining({ p_actor: id }),
  );
});
it("el intento requiere UUID y sesión propia para la consulta", async () => {
  m.auth.mockResolvedValue({ user: { id, isAdmin: false } });
  expect(
    (await attemptGet(request({}), { params: Promise.resolve({ id: "mal" }) }))
      .status,
  ).toBe(400);
  expect(m.get).not.toHaveBeenCalled();
});
it("el catálogo personal no se almacena en caché", async () => {
  m.auth.mockResolvedValue({ user: { id, isAdmin: false } });
  m.rpc.mockResolvedValue({ available: [], history: [] });
  expect((await GET()).headers.get("cache-control")).toBe("no-store");
});
