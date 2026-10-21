import { describe, expect, it } from "vitest";
import { faltaParaConsentir, faltaParaOtorgar } from "@/lib/seleccion-contenido";
import type { HitosMap } from "@/lib/procurement-fases";

describe("faltaParaOtorgar", () => {
  it("exige B6 (evaluación) hecho antes de otorgar la buena pro", () => {
    const hitos: HitosMap = {};
    const falta = faltaParaOtorgar(hitos);
    expect(falta.some((f) => f.paso === "B6" && !f.cumple)).toBe(true);
  });

  it("si hubo consultas u observaciones (B3), exige B4 (bases integradas) hecho", () => {
    const hitos: HitosMap = {
      B3: { status: "hecho", data: { cantidad_consultas: 2 } },
      B6: { status: "hecho", data: {} },
    };
    const falta = faltaParaOtorgar(hitos);
    expect(falta.some((f) => f.paso === "B4" && !f.cumple)).toBe(true);
  });

  it("sin consultas ni observaciones, B4 no es exigible", () => {
    const hitos: HitosMap = {
      B3: { status: "hecho", data: { cantidad_consultas: 0, cantidad_observaciones: 0 } },
      B6: { status: "hecho", data: {} },
    };
    expect(faltaParaOtorgar(hitos)).toHaveLength(0);
  });

  it("con B6 hecho y sin consultas/observaciones, no falta nada", () => {
    const hitos: HitosMap = { B6: { status: "hecho", data: {} } };
    expect(faltaParaOtorgar(hitos)).toHaveLength(0);
  });
});

describe("faltaParaConsentir", () => {
  it("exige B7 (otorgamiento) hecho", () => {
    expect(faltaParaConsentir({}).some((f) => f.paso === "B7" && !f.cumple)).toBe(true);
  });

  it("con B7 hecho, no falta nada", () => {
    expect(faltaParaConsentir({ B7: { status: "hecho", data: {} } })).toHaveLength(0);
  });
});
