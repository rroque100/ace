import { describe, expect, it } from "vitest";
import {
  CICLO_CONTRATACION,
  MODULOS,
  etapaActualDelProceso,
  etapaPorId,
  modulo,
} from "@/lib/contratacion-modulos";

describe("contratacion-modulos", () => {
  it("define los 10 módulos de la arquitectura", () => {
    expect(MODULOS).toHaveLength(10);
    expect(modulo(1)?.label).toBe("Gestión de Necesidades");
    expect(modulo(9)?.transversal).toBe(true);
    expect(modulo(10)?.transversal).toBe(true);
  });

  it("el ciclo cubre las 11 etapas de Necesidad a Archivo en orden", () => {
    expect(CICLO_CONTRATACION).toHaveLength(11);
    expect(CICLO_CONTRATACION[0].id).toBe("necesidad");
    expect(CICLO_CONTRATACION.at(-1)?.id).toBe("archivo");
    const ordenes = CICLO_CONTRATACION.map((e) => e.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
  });

  it("cada etapa referencia un módulo válido y declara responsables y salidas", () => {
    for (const etapa of CICLO_CONTRATACION) {
      expect(modulo(etapa.modulo)).toBeDefined();
      expect(etapa.responsables.length).toBeGreaterThan(0);
      expect(etapa.salidas.length).toBeGreaterThan(0);
    }
  });

  it("cada etapa declara macro-fase, participantes y documentos (motor unificado)", () => {
    const macroFasesValidas = new Set([
      "planificacion",
      "actuaciones_preparatorias",
      "seleccion",
      "ejecucion_contractual",
    ]);
    for (const etapa of CICLO_CONTRATACION) {
      expect(macroFasesValidas.has(etapa.macroFase)).toBe(true);
      expect(Array.isArray(etapa.participantes)).toBe(true);
      expect(Array.isArray(etapa.documentos)).toBe(true);
      // El responsable principal no debe repetirse como participante.
      expect(etapa.participantes).not.toContain(etapa.responsables[0]);
    }
  });

  it("mapea el estado del proceso a la etapa correcta del ciclo", () => {
    expect(etapaActualDelProceso("en_preparacion").id).toBe("actuaciones_preparatorias");
    expect(etapaActualDelProceso("en_evaluacion").id).toBe("seleccion");
    expect(etapaActualDelProceso("otorgado").id).toBe("buena_pro");
    expect(etapaActualDelProceso("en_ejecucion").id).toBe("ejecucion");
    expect(etapaActualDelProceso("cerrado").id).toBe("archivo");
  });

  it("usa la primera etapa como fallback ante estado nulo o desconocido", () => {
    expect(etapaActualDelProceso(null).id).toBe("necesidad");
    expect(etapaActualDelProceso("inexistente").id).toBe("necesidad");
  });

  it("etapaPorId resuelve y devuelve undefined para ids desconocidos", () => {
    expect(etapaPorId("contrato")?.modulo).toBe(7);
    expect(etapaPorId("nope")).toBeUndefined();
  });
});
