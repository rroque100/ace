import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest }));
import { GET, POST } from "@/app/api/norms/[id]/validity/route";
const id = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id }) };
const data = { result: "current", scope: "document", articleIds: [], version: "Versión comprobada", asOf: "2026-01-01", sourceUrl: "https://www.gob.pe/example", basis: "Se revisaron las publicaciones oficiales de esta versión.", revision: 0 };
const request = (body: unknown = data) => new Request("https://ace.test/api/norms/" + id + "/validity", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: actor, isLegal: true } }); });
it("exige sesión antes de consultar", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET(new Request("https://ace.test"), context)).status).toBe(401);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("no permite registrar a consulta ni editor", async () => {
  mocks.auth.mockResolvedValue({ user: { isEditor: true } });
  expect((await POST(request(), context)).status).toBe(403);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("obtiene autor de sesión y registra mediante una operación atómica", async () => {
  mocks.rest.mockResolvedValue({ id });
  expect((await POST(request({ ...data, actor: "forjado", reviewer: "forjado" }), context)).status).toBe(201);
  const payload = JSON.parse(mocks.rest.mock.calls[0][1].body);
  expect(payload.p_actor).toBe(actor); expect(payload.p_review.reviewer).toBeUndefined();
  expect(mocks.rest.mock.calls[0][0]).toBe("rpc/ace_review_validity_v1");
});
it("no sobrescribe trabajo concurrente ni transforma fallos en ausencia", async () => {
  mocks.rest.mockRejectedValue(Error("40001"));
  expect((await POST(request(), context)).status).toBe(409);
  expect((await GET(new Request("https://ace.test"), context)).status).toBe(503);
});
it("solo expone historial de un documento institucional accesible", async () => {
  mocks.rest.mockResolvedValueOnce([]);
  expect((await GET(new Request("https://ace.test"), context)).status).toBe(404);
  expect(mocks.rest).toHaveBeenCalledTimes(1);
  expect(mocks.rest.mock.calls[0][0]).toContain("es_institucional=eq.true");
});
it("pagina sin exponer identificadores del autor ni sus datos privados", async () => {
  mocks.rest.mockResolvedValueOnce([{ id, metadata: { validityRevision: 30 } }]);
  mocks.rest.mockResolvedValueOnce(Array.from({ length: 21 }, (_, index) => ({ id: String(index), revision: 30 - index, record: {}, created_at: "2026-01-01" })));
  const payload = await (await GET(new Request("https://ace.test?before=31"), context)).json();
  expect(payload.history).toHaveLength(20); expect(payload.nextBefore).toBe(11);
  expect(mocks.rest.mock.calls[1][0]).not.toContain("actor_id");
});
it("valida datos antes de tocar la base", async () => {
  expect((await POST(request({ ...data, sourceUrl: "https://gob.pe.evil.test" }), context)).status).toBe(400);
  expect(mocks.rest).not.toHaveBeenCalled();
});
