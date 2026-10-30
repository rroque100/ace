import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  overview: vi.fn(),
  run: vi.fn(),
  admin: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: m.admin }));
vi.mock("@/lib/document-sync", () => ({
  syncOverview: m.overview,
  runDocumentSync: m.run,
}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: ResponseInit) =>
      Response.json(body, options),
  },
  after: m.after,
}));
import { GET, POST } from "@/app/api/library/sync/route";
import { GET as cron } from "@/app/api/library/sync/cron/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { isAdmin: false } });
  delete process.env.CRON_SECRET;
});
it("no consulta la cola para usuarios comunes", async () => {
  expect((await GET()).status).toBe(403);
  expect(m.overview).not.toHaveBeenCalled();
});
it("no muta fuentes con sesión ausente", async () => {
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect(
    (
      await POST(
        new Request("https://ace.test/api/library/sync", {
          method: "POST",
          body: JSON.stringify({ action: "resume" }),
        }),
      )
    ).status,
  ).toBe(401);
  expect(m.admin).not.toHaveBeenCalled();
});
it("cron no acepta un secreto ausente o incorrecto", async () => {
  expect((await cron(new Request("https://ace.test"))).status).toBe(503);
  process.env.CRON_SECRET = "test-secret";
  expect(
    (
      await cron(
        new Request("https://ace.test", {
          headers: { authorization: "Bearer wrong" },
        }),
      )
    ).status,
  ).toBe(401);
  expect(m.after).not.toHaveBeenCalled();
});
it("cron correcto programa trabajo de servidor sin procesar en la respuesta", async () => {
  process.env.CRON_SECRET = "test-secret";
  expect(
    (
      await cron(
        new Request("https://ace.test", {
          headers: { authorization: "Bearer test-secret" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(m.after).toHaveBeenCalledOnce();
  expect(m.run).not.toHaveBeenCalled();
  await m.after.mock.calls[0][0]();
  expect(m.run).toHaveBeenCalledOnce();
});
it("fallo de base de datos se muestra explícitamente", async () => {
  m.auth.mockResolvedValue({ user: { isAdmin: true } });
  m.overview.mockRejectedValue(Error("database unavailable"));
  expect((await GET()).status).toBe(503);
});
