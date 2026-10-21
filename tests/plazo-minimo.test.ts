import { describe, expect, it } from "vitest";
import { validarPlazoMinimo, type PlazoMinimoInput } from "@/lib/plazo-minimo";

// Caso base: servicio rutinario de provisión continua, plazo de un año.
const base: PlazoMinimoInput = {
  objetoContractual: "servicio",
  categoria: "rutinaria",
  provisionContinua: true,
  plazoDias: 365,
};

describe("validarPlazoMinimo · Art. 126.2", () => {
  it("un año exacto cumple (el 126.2 dice 'no menor a un año')", () => {
    expect(validarPlazoMinimo(base)).toBeNull();
  });

  it("menos de un año incumple", () => {
    const r = validarPlazoMinimo({ ...base, plazoDias: 180 });
    expect(r?.nivel).toBe("error");
    expect(r?.mensaje).toContain("126.2");
    expect(r?.mensaje).toContain("180 días");
  });

  it("aplica igual a los operacionales", () => {
    expect(validarPlazoMinimo({ ...base, categoria: "operacional", plazoDias: 90 })?.nivel).toBe("error");
  });

  it("más de tres años: avisa y pide sustentar el supuesto habilitante", () => {
    const r = validarPlazoMinimo({ ...base, plazoDias: 1460 });
    expect(r?.nivel).toBe("aviso");
    expect(r?.mensaje).toContain("mantenimiento vial");
  });

  it("entre uno y tres años no dice nada", () => {
    expect(validarPlazoMinimo({ ...base, plazoDias: 1095 })).toBeNull();
    expect(validarPlazoMinimo({ ...base, plazoDias: 730 })).toBeNull();
  });

  // La regla es solo para bienes/servicios rutinarios u operacionales de
  // provisión continua: fuera de ahí no debe inventar incumplimientos.
  it("no aplica a críticos ni estratégicos", () => {
    expect(validarPlazoMinimo({ ...base, categoria: "critico", plazoDias: 30 })).toBeNull();
    expect(validarPlazoMinimo({ ...base, categoria: "estrategico", plazoDias: 30 })).toBeNull();
  });

  it("no aplica a obras ni consultorías de obra", () => {
    expect(validarPlazoMinimo({ ...base, objetoContractual: "obra", plazoDias: 30 })).toBeNull();
    expect(
      validarPlazoMinimo({ ...base, objetoContractual: "consultoria_obra", plazoDias: 30 }),
    ).toBeNull();
  });

  it("no aplica si la provisión no es continua ni periódica", () => {
    expect(validarPlazoMinimo({ ...base, provisionContinua: false, plazoDias: 30 })).toBeNull();
  });

  it("sin datos suficientes no se pronuncia", () => {
    expect(validarPlazoMinimo({ ...base, plazoDias: null })).toBeNull();
    expect(validarPlazoMinimo({ ...base, plazoDias: 0 })).toBeNull();
    expect(validarPlazoMinimo({ ...base, objetoContractual: null })).toBeNull();
    expect(validarPlazoMinimo({ ...base, categoria: null })).toBeNull();
  });
});
