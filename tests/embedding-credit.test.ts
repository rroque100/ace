import { describe, expect, it } from "vitest";
import { creditStopMessage, isEmbeddingCreditExhausted } from "../lib/embedding-credit";

describe("isEmbeddingCreditExhausted: parar solo cuando esperar no lo arregla", () => {
  const sinCredito = [
    new Error('Google embeddings 402: {\n  "error": {\n    "code": 402'),
    Object.assign(new Error("Payment Required"), { status: 402 }),
    new Error("You exceeded your current quota, please check your plan and billing details"),
    new Error("insufficient_quota"),
    new Error("Project has exceeded its monthly spending cap"),
    "Google embeddings 402: spending cap",
  ];
  for (const e of sinCredito) {
    it(`sin crédito: ${String(e instanceof Error ? e.message : e).replace(/\s+/g, " ").slice(0, 50)}`, () => {
      expect(isEmbeddingCreditExhausted(e)).toBe(true);
    });
  }

  const pasajeros = [
    new Error("Google embeddings 429: rate limit, retry in 20s"),
    new Error("Google embeddings 500: internal"),
    new Error("fetch failed"),
    new Error("No se pudo extraer texto suficiente del PDF."),
    new Error("22P05 unsupported Unicode escape sequence"),
    null,
    undefined,
  ];
  for (const e of pasajeros) {
    it(`pasajero o ajeno: ${String(e instanceof Error ? e.message : e).slice(0, 50)}`, () => {
      expect(isEmbeddingCreditExhausted(e)).toBe(false);
    });
  }

  it("un número 402 dentro de otro dato (página, importe) no dispara el corte", () => {
    expect(isEmbeddingCreditExhausted(new Error("Resolución N.° 402-2025/OECE-DSAT sin texto"))).toBe(false);
    expect(isEmbeddingCreditExhausted(new Error("página 402 de 900"))).toBe(false);
  });
});

describe("creditStopMessage", () => {
  it("dice cuántos faltan y cómo retomar", () => {
    const m = creditStopMessage(37, "Recarga y vuelve a ejecutar con --aplicar.");
    expect(m).toContain("37");
    expect(m).toContain("--aplicar");
  });
});
