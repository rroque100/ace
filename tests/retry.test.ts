import { describe, expect, it, vi } from "vitest";
import { isTransientError, withRetry } from "@/lib/retry";

const conEstado = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("qué se considera un fallo pasajero", () => {
  it("reintenta límites por minuto, 5xx y caídas de red", () => {
    for (const error of [
      conEstado(429), conEstado(500), conEstado(502), conEstado(503), conEstado(504), conEstado(408),
      new Error("Google embeddings 429: rate limit, retry in 20s"), new Error("Google embeddings 503: unavailable"),
      new TypeError("fetch failed"), Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_SOCKET" } }), new Error("socket hang up"),
    ]) expect(isTransientError(error), String(error)).toBe(true);
  });

  it("no reintenta lo que no se arregla esperando", () => {
    for (const error of [
      conEstado(400), conEstado(401), conEstado(403), conEstado(404), conEstado(422),
      new Error("Google embeddings 400: bad request"), new Error("Google embeddings 401: key invalid"),
      // El crédito agotado nunca es pasajero, aunque venga con un código que parezca de límite.
      conEstado(402), new Error("Google embeddings 402: spending cap"), new Error("You exceeded your current quota, please check your plan and billing"),
      // Un tiempo agotado ya consumió el plazo entero: repetirlo duplicaría la espera.
      new DOMException("signal timed out", "TimeoutError"), new DOMException("aborted", "AbortError"),
      new Error("No se pudo extraer texto suficiente del PDF."), null, undefined,
    ]) expect(isTransientError(error), String(error)).toBe(false);
  });
});

describe("withRetry", () => {
  const sinEspera = { sleep: vi.fn(async () => {}), random: () => 0.5 };

  it("devuelve a la primera si no falla, sin esperar", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(run, sinEspera)).toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
    expect(sinEspera.sleep).not.toHaveBeenCalled();
  });

  it("se recupera de un fallo pasajero y deja de insistir", async () => {
    const run = vi.fn().mockRejectedValueOnce(conEstado(503)).mockRejectedValueOnce(conEstado(429)).mockResolvedValue("ok");
    expect(await withRetry(run, { ...sinEspera, attempts: 3 })).toBe("ok");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("agota los intentos y lanza el último error, no uno genérico", async () => {
    const run = vi.fn().mockRejectedValue(conEstado(503));
    await expect(withRetry(run, { ...sinEspera, attempts: 3 })).rejects.toMatchObject({ status: 503 });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("un fallo permanente se lanza al instante, sin gastar intentos ni esperas", async () => {
    const dormir = vi.fn(async () => {});
    const run = vi.fn().mockRejectedValue(conEstado(401));
    await expect(withRetry(run, { attempts: 5, sleep: dormir })).rejects.toMatchObject({ status: 401 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(dormir).not.toHaveBeenCalled();
    const credito = vi.fn().mockRejectedValue(new Error("Google embeddings 402: prepayment credits depleted"));
    await expect(withRetry(credito, { attempts: 5, sleep: dormir })).rejects.toThrow("402");
    expect(credito).toHaveBeenCalledTimes(1);
  });

  it("la espera crece de forma exponencial, con azar acotado y un tope", async () => {
    const esperas: number[] = [];
    const run = vi.fn().mockRejectedValue(conEstado(503));
    await expect(withRetry(run, { attempts: 5, baseMs: 100, maxMs: 500, random: () => 0.5, sleep: async (ms) => { esperas.push(ms); } })).rejects.toBeDefined();
    expect(esperas).toEqual([100, 200, 400, 500]);
    const altas: number[] = [];
    await expect(withRetry(run, { attempts: 3, baseMs: 100, random: () => 0.99, sleep: async (ms) => { altas.push(ms); } })).rejects.toBeDefined();
    expect(altas[0]).toBeLessThanOrEqual(Math.round(100 * 1.5));
    const bajas: number[] = [];
    await expect(withRetry(run, { attempts: 2, baseMs: 100, random: () => 0, sleep: async (ms) => { bajas.push(ms); } })).rejects.toBeDefined();
    expect(bajas[0]).toBeGreaterThanOrEqual(50);
  });

  it("avisa de cada reintento y permite decidir cuáles se repiten", async () => {
    const avisos: Array<[number, number]> = [];
    const run = vi.fn().mockRejectedValueOnce(new Error("raro")).mockResolvedValue("ok");
    expect(await withRetry(run, { ...sinEspera, shouldRetry: () => true, onRetry: (_error, intento, espera) => avisos.push([intento, espera]) })).toBe("ok");
    expect(avisos).toHaveLength(1);
    expect(avisos[0][0]).toBe(1);
  });

  it("siempre hace al menos un intento, aunque se pidan cero", async () => {
    const run = vi.fn().mockResolvedValue(1);
    expect(await withRetry(run, { ...sinEspera, attempts: 0 })).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
