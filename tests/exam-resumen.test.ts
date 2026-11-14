import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), client: vi.fn(), active: vi.fn(), retired: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/exam-server", () => ({ examRpc: m.rpc }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: m.client }));
import { GET } from "@/app/api/exams/resumen/route";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "cuenta", isAdmin: false } });
  m.client.mockResolvedValue({ from: () => ({ select: () => ({ in: m.active, eq: m.retired }) }) });
  m.rpc.mockResolvedValue([{ published: 11, drafts: 900 }]);
  m.active.mockResolvedValue({ count: 100, error: null });
  m.retired.mockResolvedValue({ count: 3, error: null });
});
it("no consulta el banco sin sesión", async () => {
  m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET()).status).toBe(401);
  expect(m.client).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
});
it("expone solo cantidades agregadas, sin borradores ni claves", async () => {
  const r = await GET();
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({ total: 103, reviewed: 11, pending: 89, retired: 3 });
  expect(m.auth).toHaveBeenCalledWith({ usesAI: false });
  expect(m.rpc).toHaveBeenCalledWith("ace_exam_availability", { p_admin: false });
  expect(m.active).toHaveBeenCalledWith("status", ["draft", "published"]);
});
it("no convierte una consulta fallida o sin cuenta exacta en cero pendientes", async () => {
  m.active.mockResolvedValue({ count: null, error: null });
  expect((await GET()).status).toBe(503);
  m.active.mockResolvedValue({ count: null, error: { message: "dato interno secreto" } });
  const r = await GET();
  expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("secreto");
});
