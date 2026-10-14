import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseUserRest: mocks.rest }));
import { GET } from "@/app/api/chat/sessions/[id]/route";
const id = "00000000-0000-4000-8000-000000000001";
const request = new Request("http://localhost/api/chat/sessions/" + id);
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "alice", accessToken: "jwt-alice" } }); });
it("no lee datos sin autenticación", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(401);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("rechaza identificadores no válidos antes de consultar", async () => {
  expect((await GET(request, { params: Promise.resolve({ id: "bad&owner_id=other" }) })).status).toBe(400);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("no consulta mensajes de una sesión no visible por RLS", async () => {
  mocks.rest.mockResolvedValue([]);
  expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(404);
  expect(mocks.rest).toHaveBeenCalledTimes(1);
  expect(mocks.rest.mock.calls[0][0]).toBe("jwt-alice");
  expect(mocks.rest.mock.calls[0][1]).toContain("owner_id=eq.alice");
});
it("recupera únicamente los mensajes de la sesión autorizada", async () => {
  const message = { role: "user", content: "Pregunta", metadata: { caseContext: { facts: "Hecho" } } };
  mocks.rest.mockResolvedValueOnce([{ id, metadata: {} }]).mockResolvedValueOnce([message]);
  const response = await GET(request, { params: Promise.resolve({ id }) });
  expect((await response.json()).messages).toEqual([message]);
  expect(mocks.rest.mock.calls[1][1]).toContain(`session_id=eq.${id}`);
});
