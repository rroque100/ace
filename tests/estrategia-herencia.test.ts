import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { fuenteFinanciamientoDeTexto } from "@/lib/estrategia-formato";
import { generarExcelF1, type NecesidadExport, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 98_000,
  entity: "MDCH",
  nomenclature: "N° 42-2026-DEC-MDCH",
  object_type: "bienes",
  procedure_type: "licitacion_publica",
  valor_estimado: 98_000,
};

const NEC: NecesidadExport = {
  area_usuaria: "OFICINA DE ABASTECIMIENTO",
  formula_reajuste: null,
  fuente_financiamiento: null,
  monto_estimado: 98_000,
  nombre: "ADQUISICIÓN DE SERVIDOR",
  tipo_objeto: "bienes",
  verificacion_ficha_tecnica: null,
};

async function hoja(hitos: HitosMap, necesidad: NecesidadExport = NEC) {
  const { buffer } = await generarExcelF1("estrategia", { hitos, necesidad, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  return (a: string) => {
    const c = ws.getCell(a);
    const t = c.isMerged ? c.master : c;
    const v = t.value;
    if (v == null) return "";
    if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((x: { text?: string }) => x.text ?? "").join("").trim();
    }
    return String(v).trim();
  };
}

describe("fuenteFinanciamientoDeTexto", () => {
  it("reconoce las fuentes por su nombre y por su sigla", () => {
    expect(fuenteFinanciamientoDeTexto("RECURSOS DETERMINADOS")).toBe("recursos_determinados");
    expect(fuenteFinanciamientoDeTexto("Recursos Ordinarios")).toBe("recursos_ordinarios");
    expect(fuenteFinanciamientoDeTexto("RDR")).toBe("recursos_directamente_recaudados");
    expect(fuenteFinanciamientoDeTexto("Donaciones y Transferencias")).toBe("donaciones_transferencias");
  });

  it("trata el canon y el FONCOMUN como recursos determinados", () => {
    // Es la fuente típica de una municipalidad: sin esto no se marcaría nada.
    expect(fuenteFinanciamientoDeTexto("CANON Y SOBRECANON")).toBe("recursos_determinados");
    expect(fuenteFinanciamientoDeTexto("FONCOMUN")).toBe("recursos_determinados");
  });

  it("no adivina cuando no reconoce el texto", () => {
    // Marcar la casilla equivocada en un documento que se firma es peor que
    // dejarla en blanco y que la vista previa lo delate.
    expect(fuenteFinanciamientoDeTexto("Presupuesto del proyecto")).toBeNull();
    expect(fuenteFinanciamientoDeTexto("")).toBeNull();
    expect(fuenteFinanciamientoDeTexto(null)).toBeNull();
  });
});

describe("A4 lee lo que ya está tecleado en la ficha y en A1/A3", () => {
  it("k) marca la fuente de financiamiento que trae la necesidad", async () => {
    // Antes: la exportación de A4 no consultaba la Necesidad ni una vez, así
    // que estas 5 casillas salían siempre en blanco.
    const c = await hoja({ A4: { data: {}, status: "hecho" } }, { ...NEC, fuente_financiamiento: "RECURSOS DETERMINADOS" });
    expect(c("J94")).toBe("X"); // Recursos determinados
    expect(c("F93")).toBe(""); // y no otra
  });

  it("k) el campo de A4 manda sobre la ficha", async () => {
    const c = await hoja(
      { A4: { data: { fuente_financiamiento: "recursos_ordinarios" }, status: "hecho" } },
      { ...NEC, fuente_financiamiento: "RECURSOS DETERMINADOS" },
    );
    expect(c("F93")).toBe("X"); // Recursos ordinarios
    expect(c("J94")).toBe("");
  });

  it("t) marca la fórmula de reajuste si la ficha la declara", async () => {
    const c = await hoja({ A4: { data: {}, status: "hecho" } }, { ...NEC, formula_reajuste: "K = 0.3 IPC + 0.7" });
    expect(c("J172")).toBe("X");
  });

  it("t) no la marca cuando la ficha no la trae", async () => {
    const c = await hoja({ A4: { data: {}, status: "hecho" } });
    expect(c("J172")).toBe("");
  });

  it("a) la cabecera lleva la referencia del PAC, que la conoce A1", async () => {
    // El formato pregunta justo debajo si se modifica el procedimiento
    // "registrado en el PAC": sin la referencia no se sabe contra qué se compara.
    const c = await hoja({
      A1: { data: { referencia_pac: "PAC 2026 · ítem 42" }, status: "hecho" },
      A4: { data: {}, status: "hecho" },
    });
    expect(c("B3")).toContain("LICITACIÓN PÚBLICA");
    expect(c("B3")).toContain("N° 42-2026-DEC-MDCH");
    expect(c("B3")).toContain("PAC: PAC 2026 · ítem 42");
  });

  it("a) sin A1 la cabecera sale sin la coletilla del PAC", async () => {
    const c = await hoja({ A4: { data: {}, status: "hecho" } });
    expect(c("B3")).toContain("LICITACIÓN PÚBLICA");
    expect(c("B3")).not.toContain("PAC:");
  });
});
