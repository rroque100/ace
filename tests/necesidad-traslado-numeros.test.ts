import { describe, expect, it } from "vitest";
import { numeroDesdeTexto } from "@/app/components/necesidad-traslado-panel";

// La extracción de la propuesta devuelve TODO como texto, pero `cantidad` y
// `plazoEjecucion` son columnas numéricas. Enviarlas como string hacía que el
// PATCH de la ficha respondiera 400:
//   "cantidad: Invalid input: expected number, received string"
// Se convierten en el cliente, que es quien conoce el `kind` del campo.

describe("numeroDesdeTexto", () => {
  it("un número limpio (lo que la IA suele devolver)", () => {
    expect(numeroDesdeTexto("30")).toBe(30);
    expect(numeroDesdeTexto("2500")).toBe(2500);
  });

  it("toma el PRIMER número, no la concatenación de todos", () => {
    // Concatenar daría 30365, un valor inventado que además pasaría el schema.
    expect(numeroDesdeTexto("Treinta (30) días calendario")).toBe(30);
    expect(numeroDesdeTexto("3 a 4 meses")).toBe(3);
  });

  it("quita el separador de miles y conserva el decimal", () => {
    expect(numeroDesdeTexto("1,200.50")).toBe(1200.5);
    expect(numeroDesdeTexto("S/ 18,750.00")).toBe(18750);
  });

  it("sin dígitos no hay número: el campo se omite en vez de rebotar", () => {
    expect(numeroDesdeTexto("No aplica")).toBeUndefined();
    expect(numeroDesdeTexto("")).toBeUndefined();
    expect(numeroDesdeTexto("[CONSIGNAR EL PLAZO]")).toBeUndefined();
  });

  it("admite negativos", () => {
    expect(numeroDesdeTexto("-5")).toBe(-5);
  });
});
