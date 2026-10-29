import { describe, expect, it, vi } from "vitest";
import { costoEstimado, tarifaDe } from "@/lib/uso-ia-precios";
import { estimarTokens, leerUso, medirCliente, type UsoMedido } from "@/lib/uso-ia-medicion";

describe("costo estimado: tokens × tarifa de lista, nunca un precio inventado", () => {
  it("calcula por millón de tokens, con entrada y salida a distinto precio", () => {
    // 1 000 000 de entrada a 0,30 + 100 000 de salida a 2,50 = 0,30 + 0,25.
    expect(costoEstimado("gemini-2.5-flash", 1_000_000, 100_000, "")).toEqual({ costo: 0.55, sinTarifa: false });
    expect(costoEstimado("gemini-embedding-001", 2_000_000, 0, "").costo).toBe(0.3);
    expect(costoEstimado("glm-4.5-flash", 5_000_000, 5_000_000, "")).toEqual({ costo: 0, sinTarifa: false });
  });
  it("una consulta cuesta fracciones de centavo y no se pierde por redondear", () => {
    const { costo } = costoEstimado("gemini-2.5-flash", 3_200, 850, "");
    expect(costo).toBeGreaterThan(0);
    expect(costo).toBeLessThan(0.01);
    expect(costo).toBeCloseTo((3_200 * 0.3 + 850 * 2.5) / 1_000_000, 6);
  });
  it("un modelo sin tarifa cuesta 0 y se señala, no se inventa un precio", () => {
    expect(costoEstimado("modelo-que-no-existe", 1000, 1000, "")).toEqual({ costo: 0, sinTarifa: true });
  });
  it("las variantes con sufijo usan la tarifa del prefijo más largo (flash-lite no es flash)", () => {
    expect(tarifaDe("gemini-2.5-flash-preview-09-2025", "")).toEqual({ entrada: 0.3, salida: 2.5 });
    expect(tarifaDe("gemini-2.5-flash-lite-preview", "")).toEqual({ entrada: 0.1, salida: 0.4 });
    expect(tarifaDe("GPT-4o-mini-2024-07-18", "")).toEqual({ entrada: 0.15, salida: 0.6 });
  });
  it("las tarifas se pueden sustituir por entorno; lo no mencionado conserva la suya, y un JSON roto se ignora", () => {
    const propia = JSON.stringify({ "gemini-2.5-flash": { entrada: 1, salida: 2 }, malo: { entrada: -1, salida: 2 }, otro: { entrada: "x" } });
    expect(tarifaDe("gemini-2.5-flash", propia)).toEqual({ entrada: 1, salida: 2 });
    expect(tarifaDe("gemini-embedding-001", propia)).toEqual({ entrada: 0.15, salida: 0 });
    expect(tarifaDe("malo", propia)).toBeNull();
    expect(tarifaDe("gemini-2.5-flash", "{no es json")).toEqual({ entrada: 0.3, salida: 2.5 });
  });
  it("tokens negativos no restan costo", () => {
    expect(costoEstimado("gemini-2.5-flash", -500, -500, "").costo).toBe(0);
  });
});

describe("lectura del uso del proveedor", () => {
  it("entiende las dos formas de informarlo", () => {
    expect(leerUso({ input_tokens: 120, output_tokens: 30 })).toEqual({ entrada: 120, salida: 30 });
    expect(leerUso({ prompt_tokens: 80, completion_tokens: 20 })).toEqual({ entrada: 80, salida: 20 });
    expect(leerUso({ prompt_tokens: 80 })).toEqual({ entrada: 80, salida: 0 });
  });
  it("lo que no son números válidos se descarta", () => {
    for (const malo of [null, undefined, {}, "x", { input_tokens: "12" }, { input_tokens: -4, output_tokens: Number.NaN }]) expect(leerUso(malo as never), JSON.stringify(malo)).toBeNull();
  });
  it("estima ~4 caracteres por token", () => {
    expect(estimarTokens("a".repeat(400))).toBe(100);
    expect(estimarTokens("")).toBe(0);
  });
});

describe("medición del cliente de IA: anota sin cambiar lo que devuelve", () => {
  const crear = () => {
    const anotaciones: UsoMedido[] = [];
    return { anotaciones, registrar: (uso: UsoMedido) => anotaciones.push(uso) };
  };

  it("respuesta normal: usa el uso informado (formato Responses)", async () => {
    const { anotaciones, registrar } = crear();
    const respuesta = { output_text: "hola", usage: { input_tokens: 900, output_tokens: 120 } };
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue(respuesta) }, otro: "intacto" }, registrar);
    expect(await cliente.responses.create({ model: "gemini-2.5-flash", input: "pregunta" })).toBe(respuesta);
    expect(anotaciones).toEqual([{ operacion: "llm", modelo: "gemini-2.5-flash", tokensEntrada: 900, tokensSalida: 120, estimado: false }]);
    expect(cliente.otro).toBe("intacto");
  });

  it("la traducción a chat.completions trae el uso dentro de `raw`", async () => {
    const { anotaciones, registrar } = crear();
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue({ output_text: "x", raw: { usage: { prompt_tokens: 50, completion_tokens: 10 } } }) } }, registrar);
    await cliente.responses.create({ model: "glm-4.5-flash", input: "q" });
    expect(anotaciones[0]).toMatchObject({ tokensEntrada: 50, tokensSalida: 10, estimado: false });
  });

  it("sin uso informado, estima por la longitud y lo marca como estimado", async () => {
    const { anotaciones, registrar } = crear();
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue({ output_text: "r".repeat(400) }) } }, registrar);
    await cliente.responses.create({ model: "m", input: "p".repeat(800) });
    expect(anotaciones[0]).toMatchObject({ estimado: true, tokensSalida: 100 });
    expect(anotaciones[0].tokensEntrada).toBeGreaterThanOrEqual(200);
  });

  it("stream de la traducción (generador): cuenta lo generado y devuelve los mismos eventos en el mismo orden", async () => {
    const { anotaciones, registrar } = crear();
    async function* eventos() { yield { type: "response.output_text.delta", delta: "a".repeat(40) }; yield { type: "response.output_text.delta", delta: "b".repeat(40) }; yield { type: "response.completed" }; }
    const cliente = medirCliente({ responses: { create: vi.fn().mockReturnValue(eventos()) } }, registrar);
    const recibidos: unknown[] = [];
    for await (const e of cliente.responses.create({ model: "m", input: "q", stream: true }) as AsyncIterable<unknown>) recibidos.push(e);
    expect(recibidos).toHaveLength(3);
    expect(anotaciones).toHaveLength(1);
    expect(anotaciones[0]).toMatchObject({ estimado: true, tokensSalida: 20 });
  });

  it("stream del cliente de OpenAI (promesa de stream) con uso en el evento final", async () => {
    const { anotaciones, registrar } = crear();
    async function* eventos() { yield { type: "response.output_text.delta", delta: "hola" }; yield { type: "response.completed", response: { usage: { input_tokens: 700, output_tokens: 33 } } }; }
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue(eventos()) } }, registrar);
    const flujo = (await cliente.responses.create({ model: "gpt-4o-mini", input: "q", stream: true })) as AsyncIterable<unknown>;
    for await (const e of flujo) void e;
    expect(anotaciones).toEqual([{ operacion: "llm", modelo: "gpt-4o-mini", tokensEntrada: 700, tokensSalida: 33, estimado: false }]);
  });

  it("si quien consume corta el stream a medias, lo ya generado también se anota", async () => {
    const { anotaciones, registrar } = crear();
    async function* eventos() { yield { type: "response.output_text.delta", delta: "x".repeat(80) }; yield { type: "response.output_text.delta", delta: "y".repeat(80) }; }
    const cliente = medirCliente({ responses: { create: vi.fn().mockReturnValue(eventos()) } }, registrar);
    for await (const e of cliente.responses.create({ model: "m", input: "q", stream: true }) as AsyncIterable<unknown>) { void e; break; }
    expect(anotaciones).toHaveLength(1);
    expect(anotaciones[0].tokensSalida).toBe(20);
  });

  it("un error del proveedor se propaga tal cual y no deja ninguna anotación", async () => {
    const { anotaciones, registrar } = crear();
    const fallo = Object.assign(new Error("503"), { status: 503 });
    const cliente = medirCliente({ responses: { create: vi.fn().mockRejectedValue(fallo) } }, registrar);
    await expect(cliente.responses.create({ model: "m", input: "q" })).rejects.toBe(fallo);
    expect(anotaciones).toHaveLength(0);
  });

  it("si anotar falla, la llamada sigue funcionando", async () => {
    const respuesta = { output_text: "ok", usage: { input_tokens: 1, output_tokens: 1 } };
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue(respuesta) } }, () => { throw new Error("base caída"); });
    expect(await cliente.responses.create({ model: "m", input: "q" })).toBe(respuesta);
  });

  it("un cliente sin `responses.create` se devuelve igual", () => {
    const sin = { chat: {} };
    expect(medirCliente(sin, () => {})).toBe(sin);
  });
});

describe("cuota: lo que se ejecuta ANTES de cada llamada puede impedirla", () => {
  const anotaciones: UsoMedido[] = [];
  const registrar = (uso: UsoMedido) => anotaciones.push(uso);

  it("si `antes` lanza, la llamada no llega al proveedor ni se anota", async () => {
    anotaciones.length = 0;
    const create = vi.fn().mockResolvedValue({ output_text: "x", usage: { input_tokens: 1, output_tokens: 1 } });
    const cliente = medirCliente({ responses: { create } }, registrar, async () => { throw new Error("cuota agotada"); });
    await expect(cliente.responses.create({ model: "m", input: "q" })).rejects.toThrow("cuota agotada");
    expect(create).not.toHaveBeenCalled();
    expect(anotaciones).toHaveLength(0);
  });

  it("un stream con la cuota agotada falla al empezar a leerlo, sin llamar al proveedor", async () => {
    const create = vi.fn();
    const cliente = medirCliente({ responses: { create } }, registrar, async () => { throw new Error("cuota agotada"); });
    const flujo = cliente.responses.create({ model: "m", input: "q", stream: true }) as AsyncIterable<unknown>;
    await expect((async () => { for await (const e of flujo) void e; })()).rejects.toThrow("cuota agotada");
    expect(create).not.toHaveBeenCalled();
  });

  it("si `antes` deja pasar, todo funciona igual que sin cuota (respuesta y stream)", async () => {
    anotaciones.length = 0;
    const antes = vi.fn(async () => {});
    const respuesta = { output_text: "ok", usage: { input_tokens: 10, output_tokens: 5 } };
    const cliente = medirCliente({ responses: { create: vi.fn().mockResolvedValue(respuesta) } }, registrar, antes);
    expect(await cliente.responses.create({ model: "m", input: "q" })).toBe(respuesta);
    async function* eventos() { yield { type: "response.output_text.delta", delta: "hola" }; yield { type: "response.completed", response: { usage: { input_tokens: 7, output_tokens: 3 } } }; }
    const conStream = medirCliente({ responses: { create: vi.fn().mockReturnValue(eventos()) } }, registrar, antes);
    const recibidos: unknown[] = [];
    for await (const e of conStream.responses.create({ model: "m", input: "q", stream: true }) as AsyncIterable<unknown>) recibidos.push(e);
    expect(recibidos).toHaveLength(2);
    expect(antes).toHaveBeenCalledTimes(2);
    expect(anotaciones).toEqual([
      { operacion: "llm", modelo: "m", tokensEntrada: 10, tokensSalida: 5, estimado: false },
      { operacion: "llm", modelo: "m", tokensEntrada: 7, tokensSalida: 3, estimado: false },
    ]);
  });
});
