import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate, getRateLimitKey: () => "key", RATE_LIMITS: { aiSearch: {} }, rateLimitResponse: () => new Response(null, { status: 429 }) }));
import { POST } from "@/app/api/search/suggestions/route";
const request = (data: unknown) => new Request("http://localhost/api/search/suggestions", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "user" } }); mocks.rate.mockReturnValue({ allowed: true }); });
it("requiere usuario y limita solicitudes antes de consultar", async () => {
  mocks.auth.mockResolvedValueOnce({ error: new Response(null, { status: 401 }) });
  expect((await POST(request({ query: "garantua" }))).status).toBe(401);
  mocks.rate.mockReturnValue({ allowed: false });
  expect((await POST(request({ query: "garantua" }))).status).toBe(429);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("rechaza filtros o consultas malformados", async () => {
  expect((await POST(request({ query: "garantia", filters: { documentId: "private&select=*" } }))).status).toBe(400);
  expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("propone con filtros sin sustituir la consulta original", async () => {
  mocks.rest.mockResolvedValue({ documents: [], vocabulary: ["garantia"] });
  const result = await POST(request({ query: "garantua", filters: { documentType: "reglamento" } }));
  expect(await result.json()).toMatchObject({ original: "garantua", correction: "garantia" });
  expect(JSON.parse(mocks.rest.mock.calls[0][1].body).p_filters.documentType).toBe("reglamento");
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it("el fallo de asistencia permite continuar y no expone errores internos", async () => {
  mocks.rest.mockRejectedValue(new Error("private connection detail"));
  const result = await POST(request({ query: "garantua" }));
  expect(result.status).toBe(503); expect(await result.text()).not.toContain("private connection detail");
});
