import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), extract: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireDecOrAreaUsuaria: mocks.auth }));
vi.mock("../lib/archivo-upload-server", () => ({ readArchivoFile: mocks.read }));
vi.mock("../lib/expedientes-archivo-processing", () => ({ extractExpedienteInventory: mocks.extract }));
vi.mock("../lib/supabase-server", () => ({ writeAuditLog: async () => undefined }));
import { POST } from "../app/api/expedientes-archivo/extract/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "alice" } });
  mocks.read.mockResolvedValue(new File(["%PDF-test"], "a.pdf", { type: "application/pdf" }));
});
const request = () => new Request("http://localhost/api/expedientes-archivo/extract", { method: "POST", body: new FormData() });
it("rechaza acceso sin sesión antes de leer el archivo", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("devuelve 503 reintentable para dependencias ausentes sin exponer rutas internas", async () => {
  mocks.extract.mockRejectedValue(new Error("Cannot find module /var/task/node_modules/pdf.worker.mjs"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.retryable).toBe(true);
  expect(body.error).not.toContain("/var/task");
});
it("devuelve advertencias de lectura parcial al navegador", async () => {
  mocks.extract.mockResolvedValue({ warnings: ["Lectura parcial"], ocrPartial: true });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).inventory.warnings).toEqual(["Lectura parcial"]);
});
