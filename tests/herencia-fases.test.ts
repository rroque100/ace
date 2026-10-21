import { describe, expect, it } from "vitest";
import {
  insumosDePaso,
  insumosParaEjecucion,
  insumosParaSeleccion,
} from "@/lib/herencia-fases";
import type { HitosMap } from "@/lib/procurement-fases";

const a4 = (data: Record<string, unknown>): HitosMap => ({ A4: { data, status: "hecho" } });

describe("herencia Fase 1 → Selección (F2)", () => {
  it("el procedimiento de A4 alimenta la convocatoria (B1)", () => {
    const ins = insumosParaSeleccion(
      a4({ var_a_procedimiento: "licitacion_publica", var_a_nomenclatura: "N° 42-2026" }),
    );
    const b1 = ins.find((i) => i.destino === "B1");
    expect(b1).toBeTruthy();
    expect(b1!.valor).toContain("licitacion_publica");
    expect(b1!.valor).toContain("N° 42-2026");
    // La trazabilidad va citada: es lo que distingue un insumo de un dato mudo.
    expect(b1!.origen).toContain("A4");
  });

  it("los factores de evaluación alimentan B6, contados no volcados", () => {
    const ins = insumosParaSeleccion(
      a4({ factores_items: JSON.stringify([{ nombre: "PLAZO" }, { nombre: "GARANTÍA" }]) }),
    );
    const b6 = ins.find((i) => i.destino === "B6" && i.label.includes("Factores"));
    expect(b6!.valor).toContain("2 factor");
  });

  it("no ofrece nada cuando A4 está vacío", () => {
    expect(insumosParaSeleccion({})).toEqual([]);
    expect(insumosParaSeleccion(a4({}))).toEqual([]);
  });

  it("un factores_items corrupto no rompe la herencia", () => {
    const ins = insumosParaSeleccion(a4({ factores_items: "no es json" }));
    expect(ins.filter((i) => i.label.includes("Factores"))).toEqual([]);
  });
});

describe("herencia Fase 1 → Ejecución (F3)", () => {
  it("la garantía de fiel cumplimiento alimenta el perfeccionamiento (C1)", () => {
    const ins = insumosParaEjecucion(a4({ si_garantia_fiel_cumplimiento: "si" }));
    expect(ins.find((i) => i.destino === "C1")).toBeTruthy();
  });

  it("NO ofrece la garantía si la estrategia dijo que no corresponde", () => {
    // "no" es una decisión de la DEC: no se hereda como si correspondiera.
    const ins = insumosParaEjecucion(a4({ si_garantia_fiel_cumplimiento: "no" }));
    expect(ins.find((i) => i.destino === "C1")).toBeUndefined();
  });

  it("la modalidad de pago alimenta el pago (C7) y el sistema de entrega la recepción (C6)", () => {
    const ins = insumosParaEjecucion(
      a4({ var_h_modalidad_pago: "suma_alzada", var_i_sistema_entrega: "llave_en_mano" }),
    );
    expect(ins.find((i) => i.destino === "C7")!.valor).toContain("suma_alzada");
    expect(ins.find((i) => i.destino === "C6")!.valor).toContain("llave_en_mano");
  });
});

describe("insumosDePaso filtra por el paso destino", () => {
  it("B1 recibe solo lo suyo; C1 recibe lo suyo", () => {
    const hitos = a4({
      si_garantia_fiel_cumplimiento: "si",
      var_a_procedimiento: "licitacion_publica",
    });
    expect(insumosDePaso("B1", hitos).every((i) => i.destino === "B1")).toBe(true);
    expect(insumosDePaso("C1", hitos).every((i) => i.destino === "C1")).toBe(true);
    // Un paso sin insumos definidos no recibe nada.
    expect(insumosDePaso("B2", hitos)).toEqual([]);
  });
});
