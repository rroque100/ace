import { afterEach, expect, it, vi } from "vitest";
import { autoFillFromPdf } from "../lib/expedientes-archivo-actions";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("termina la espera y permite reintentar cuando la extracción no responde", async () => {
  vi.useFakeTimers();
  // Simula el comportamiento de fetch: rechaza al abortarse la señal.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
    return controller.signal;
  });
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
  })));
  const result = autoFillFromPdf(new File(["%PDF-test"], "a.pdf", { type: "application/pdf" }), "");
  const assertion = expect(result).rejects.toThrow("superó el tiempo de espera");
  await vi.advanceTimersByTimeAsync(240_000);
  await assertion;
  vi.restoreAllMocks();
});
