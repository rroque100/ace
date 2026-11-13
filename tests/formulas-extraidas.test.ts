import { describe, expect, it } from "vitest";
import { restaurarFormulas } from "@/lib/formulas-extraidas";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";

// Las cuatro formas en que la trae hoy el corpus indexado (Reglamento y opiniones), copiadas de document_chunks.
const COMO_VIENE = [
  "la siguiente fórmula: Penalidad diaria = 0.10 x monto F x plazo Donde F tiene los siguientes valores:",
  "la siguiente fórmula: Penalidad Diaria = 0.10 x m onto F x p lazo Donde: F = 0.40",
  "la siguiente fórmula: Penalidad Diaria = 0.10 x monto F x p lazo Donde: F = 0.40",
  "la siguiente fórmula: Penalidad diaria = 0,10 × monto F × plazo Donde",
];

describe("fórmulas aplanadas por la extracción del PDF", () => {
  it("la penalidad diaria vuelve a ser una fracción en todas sus formas", () => {
    for (const texto of COMO_VIENE) {
      const restaurado = restaurarFormulas(texto);
      expect(restaurado, texto).toMatch(/= \(0[.,]10 x monto\) \/ \(F x plazo\)/);
      expect(restaurado, texto).not.toMatch(/m onto|p lazo/);
    }
  });

  it("no toca el resto del texto ni otra fórmula", () => {
    expect(restaurarFormulas(COMO_VIENE[0])).toBe("la siguiente fórmula: Penalidad diaria = (0.10 x monto) / (F x plazo) Donde F tiene los siguientes valores:");
    for (const otro of ["El monto del contrato por el plazo pactado", "Otras penalidades = 5% del monto", ""]) expect(restaurarFormulas(otro)).toBe(otro);
  });

  it("las cifras citadas siguen comprobándose contra el texto restaurado", () => {
    const fuente = [{ excerpt: restaurarFormulas(COMO_VIENE[0]) }];
    expect(checkCitationFaithfulness("Penalidad diaria = (0.10 x monto) / (F x plazo) [F1]", fuente).ok).toBe(true);
  });
});
