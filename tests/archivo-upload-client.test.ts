import { afterEach, expect, it, vi } from "vitest";
import { prepareArchivoUpload } from "../lib/archivo-upload-client";
afterEach(() => vi.unstubAllGlobals());
it("envía el PDF grande a Storage y deja solo la referencia en la petición de aplicación", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://storage.example/upload", ticket: "signed" }) }).mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  const form = new FormData();
  const file = new File([new Uint8Array(5 * 1024 * 1024)], "a.pdf", { type: "application/pdf" });
  form.set("file", file);
  form.set("title", "Mi documento");
  await prepareArchivoUpload(form);
  expect(fetcher.mock.calls[1][0]).toBe("https://storage.example/upload");
  expect(fetcher.mock.calls[1][1].body).toBe(file);
  expect(form.has("file")).toBe(false);
  expect(form.get("uploadTicket")).toBe("signed");
  expect(form.get("title")).toBe("Mi documento");
});
