import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

/**
 * Cada fila se ajusta a SU contenido: la plantilla reserva ~90 pt para su
 * marcador ("[Insertar sustento del uso de una modalidad…]", Arial 16), pero al
 * escribir "NO CORRESPONDE." encima la fila ENCOGE a lo que ese texto necesita
 * (~1 línea), no conserva el hueco del marcador. Y crece cuando el sustento real
 * es largo, para que no se corte. Ajuste en las dos direcciones.
 */
const proceso: ProcesoExport = {
  amount: null,
  entity: "Municipalidad distrital de Challhuahuacho",
  nomenclature: "REQ-2026-0004",
  object_type: "bienes",
  procedure_type: "licitacion_publica_abreviada",
  valor_estimado: 285_924,
};

async function hoja(a4: Record<string, unknown>) {
  const hitos: HitosMap = { A4: { data: a4, status: "en_curso" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso, necesidad: null });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

// B156 es q) "Agrupar la contratación": la plantilla le da 83,85 pt para su
// "[Insertar sustento]".
const FILA_Q = 156;

describe("el alto de fila se ajusta al texto escrito", () => {
  it("un texto de una línea se ajusta a su contenido, no al hueco del marcador", async () => {
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    const alto = ws.getRow(FILA_Q).height!;
    // La plantilla reservaba 83,85 pt para su "[Insertar sustento]"; "NO
    // CORRESPONDE." cabe en una línea, así que la fila encoge muy por debajo.
    expect(alto).toBeLessThan(40);
    expect(alto).toBeGreaterThanOrEqual(18.75);
  });

  it("un sustento largo CRECE en vez de cortarse", async () => {
    const largo = "Se agrupa la contratación en un solo ítem. ".repeat(30); // ~1260 caracteres
    const ws = await hoja({ var_q_agrupar: largo });
    const alto = ws.getRow(FILA_Q).height!;
    // A Arial 16 y B..J combinadas caben ~114 caracteres por línea: 1260 → ~11
    // líneas → bastante más que el alto de la plantilla.
    expect(alto).toBeGreaterThan(83.85);
    expect(alto).toBeLessThanOrEqual(409); // el tope de Excel
  });

  it("activa el ajuste de línea: sin él, encoger cortaría el texto", async () => {
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    const cell = ws.getCell(`B${FILA_Q}`);
    const master = cell.isMerged ? cell.master : cell;
    expect(master.alignment?.wrapText).toBe(true);
  });

  it("las filas de instrucción también se ajustan a su texto", async () => {
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    // La 13 trae "[Insertar el análisis del cumplimiento del uso del
    // procedimiento…]" en B13:J13 a Arial 16: cabe en una línea, y la plantilla le
    // reservaba 80,1 pt; se ajusta muy por debajo.
    expect(ws.getRow(13).height!).toBeLessThan(40);
  });

  it("deja aire arriba y abajo del texto, no lo pega al borde", async () => {
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    const cell = ws.getCell(`B${FILA_Q}`);
    const master = cell.isMerged ? cell.master : cell;
    expect(master.alignment?.vertical).toBe("middle");
    // Una línea de Arial 16 ocupa ~21 pt; el resto hasta el alto es el margen.
    const alto = ws.getRow(FILA_Q).height!;
    expect(alto - 16 * 1.32).toBeGreaterThanOrEqual(7);
  });

  it("una celda que se desborda sobre las vecinas NO se fuerza a partir línea", async () => {
    // Forzar `wrapText` donde el texto vive de desbordarse haría CRECER la fila:
    // lo contrario de lo que se busca. G17 es una casilla de marca sin combinar.
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    const g17 = ws.getCell("G17");
    if (!g17.isMerged && String(g17.value ?? "").trim()) {
      expect(g17.alignment?.wrapText ?? false).toBe(false);
    }
  });

  it("el formato encoge cuando los sustentos son cortos, no conserva el hueco de los marcadores", async () => {
    const ws = await hoja({
      var_q_agrupar: "NO CORRESPONDE.",
      var_s_objetivo: "NO CORRESPONDE.",
      var_t_otras: "NO CORRESPONDE.",
      var_k_financiamiento_cuantia: "NO CORRESPONDE.",
      var_l_garantias_adelantos: "NO CORRESPONDE.",
      var_m_consumo_historico: "NO CORRESPONDE.",
    });
    let total = 0;
    for (let r = 1; r <= ws.rowCount; r += 1) total += ws.getRow(r).height ?? 15;

    // La plantilla reserva mucho alto para sus marcadores "[Insertar…]"; con
    // textos cortos encima el formato debe quedar bastante por debajo de ese total.
    const tpl = new ExcelJS.Workbook();
    await tpl.xlsx.readFile("lib/plantillas-f1/estrategia-contratacion.xlsx");
    const wsT = tpl.worksheets[0];
    let totalTpl = 0;
    for (let r = 1; r <= wsT.rowCount; r += 1) totalTpl += wsT.getRow(r).height ?? 15;

    expect(total).toBeLessThan(totalTpl);
  });

  it("un RÓTULO estático no se infla por encima del alto que le da el formato oficial", async () => {
    // El estimador propio sobre-provisionaba algunos rótulos (p. ej. 50 pt donde
    // el oficial usa 44,5): un rótulo no lleva datos del usuario, así que su alto
    // se capa al que la plantilla ya le reservó. Solo las celdas CON datos crecen.
    const ws = await hoja({ var_q_agrupar: "NO CORRESPONDE." });
    const tpl = new ExcelJS.Workbook();
    await tpl.xlsx.readFile("lib/plantillas-f1/estrategia-contratacion.xlsx");
    const wsT = tpl.worksheets[0];
    for (const r of [48, 91, 96, 124]) {
      expect(ws.getRow(r).height!, `fila ${r}`).toBeLessThanOrEqual((wsT.getRow(r).height ?? 15) + 0.5);
    }
  });
});
