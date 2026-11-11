import { describe, expect, it } from "vitest";
import { createMemoAsync } from "../lib/memo-async";

describe("memoria de promesas", () => {
  it("las llamadas simultáneas con la misma clave comparten un solo cálculo", async () => {
    const memo = createMemoAsync<number>({ ttlMs: 1000, maxEntries: 10 });
    let llamadas = 0;
    const calcular = async () => { llamadas += 1; await Promise.resolve(); return 42; };
    const resultados = await Promise.all([memo.get("a", calcular), memo.get("a", calcular), memo.get("a", calcular)]);
    expect(resultados).toEqual([42, 42, 42]);
    expect(llamadas).toBe(1);
  });

  it("claves distintas se calculan por separado", async () => {
    const memo = createMemoAsync<string>({ ttlMs: 1000, maxEntries: 10 });
    let llamadas = 0;
    await Promise.all(["a", "b"].map((k) => memo.get(k, async () => { llamadas += 1; return k; })));
    expect(llamadas).toBe(2);
  });

  it("un fallo NO se recuerda: la siguiente llamada vuelve a intentarlo", async () => {
    const memo = createMemoAsync<number>({ ttlMs: 1000, maxEntries: 10 });
    let llamadas = 0;
    await expect(memo.get("a", async () => { llamadas += 1; throw new Error("tiempo agotado"); })).rejects.toThrow("tiempo agotado");
    await Promise.resolve();
    expect(memo.size()).toBe(0);
    await expect(memo.get("a", async () => { llamadas += 1; return 7; })).resolves.toBe(7);
    expect(llamadas).toBe(2);
  });

  it("quienes esperaban el cálculo que falla reciben el mismo error", async () => {
    const memo = createMemoAsync<number>({ ttlMs: 1000, maxEntries: 10 });
    let llamadas = 0;
    const fallar = async () => { llamadas += 1; throw new Error("57014"); };
    const resultados = await Promise.allSettled([memo.get("a", fallar), memo.get("a", fallar)]);
    expect(resultados.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(llamadas).toBe(1);
  });

  it("vencido el plazo se recalcula", async () => {
    let reloj = 0;
    const memo = createMemoAsync<number>({ ttlMs: 100, maxEntries: 10, now: () => reloj });
    let llamadas = 0;
    const calcular = async () => { llamadas += 1; return llamadas; };
    expect(await memo.get("a", calcular)).toBe(1);
    reloj = 100;
    expect(await memo.get("a", calcular)).toBe(1);
    reloj = 101;
    expect(await memo.get("a", calcular)).toBe(2);
  });

  it("con soloEnCurso, terminado el cálculo se retira y la siguiente llamada vuelve a calcular", async () => {
    const memo = createMemoAsync<number>({ ttlMs: 60_000, maxEntries: 10, soloEnCurso: true });
    let llamadas = 0;
    const calcular = async () => { llamadas += 1; return llamadas; };
    const [a, b] = await Promise.all([memo.get("a", calcular), memo.get("a", calcular)]);
    expect([a, b]).toEqual([1, 1]);
    await Promise.resolve();
    expect(memo.size()).toBe(0);
    expect(await memo.get("a", calcular)).toBe(2);
  });

  it("respeta el máximo de entradas descartando la más antigua", async () => {
    const memo = createMemoAsync<number>({ ttlMs: 1000, maxEntries: 2 });
    for (const k of ["a", "b", "c"]) await memo.get(k, async () => 1);
    expect(memo.size()).toBe(2);
    let llamadas = 0;
    await memo.get("a", async () => { llamadas += 1; return 1; });
    expect(llamadas).toBe(1);
  });
});
