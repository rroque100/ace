import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embedWithGoogle } from "@/lib/openai-server";

const respuesta = (cuerpo: unknown, status = 200) => new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status });
const bueno = { embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }] };

beforeEach(() => { vi.stubEnv("GOOGLE_API_KEY", "test-google-only"); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function conReloj<T>(promesa: Promise<T>) {
  // Adelanta el reloj lo bastante para cubrir las esperas del reintento sin esperar de verdad.
  const resultado = promesa.then((valor) => ({ valor }), (error) => ({ error }));
  await vi.advanceTimersByTimeAsync(20_000);
  return resultado;
}

describe("embeddings de Google: reintento de fallos pasajeros (caso real: un 429 dejaba un documento en error)", () => {
  it("se recupera de un 429 y de un 503 seguidos y devuelve los vectores", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(respuesta({ error: { message: "rate limit" } }, 429))
      .mockResolvedValueOnce(respuesta("unavailable", 503))
      .mockResolvedValueOnce(respuesta(bueno));
    vi.stubGlobal("fetch", fetcher);
    const salida = await conReloj(embedWithGoogle(["uno", "dos"], 2));
    expect(salida).toEqual({ valor: [[0.1, 0.2], [0.3, 0.4]] });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("se recupera de una caída de red momentánea", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(respuesta(bueno));
    vi.stubGlobal("fetch", fetcher);
    expect(await conReloj(embedWithGoogle(["uno", "dos"], 2))).toEqual({ valor: [[0.1, 0.2], [0.3, 0.4]] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("el crédito agotado (402) falla a la primera: reintentar solo gastaría tiempo", async () => {
    const fetcher = vi.fn().mockResolvedValue(respuesta({ error: { code: 402, message: "prepayment credits are depleted" } }, 402));
    vi.stubGlobal("fetch", fetcher);
    const salida = await conReloj(embedWithGoogle(["uno"], 2)) as { error?: Error };
    expect(salida.error?.message).toContain("Google embeddings 402");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("una clave inválida o una petición mal formada tampoco se reintentan", async () => {
    for (const status of [400, 401, 403]) {
      const fetcher = vi.fn().mockResolvedValue(respuesta("no", status));
      vi.stubGlobal("fetch", fetcher);
      const salida = await conReloj(embedWithGoogle(["uno"], 2)) as { error?: Error };
      expect(salida.error?.message, String(status)).toContain(`Google embeddings ${status}`);
      expect(fetcher, String(status)).toHaveBeenCalledTimes(1);
    }
  });

  it("si el fallo pasajero no cede, se rinde a los tres intentos con el error real", async () => {
    // Una Response nueva en cada llamada: su cuerpo solo se puede leer una vez.
    const fetcher = vi.fn().mockImplementation(async () => respuesta("down", 503));
    vi.stubGlobal("fetch", fetcher);
    const salida = await conReloj(embedWithGoogle(["uno"], 2)) as { error?: Error };
    expect(salida.error?.message).toContain("Google embeddings 503");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
