import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({
  supabaseUserRest: mocks.rest,
  getSupabaseServerConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    serviceRoleKey: "test",
  }),
}));
import {
  validateCaseFile,
  selectedCaseAttachments,
  storeCaseFile,
  CASE_ATTACHMENT_LIMIT,
  caseAttachmentsPrompt,
  encryptCaseBytes,
  decryptCaseBytes,
} from "@/lib/chat-case-attachments";
const session = "00000000-0000-4000-8000-000000000001",
  id = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("valida tamaño, tipo real y rechaza formatos activos", () => {
  expect(() =>
    validateCaseFile(new TextEncoder().encode("%PDF-1.4"), "application/pdf"),
  ).not.toThrow();
  expect(() =>
    validateCaseFile(new TextEncoder().encode("<script>"), "application/pdf"),
  ).toThrow();
  expect(() =>
    validateCaseFile(new Uint8Array(CASE_ATTACHMENT_LIMIT + 1), "image/png"),
  ).toThrow();
  expect(() => validateCaseFile(new Uint8Array(), "image/jpeg")).toThrow();
});
it("comprueba propietario con JWT antes de consultar adjuntos", async () => {
  mocks.rest.mockResolvedValue([]);
  await expect(
    selectedCaseAttachments("alice-jwt", "alice", session, [id]),
  ).rejects.toThrow("sin permiso");
  expect(mocks.rest).toHaveBeenCalledTimes(1);
  expect(mocks.rest.mock.calls[0][0]).toBe("alice-jwt");
  expect(mocks.rest.mock.calls[0][1]).toContain("owner_id=eq.alice");
});
it("rechaza un adjunto de otra sesión o con una ruta manipulada", async () => {
  mocks.rest
    .mockResolvedValueOnce([{ id: session }])
    .mockResolvedValueOnce([
      {
        id,
        metadata: {
          storagePath: `case-attachments/alice/${session}/../../bob/${id}.pdf`,
          mime: "application/pdf",
          text: "Privado",
        },
      },
    ]);
  await expect(
    selectedCaseAttachments("alice-jwt", "alice", session, [id]),
  ).rejects.toThrow("no pertenece");
});
it("selecciona solo IDs autorizados y distingue documentos del caso de normas", async () => {
  mocks.rest
    .mockResolvedValueOnce([{ id: session }])
    .mockResolvedValueOnce([
      {
        id,
        metadata: {
          storagePath: `case-attachments/alice/${session}/${id}.pdf`,
          mime: "application/pdf",
          name: "Caso.pdf",
          text: "Hecho declarado",
          partial: true,
        },
      },
    ]);
  const result = await selectedCaseAttachments("jwt", "alice", session, [id]);
  expect(result).toHaveLength(1);
  expect(caseAttachmentsPrompt(result)).toContain("C1");
  expect(caseAttachmentsPrompt(result)).toContain("NO verificados");
  expect(caseAttachmentsPrompt(result)).toContain("parcial");
});
it("no utiliza un bucket público ni sube el archivo tras fallar la comprobación", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ public: true }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    storeCaseFile(
      "case-attachments/alice/path.pdf",
      new Uint8Array([1]),
      "application/pdf",
    ),
  ).rejects.toThrow("no es privado");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rechaza sesión ausente, ID manipulado y exceso de selección", async () => {
  await expect(
    selectedCaseAttachments("jwt", "alice", undefined, [id]),
  ).rejects.toThrow();
  await expect(
    selectedCaseAttachments("jwt", "alice", session, ["bad&owner_id=bob"]),
  ).rejects.toThrow();
  await expect(
    selectedCaseAttachments("jwt", "alice", session, Array(5).fill(id)),
  ).rejects.toThrow();
  expect(mocks.rest).not.toHaveBeenCalled();
});

it("los originales cifrados no pueden trasladarse a otra ruta ni modificarse", () => {
  const bytes = new TextEncoder().encode("Documento privado sintético");
  const sealed = encryptCaseBytes("owner/session/file.pdf", bytes);
  expect(Buffer.from(sealed).toString()).not.toContain(
    "Documento privado sintético",
  );
  expect(
    new TextDecoder().decode(
      decryptCaseBytes("owner/session/file.pdf", sealed),
    ),
  ).toBe("Documento privado sintético");
  expect(() => decryptCaseBytes("other/session/file.pdf", sealed)).toThrow();
  const tampered = Uint8Array.from(sealed);
  tampered[tampered.length - 1] ^= 1;
  expect(() => decryptCaseBytes("owner/session/file.pdf", tampered)).toThrow();
});
