import { afterEach, expect, it, vi } from "vitest";
import { fetchRagRequest } from "../lib/archivo-rag-client";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("espera ante 429 y reintenta la petición rechazada", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "5" } })).mockResolvedValueOnce(new Response("ok"));
  vi.stubGlobal("fetch", fetcher);
  const pending = fetchRagRequest("/upload", { method: "POST" });
  await vi.advanceTimersByTimeAsync(5000);
  expect((await pending).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("no repite una escritura cuyo resultado es incierto", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  expect((await fetchRagRequest("/upload", { method: "POST" })).status).toBe(500);
  expect(fetcher).toHaveBeenCalledOnce();
});
