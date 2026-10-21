import { describe, expect, it } from "vitest";
import {
  componerFormulaReajuste,
  type FormulaReajuste,
  parseFormulaReajuste,
  PLANTILLA_REAJUSTE_OBRA,
  TEXTO_NO_CORRESPONDE,
} from "@/lib/formula-reajuste";

/**
 * Apartado h): se elige una opción y el par componer/parse debe ser reversible,
 * o el editor perdería la elección al reabrir la ficha.
 */
describe("fórmula de reajuste · componer ↔ parse", () => {
  it("«No corresponde» va y vuelve como su propia modalidad", () => {
    const datos: FormulaReajuste = { modalidad: "no_corresponde", detalle: "" };
    expect(componerFormulaReajuste(datos)).toBe(TEXTO_NO_CORRESPONDE);
    expect(parseFormulaReajuste(TEXTO_NO_CORRESPONDE)).toEqual(datos);
  });

  it("«se aplica» conserva la fórmula", () => {
    const datos: FormulaReajuste = { modalidad: "aplica", detalle: "K = 0.3·IPC + 0.7" };
    const leido = parseFormulaReajuste(componerFormulaReajuste(datos));
    expect(leido.modalidad).toBe("aplica");
    expect(leido.detalle).toBe(datos.detalle);
  });

  it("un texto libre antiguo se lee como «se aplica» (no se pierde)", () => {
    const leido = parseFormulaReajuste("Fórmula polinómica del expediente técnico");
    expect(leido.modalidad).toBe("aplica");
    expect(leido.detalle).toBe("Fórmula polinómica del expediente técnico");
  });

  it("vacío no tiene modalidad y no compone nada", () => {
    expect(parseFormulaReajuste("").modalidad).toBeNull();
    expect(parseFormulaReajuste(null).modalidad).toBeNull();
    expect(componerFormulaReajuste({ modalidad: null, detalle: "" })).toBe("");
  });
});

describe("plantilla de obras · reajuste polinómico (Art. 209)", () => {
  it("cita las fórmulas polinómicas y el Art. 209, no el IPC del 136.2", () => {
    expect(PLANTILLA_REAJUSTE_OBRA).toMatch(/polin[oó]mica/i);
    expect(PLANTILLA_REAJUSTE_OBRA).toMatch(/209/);
    expect(PLANTILLA_REAJUSTE_OBRA).toMatch(/Construcci[oó]n/i);
  });
});
