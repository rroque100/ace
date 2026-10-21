import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 50_000,
  entity: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
  nomenclature: "REQ-2026-0009",
  object_type: "bienes",
  procedure_type: "adjudicacion_simplificada",
};

/**
 * Lee el .xlsx del Checklist de Bases (A9) por fila (no hay plantilla ni
 * combinaciones: es una hoja tejida por código, así que las filas son
 * predecibles). Devuelve las celdas [Requisito, Cumple, Detalle] de una fila.
 */
async function fila(hitos: HitosMap, n: number, responsable?: string | null) {
  const { buffer } = await generarExcelF1("bases_checklist", { hitos, proceso, responsable });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const row = ws.getRow(n);
  const val = (c: number) => {
    const v = row.getCell(c).value;
    return v == null ? "" : String(v);
  };
  return [val(1), val(2), val(3)];
}

const A9_COMPLETO: HitosMap = {
  A9: {
    data: {
      contiene_condiciones_contractuales: true,
      contiene_documentos_oferta: true,
      contiene_requerimiento: true,
      elaborado_por: "comite",
      factores_evaluacion_definidos: true,
      fecha_publicacion: "2026-06-01",
      observaciones: "Bases revisadas por el comité el 30/05/2026.",
      publicada_seace: true,
      tipo_procedimiento: "Adjudicación Simplificada",
      usa_bases_estandar: true,
      version_bases_estandar: "R.D. 001-2026-EF/54.01",
    },
    status: "hecho",
  },
};

describe("fase1-export · Checklist de Bases (A9)", () => {
  it("la cabecera trae expediente, entidad, tipo de procedimiento y quién elabora", async () => {
    const [, exp] = await fila(A9_COMPLETO, 2);
    const [, ent] = await fila(A9_COMPLETO, 3);
    const [, tipo] = await fila(A9_COMPLETO, 4);
    const [, elabora] = await fila(A9_COMPLETO, 5);
    expect(exp).toBe(proceso.nomenclature);
    expect(ent).toBe(proceso.entity);
    expect(tipo).toBe("Adjudicación Simplificada");
    expect(elabora).toBe("Comité de selección");
  });

  it("cada casilla contiene_* de A9 se vuelca como Sí, no queda en blanco", async () => {
    expect((await fila(A9_COMPLETO, 9))[1]).toBe("SÍ"); // Uso de bases estándar
    expect((await fila(A9_COMPLETO, 10))[1]).toBe("SÍ"); // Requerimiento
    expect((await fila(A9_COMPLETO, 11))[1]).toBe("SÍ"); // Documentos de oferta
    expect((await fila(A9_COMPLETO, 12))[1]).toBe("SÍ"); // Condiciones contractuales
  });

  it("factores de evaluación (el campo que faltaba) se vuelca como Sí, no queda vacío", async () => {
    const [etiqueta, cumple] = await fila(A9_COMPLETO, 13);
    expect(etiqueta).toBe("Factores de evaluación definidos en bases");
    expect(cumple).toBe("SÍ");
  });

  it("sin factores_evaluacion_definidos, la casilla sale en No (no en blanco)", async () => {
    const sinFactor: HitosMap = { A9: { data: { ...A9_COMPLETO.A9!.data, factores_evaluacion_definidos: false }, status: "hecho" } };
    const [, cumple] = await fila(sinFactor, 13);
    expect(cumple).toBe("NO");
  });

  it("publicación en SEACE trae la fecha formateada", async () => {
    const [etiqueta, cumple, fecha] = await fila(A9_COMPLETO, 14);
    expect(etiqueta).toBe("Publicación en SEACE/PLADICOP");
    expect(cumple).toBe("SÍ");
    expect(fecha).not.toBe("");
  });

  it("incluye las observaciones registradas", async () => {
    const [, obs] = await fila(A9_COMPLETO, 16);
    expect(obs).toBe("Bases revisadas por el comité el 30/05/2026.");
  });

  it("con responsable, agrega la línea de quién lo generó al final", async () => {
    const [texto] = await fila(A9_COMPLETO, 18, "Juan Pérez — Jefe de Abastecimiento");
    expect(texto).toBe("Elaborado por: Juan Pérez — Jefe de Abastecimiento");
  });
});
