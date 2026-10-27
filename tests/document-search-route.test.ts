import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  search: vi.fn(),
  rest: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/document-search-server", () => ({
  searchDocuments: mocks.search,
}));
vi.mock("@/lib/supabase-server", () => ({ supabaseUserRest: mocks.rest }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.rate,
  getRateLimitKey: () => "key",
  RATE_LIMITS: { aiSearch: {} },
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
import { POST } from "@/app/api/search/documents/route";
const request = (body: unknown) =>
  new Request("http://localhost/api/search/documents", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "alice", accessToken: "alice-jwt" },
  });
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.rest.mockResolvedValue([]);
  mocks.search.mockResolvedValue({ documents: [], totalDocuments: 0 });
});
it("no ejecuta búsqueda sin usuario", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await POST(request({ query: "abc" }))).status).toBe(401);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("rechaza JSON y filtros inválidos antes de consultar", async () => {
  expect(
    (await POST(new Request("http://localhost", { method: "POST", body: "{" })))
      .status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({ query: "abc", filters: { documentId: "x&select=*" } }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("guarda historial con JWT del propietario y modo, sin consulta en URL", async () => {
  const response = await POST(
    request({ query: "frase", mode: "literal", sort: "newest" }),
  );
  expect(response.status).toBe(200);
  expect(mocks.rest.mock.calls[0][0]).toBe("alice-jwt");
  const body = JSON.parse(mocks.rest.mock.calls[0][2].body);
  expect(body.owner_id).toBe("alice");
  expect(body.metadata).toMatchObject({
    query: "frase",
    searchMode: "literal",
    sort: "newest",
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("paginar no duplica entradas de historial", async () => {
  await POST(request({ query: "frase", page: 2 }));
  expect(mocks.rest).not.toHaveBeenCalled();
});
it("un error del motor devuelve indisponibilidad y no lista vacía", async () => {
  mocks.search.mockRejectedValue(new Error("db detail"));
  const response = await POST(request({ query: "frase" }));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("db detail");
});
