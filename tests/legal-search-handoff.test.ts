import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase-server", () => ({
  supabaseUserRest: mocks.rest,
  getSupabaseServerConfig: () => ({}),
}));
import { POST } from "@/app/api/search/handoff/route";
import { GET } from "@/app/api/search/context/route";
const session = "00000000-0000-4000-8000-000000000001",
  id = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "alice", accessToken: "alice-jwt" },
  });
});
it("traslada consulta y filtros por almacenamiento privado, sin devolver texto en la URL", async () => {
  mocks.rest.mockResolvedValue([{ id: session }]);
  const response = await POST(
    new Request("https://ace.example/api/search/handoff", {
      method: "POST",
      body: JSON.stringify({
        question: "Hechos sintéticos de un caso",
        ownerId: "bob",
        filters: { years: [2024, 2025] },
      }),
    }),
  );
  const body = await response.json();
  expect(body).toEqual({ sessionId: session });
  const record = JSON.parse(mocks.rest.mock.calls[0][2].body);
  expect(record.owner_id).toBe("alice");
  expect(record.metadata.prefill).toBe("Hechos sintéticos de un caso");
  expect(record.metadata.filters.years).toEqual([2024, 2025]);
  expect(mocks.rest.mock.calls[0][0]).toBe("alice-jwt");
});
it("no recupera el contexto de un mensaje sin propietario autorizado", async () => {
  mocks.rest
    .mockResolvedValueOnce([
      { session_id: session, metadata: { question: "No devolver" } },
    ])
    .mockResolvedValueOnce([]);
  const response = await GET(
    new Request(`https://ace.example/api/search/context?messageId=${id}`),
  );
  expect(response.status).toBe(404);
  expect(JSON.stringify(await response.json())).not.toContain("No devolver");
  expect(mocks.rest.mock.calls[1][1]).toContain("owner_id=eq.alice");
});
it("recupera pregunta y filtros únicamente después de comprobar la sesión", async () => {
  mocks.rest
    .mockResolvedValueOnce([
      {
        session_id: session,
        metadata: {
          question: "Consulta propia",
          filters: { regime: "no_determinado" },
        },
      },
    ])
    .mockResolvedValueOnce([{ id: session }]);
  const response = await GET(
    new Request(`https://ace.example/api/search/context?messageId=${id}`),
  );
  expect(await response.json()).toEqual({
    query: "Consulta propia",
    filters: { regime: "no_determinado" },
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
