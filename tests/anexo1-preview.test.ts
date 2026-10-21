import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, previewAnexo1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 285_924,
  entity: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
  nomenclature: "REQ-2026-0004",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 285_924,
};

const hitos: HitosMap = {
  A2: { data: { condicionesRiesgo: ["no_contratado_antes"], cuantiaAlta: false, objeto: "bienes_servicios" }, status: "hecho" },
  A5: {
    data: {
      fecha_elaboracion: "2026-07-10",
      herr_solicitud: true,
      nivel: "consulta_mercado_basica",
      proveedores: [{ documento: "PEDIDO DE COMPRA N° 1838-2026", monto: 285_924, razonSocial: "DISTRIBUIDORA VIPASA S.A." }],
      responsable_dec: "ROJAS MAYTAN JUAN",
    },
    status: "hecho",
  },
};

const necesidad = {
  area_usuaria: "OFICINA DE ABASTECIMIENTO",
  monto_estimado: 285_924,
  nombre: "ADQUISICIÓN DE SERVIDOR",
  tipo_objeto: "bienes",
};

describe("vista previa del Anexo N° 1", () => {
  it("coincide EXACTAMENTE con lo que se descarga", async () => {
    // Si la previa saliera de otro código que el .xlsx, podría mentir sobre lo
    // que acabas descargando y no serviría para revisar nada.
    const preview = await previewAnexo1({ hitos, necesidad, proceso });
    const { buffer } = await generarExcelF1("anexo1", { hitos, necesidad, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const leer = (a: string) => {
      const c = ws.getCell(a);
      const t = c.isMerged ? c.master : c;
      return t.value == null ? "" : String(t.value);
    };
    expect(preview.sustentoIndagacion).toBe(leer("B12"));
    expect(preview.sustentoConsulta).toBe(leer("B26"));
    expect(preview.fecha).toBe(leer("D28"));
    expect(preview.responsable).toBe(leer("B32"));
    for (const m of preview.marcas) expect(leer(m.celda)).toBe("X");
  });

  it("nombra cada casilla como la nombra el formato", async () => {
    const preview = await previewAnexo1({ hitos, necesidad, proceso });
    const etiquetas = preview.marcas.map((m) => m.etiqueta);
    expect(etiquetas).toContain("Tipo: Consulta al mercado");
    expect(etiquetas).toContain("Consulta al mercado básica");
    expect(etiquetas).toContain("Herramienta: Solicitud de información a los proveedores");
    expect(etiquetas).toContain("Objeto: Bien");
    // Y ninguna de la indagación, que no se realizó.
    expect(etiquetas.some((e) => e.includes("Indagación"))).toBe(false);
  });

  it("no lista marcas cuando A5 está vacío", async () => {
    const preview = await previewAnexo1({ hitos: {}, proceso });
    expect(preview.marcas.filter((m) => !m.etiqueta.startsWith("Objeto"))).toEqual([]);
  });
});
