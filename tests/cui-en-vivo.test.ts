import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type NecesidadExport, type ProcesoExport } from "@/lib/fase1-export";
import { SI_NO_ESTRATEGIA } from "@/lib/estrategia-formato";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 1,
  entity: "MDCH",
  nomenclature: "N-1",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 1,
};

const NEC: NecesidadExport = {
  area_usuaria: null,
  monto_estimado: null,
  nombre: "ADQUISICIÓN DE SERVIDOR",
  tipo_objeto: "bienes",
};

async function celdas(a4: Record<string, unknown>, necesidad: NecesidadExport) {
  const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, necesidad, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  return (a: string) => String(ws.getCell(a).value ?? "").trim();
}

describe("c) el CUI se lee EN VIVO de la necesidad", () => {
  it("con A4 vacío, el CUI sale de la ficha", async () => {
    // La precarga solo corre AL DERIVAR: un expediente ya derivado no vería
    // nunca el CUI aunque se registrara después en la necesidad.
    const c = await celdas({}, { ...NEC, cui: "2661009" });
    expect(c("C19")).toBe("2661009");
  });

  it("y marca c) como inversión: tener CUI es un hecho, no una opinión", async () => {
    // Sin esto el formato imprimiría el CUI con la casilla c) en blanco, que
    // significa "sin analizar".
    const c = await celdas({}, { ...NEC, cui: "2661009" });
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("X");
  });

  it("lo rescata de la cadena funcional si la ficha es antigua", async () => {
    const c = await celdas({}, { ...NEC, cadena_funcional: "03-006-0010-2661009-6000008" });
    expect(c("C19")).toBe("2661009");
  });

  it("lo que la DEC escriba en A4 manda sobre la ficha", async () => {
    const c = await celdas({ cui: "9999999" }, { ...NEC, cui: "2661009" });
    expect(c("C19")).toBe("9999999");
  });

  it("sin CUI en ningún sitio, no inventa un número ni marca c)", async () => {
    // C19 cae en el "NO CORRESPONDE." general de los sustentos, que es lo
    // correcto: dice que se revisó y no aplica. Lo que NO puede es traerse un
    // número inventado ni afirmar que es una inversión.
    const c = await celdas({}, NEC);
    expect(c("C19")).toBe("NO CORRESPONDE.");
    expect(c("C19")).not.toMatch(/\d/);
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("");
  });

  it("respeta un NO explícito de la DEC", async () => {
    // Si la DEC dice que NO es una inversión, no se le contradice por que la
    // ficha traiga un CUI heredado.
    const c = await celdas({ si_es_inversion: "no" }, { ...NEC, cui: "2661009" });
    expect(c(SI_NO_ESTRATEGIA.es_inversion.no)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("");
  });
});
