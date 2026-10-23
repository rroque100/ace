import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/chat-case-attachments", () => ({
  selectedCaseAttachments: mocks.select,
  readCaseFile: mocks.read,
}));
import { GET } from "@/app/api/chat/attachments/[id]/route";
const id = "00000000-0000-4000-8000-000000000002",
  session = "00000000-0000-4000-8000-000000000001";
const request = new Request(
  `https://ace.example/api/chat/attachments/${id}?sessionId=${session}`,
);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "alice", accessToken: "alice-jwt" },
  });
});
it("no descarga sin autenticación", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(
    401,
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
it("no lee almacenamiento si el adjunto no pertenece al usuario y sesión", async () => {
  mocks.select.mockRejectedValue(new Error("not owned"));
  expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(
    404,
  );
  expect(mocks.select).toHaveBeenCalledWith("alice-jwt", "alice", session, [
    id,
  ]);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("rechaza filtros manipulados antes de consultar", async () => {
  expect(
    (
      await GET(request, {
        params: Promise.resolve({ id: "bad&owner_id=bob" }),
      })
    ).status,
  ).toBe(400);
  expect(mocks.select).not.toHaveBeenCalled();
});
it("devuelve solo el original autorizado sin caché ni detección de HTML", async () => {
  mocks.select.mockResolvedValue([
    { id, name: "Caso.pdf", mime: "application/pdf" },
  ]);
  mocks.read.mockResolvedValue(new TextEncoder().encode("%PDF-test").buffer);
  const response = await GET(request, { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toBe("%PDF-test");
});
