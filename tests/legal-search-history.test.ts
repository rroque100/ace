import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase-server", () => ({ supabaseUserRest: mocks.rest }));
import { GET } from "@/app/api/search/history/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "alice", accessToken: "jwt-alice" },
  });
});
it("no lee historial sin autenticación", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET()).status).toBe(401);
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("recupera solo búsquedas del propietario usando su JWT", async () => {
  mocks.rest.mockResolvedValue([{ id: "own" }]);
  const response = await GET();
  expect((await response.json()).searches).toEqual([{ id: "own" }]);
  expect(mocks.rest.mock.calls[0][0]).toBe("jwt-alice");
  expect(mocks.rest.mock.calls[0][1]).toContain("owner_id=eq.alice");
  expect(mocks.rest.mock.calls[0][1]).toContain("kind=eq.legal_search");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("distingue un error del historial de una lista vacía", async () => {
  mocks.rest.mockRejectedValue(new Error("offline"));
  expect((await GET()).status).toBe(503);
});
