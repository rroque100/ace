import { describe, expect, it } from "vitest";
import {
  CONTRATO_MENOR_UIT,
  evaluarAgrupamientoPorItems,
  superaContratoMenor,
  umbralContratoMenor,
} from "@/lib/umbral-contrato-menor";

// UIT 2026 de ejemplo: 5,350. El umbral del contrato menor queda en 42,800.
const UIT = 5350;
const UMBRAL = UIT * CONTRATO_MENOR_UIT;

describe("umbralContratoMenor", () => {
  it("son 8 UIT (Ley 32069, Art. 34.1)", () => {
    expect(CONTRATO_MENOR_UIT).toBe(8);
    expect(umbralContratoMenor(UIT)).toBe(42800);
  });

  it("sin UIT registrada no inventa un umbral", () => {
    // Devolver 0 dejaria pasar cualquier item; hay que poder decir "no se sabe".
    expect(umbralContratoMenor(null)).toBeNull();
    expect(umbralContratoMenor(undefined)).toBeNull();
    expect(umbralContratoMenor(0)).toBeNull();
    expect(umbralContratoMenor(-1)).toBeNull();
    expect(umbralContratoMenor(Number.NaN)).toBeNull();
  });
});

describe("superaContratoMenor", () => {
  it("en el umbral exacto TODAVIA es contrato menor", () => {
    // Art. 34.1: son contratos menores los de monto "igual o inferior" a 8 UIT.
    // Por eso el Art. 52.1.b, que pide ser "superior", no se cumple en el borde.
    expect(superaContratoMenor(UMBRAL, UIT)).toBe(false);
    expect(superaContratoMenor(UMBRAL + 0.01, UIT)).toBe(true);
    expect(superaContratoMenor(UMBRAL - 0.01, UIT)).toBe(false);
  });

  it("distingue 'no cumple' de 'no se sabe'", () => {
    expect(superaContratoMenor(1_000_000, null)).toBeNull();
    expect(superaContratoMenor(1, UIT)).toBe(false);
  });

  it("un monto ausente no supera nada", () => {
    expect(superaContratoMenor(null, UIT)).toBe(false);
    expect(superaContratoMenor(undefined, UIT)).toBe(false);
  });
});

describe("evaluarAgrupamientoPorItems", () => {
  it("procede cuando todos superan el umbral", () => {
    const v = evaluarAgrupamientoPorItems(
      [
        { nro: 1, costoTotal: 50_000 },
        { nro: 2, costoTotal: 43_000 },
      ],
      UIT,
    );
    expect(v.estado).toBe("procede");
  });

  it("senala QUE items estan por debajo, no solo que falla", () => {
    const v = evaluarAgrupamientoPorItems(
      [
        { nro: 1, costoTotal: 50_000 },
        { nro: 2, costoTotal: 10_000 },
        { nro: 3, costoTotal: UMBRAL },
        { nro: 4, costoTotal: 90_000 },
      ],
      UIT,
    );
    expect(v).toEqual({ estado: "no_procede", nrosPorDebajo: [2, 3], umbral: UMBRAL });
  });

  it("sin UIT no se pronuncia", () => {
    const v = evaluarAgrupamientoPorItems([{ nro: 1, costoTotal: 1 }], null);
    expect(v.estado).toBe("sin_uit");
  });

  it("una lista vacia no bloquea", () => {
    // Sin items no hay nada que agrupar: no es un incumplimiento.
    expect(evaluarAgrupamientoPorItems([], UIT).estado).toBe("procede");
  });

  it("calla mientras NINGUN item tenga importe", () => {
    // Es el estado recien importado del SIGA, cuyo export no trae precios.
    // Decir "ninguno supera el tope" seria cierto pero enganoso.
    const v = evaluarAgrupamientoPorItems(
      [
        { nro: 1, costoTotal: null },
        { nro: 2, costoTotal: null },
      ],
      UIT,
    );
    expect(v).toEqual({ estado: "sin_importes" });
  });

  it("en cuanto UNO tiene importe, los vacios ya son un descuido", () => {
    const v = evaluarAgrupamientoPorItems(
      [
        { nro: 1, costoTotal: 50_000 },
        { nro: 2, costoTotal: null },
      ],
      UIT,
    );
    expect(v).toEqual({ estado: "no_procede", nrosPorDebajo: [2], umbral: UMBRAL });
  });

  it("la falta de UIT manda sobre la falta de importes", () => {
    // Sin UIT no hay umbral que comparar, dé igual lo que valgan los items.
    expect(evaluarAgrupamientoPorItems([{ nro: 1, costoTotal: null }], null).estado).toBe("sin_uit");
  });
});
