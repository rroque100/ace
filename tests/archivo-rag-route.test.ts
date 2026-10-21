import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), access: vi.fn(), rest: vi.fn(), advance: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: mocks.auth, requireDecOrAreaUsuaria: mocks.auth, getArchivoScopeLevel: mocks.scope, canAccessArchivoRow: mocks.access }));
vi.mock("../lib/supabase-server", () => ({ supabaseRest: mocks.rest, writeAuditLog: async () => {} }));
vi.mock("../lib/archivo-rag-worker", () => ({ advanceRagDocument: mocks.advance }));
vi.mock("../lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }), getRateLimitKey: () => "test", RATE_LIMITS: { search: {} }, rateLimitResponse: vi.fn() }));
import { GET, POST } from "../app/api/expedientes-archivo/rag/route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "alice", entity: "Oficina", oficinaId: "office" } }); mocks.scope.mockReturnValue("own"); mocks.rest.mockResolvedValue([]); });
it("no consulta registros sin sesión", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET(new Request("http://localhost/api/rag"))).status).toBe(401); expect(mocks.rest).not.toHaveBeenCalled();
});
it("siempre aplica propietario además del CP solicitado", async () => {
  await GET(new Request("http://localhost/api/rag?cp=2955"));
  const query = decodeURIComponent(mocks.rest.mock.calls[0][0]);
  expect(query).toContain('uploaded_by=eq.alice'); expect(query).toContain('metadata->rag->>cp=eq.CP2955');
});
it("aplica el ID de oficina, sin permitir que el cliente lo sustituya", async () => {
  mocks.scope.mockReturnValue("oficina"); await GET(new Request("http://localhost/api/rag?oficina_id=other"));
  expect(decodeURIComponent(mocks.rest.mock.calls[0][0])).toContain('oficina_id=eq.office');
});
it("pagina usando una fila extra sin truncar el total silenciosamente", async () => {
  mocks.rest.mockResolvedValue(Array.from({ length: 21 }, (_, id) => ({ id })));
  const result = await (await GET(new Request("http://localhost/api/rag?page=2"))).json();
  expect(result.rows).toHaveLength(20); expect(result.hasMore).toBe(true); expect(mocks.rest.mock.calls[0][0]).toContain("offset=20");
});
it("no procesa un documento fuera del alcance del usuario", async () => {
  mocks.rest.mockResolvedValue([{ id: "other", metadata: { uploadSource: "rag-folder" } }]); mocks.access.mockReturnValue(false);
  const response = await POST(new Request("http://localhost/api/rag", { method: "POST", body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }) }));
  expect(response.status).toBe(404); expect(mocks.advance).not.toHaveBeenCalled();
});
