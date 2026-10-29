import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ google: vi.fn() }));
vi.mock("@/lib/openai-server", () => ({
  embeddingDimensions: 3,
  embeddingModel: "test-model",
  embeddingProvider: "google",
  googleEmbeddingModel: "test-google",
  embedWithGoogle: mocks.google,
  getEmbeddingClient: () => { throw new Error("no debe usarse con el proveedor google"); },
}));
import { clearEmbeddingCache, embedTexts, embeddingCacheStats } from "@/lib/embeddings";

// Cada texto da un vector distinto y reconocible: el código de sus caracteres.
const vectorDe = (texto: string) => [texto.length, texto.charCodeAt(0) || 0, texto.charCodeAt(texto.length - 1) || 0];

beforeEach(() => {
  clearEmbeddingCache();
  mocks.google.mockReset();
  mocks.google.mockImplementation(async (lote: string[]) => lote.map(vectorDe));
});
afterEach(() => { vi.useRealTimers(); });

describe("caché de vectores de consulta", () => {
  it("la misma consulta no vuelve a pagar una llamada al proveedor", async () => {
    const primera = await embedTexts(["garantía de fiel cumplimiento"]);
    const segunda = await embedTexts(["garantía de fiel cumplimiento"]);
    expect(mocks.google).toHaveBeenCalledTimes(1);
    expect(segunda).toEqual(primera);
    expect(embeddingCacheStats()).toMatchObject({ hits: 1, misses: 1, size: 1 });
  });

  it("en un lote mezclado solo se pide al proveedor lo que falta, y el orden se conserva", async () => {
    await embedTexts(["a1"]);
    mocks.google.mockClear();
    const salida = await embedTexts(["b22", "a1", "c333"]);
    expect(mocks.google).toHaveBeenCalledTimes(1);
    expect(mocks.google.mock.calls[0][0]).toEqual(["b22", "c333"]);
    expect(salida).toEqual([vectorDe("b22"), vectorDe("a1"), vectorDe("c333")]);
  });

  it("devuelve copias: quien modifique un vector no estropea el que se guardó", async () => {
    const [primero] = await embedTexts(["penalidad por mora"]);
    primero[0] = 999; primero.push(1);
    const [otra] = await embedTexts(["penalidad por mora"]);
    expect(otra).toEqual(vectorDe("penalidad por mora"));
  });

  it("los textos largos (fragmentos que se indexan) no se guardan: llenarían la memoria sin repetirse", async () => {
    const largo = "x".repeat(801);
    await embedTexts([largo]); await embedTexts([largo]);
    expect(mocks.google).toHaveBeenCalledTimes(2);
    expect(embeddingCacheStats().size).toBe(0);
    const justo = "y".repeat(800);
    await embedTexts([justo]); await embedTexts([justo]);
    expect(mocks.google).toHaveBeenCalledTimes(3);
  });

  it("caduca a la hora, para no depender de un vector indefinidamente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
    await embedTexts(["plazo de pago"]);
    vi.setSystemTime(new Date("2026-10-29T10:59:00Z"));
    await embedTexts(["plazo de pago"]);
    expect(mocks.google).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-29T11:01:00Z"));
    await embedTexts(["plazo de pago"]);
    expect(mocks.google).toHaveBeenCalledTimes(2);
  });

  it("tiene tope y desaloja primero lo menos usado", async () => {
    for (let i = 0; i < 500; i += 1) await embedTexts([`consulta ${i}`]);
    expect(embeddingCacheStats().size).toBe(500);
    await embedTexts(["consulta 0"]);          // la usa de nuevo: pasa a ser la más reciente
    await embedTexts(["consulta nueva"]);       // entra una más: sale la menos usada (la 1), no la 0
    expect(embeddingCacheStats().size).toBe(500);
    mocks.google.mockClear();
    await embedTexts(["consulta 0"]);
    expect(mocks.google).not.toHaveBeenCalled();
    await embedTexts(["consulta 1"]);
    expect(mocks.google).toHaveBeenCalledTimes(1);
  });

  it("un fallo del proveedor no se guarda: el siguiente intento vuelve a llamarlo", async () => {
    mocks.google.mockRejectedValueOnce(new Error("Google embeddings 503"));
    await expect(embedTexts(["consulta que falla"])).rejects.toThrow("503");
    expect(embeddingCacheStats().size).toBe(0);
    expect((await embedTexts(["consulta que falla"]))[0]).toEqual(vectorDe("consulta que falla"));
    expect(mocks.google).toHaveBeenCalledTimes(2);
  });

  it("sin textos no llama a nada", async () => {
    expect(await embedTexts([])).toEqual([]);
    expect(mocks.google).not.toHaveBeenCalled();
  });
});
