import { afterEach, beforeEach, expect, it, vi } from "vitest";
const remove = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase-server", () => ({
  getSupabaseServerConfig: () => ({ serviceRoleKey: "test-secret", storageBucket: "documents", supabaseUrl: "https://test.example" }),
  deleteStorageObjects: remove,
}));
import { readArchivoFile } from "../lib/archivo-upload-server";
import { signUploadTicket } from "../lib/archivo-upload-ticket";
const fileForm = (size: number) => {
  const form = new FormData();
  form.set("uploadTicket", signUploadTicket({ userId: "alice", path: "archivo-temp/alice/a.pdf", name: "a.pdf", size, expires: Date.now() + 10000 }, "test-secret"));
  return form;
};
beforeEach(() => { remove.mockReset().mockResolvedValue(undefined); });
afterEach(() => vi.unstubAllGlobals());
it("borra el temporal después de recuperarlo", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-test")));
  expect((await readArchivoFile(fileForm(9), "alice")).name).toBe("a.pdf");
  expect(remove).toHaveBeenCalledWith("documents", ["archivo-temp/alice/a.pdf"]);
});
it("rechaza y limpia una subida que supera el tamaño declarado", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-demasiado")));
  await expect(readArchivoFile(fileForm(4), "alice")).rejects.toThrow("tamaño autorizado");
  expect(remove).toHaveBeenCalled();
});
it("no descarga archivos de otro usuario", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(readArchivoFile(fileForm(9), "bob")).rejects.toThrow("no está autorizada");
  expect(fetcher).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
