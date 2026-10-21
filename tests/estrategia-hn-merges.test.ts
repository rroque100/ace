import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

/**
 * h) a n) están entre f)/g) (Requisitos de calificación / Factores de
 * evaluación) y o) (Cronograma): si g) necesita más de las 3 filas que trae
 * la plantilla en blanco (habitual: cualquier estrategia con más de 3
 * factores de evaluación), `duplicateRow` desincroniza los merges de TODO lo
 * que queda por debajo de g) y por encima de o) — mismo síntoma, confirmado
 * por el usuario, que ya se reparó para la sección de obras.
 */
const proceso: ProcesoExport = {
  amount: 120_000,
  entity: "MDCH",
  nomenclature: "N° 7-2026-DEC-MDCH",
  object_type: "servicios",
  procedure_type: null,
  valor_estimado: 120_000,
};

// 7 factores: la plantilla trae 3 → fuerza 4 filas extra de g), que desplazan
// h) a n) (y todo lo de abajo) sin tocar el cronograma/roles.
const FACTORES_AMPLIO = Array.from({ length: 7 }, (_, i) => ({
  nombre: `Factor de evaluación ${i + 1}`,
  sustento: `Sustento del factor ${i + 1}`,
}));

async function hojaHN() {
  const a4: Record<string, unknown> = {
    factores_items: FACTORES_AMPLIO,
    var_h_sustento_pago: "SUSTENTO-MODALIDAD-PAGO-XYZ",
    var_i_sustento_entrega: "SUSTENTO-SISTEMA-ENTREGA-XYZ",
    var_j_puntos_no_negociables: "SUSTENTO-PUNTOS-NO-NEGOCIABLES-XYZ",
    var_k_financiamiento_cuantia: "SUSTENTO-FUENTE-FINANCIAMIENTO-XYZ",
    var_l_garantias_adelantos: "SUSTENTO-ADELANTOS-XYZ",
    var_m_consumo_historico: "SUSTENTO-CONSUMO-HISTORICO-XYZ",
    var_n_tipo_interaccion: "SUSTENTO-INTERACCION-MERCADO-XYZ",
  };
  const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

function filaConTexto(ws: ExcelJS.Worksheet, texto: string): number {
  for (let r = 1; r <= ws.rowCount; r++) {
    const cell = ws.getCell(`B${r}`);
    const target = cell.isMerged ? cell.master : cell;
    const v = target.value;
    const t =
      typeof v === "string"
        ? v
        : v && typeof v === "object" && "richText" in v
          ? (v as { richText: { text?: string }[] }).richText.map((x) => x.text ?? "").join("")
          : "";
    if (t.includes(texto)) return r;
  }
  throw new Error(`No se encontró ninguna fila con "${texto}"`);
}

function assertFilaCombinadaBJ(ws: ExcelJS.Worksheet, fila: number, valorEsperado: string) {
  const b = ws.getCell(`B${fila}`);
  expect(b.isMerged, `B${fila} debería estar combinada`).toBe(true);
  expect(b.master.address).toBe(`B${fila}`);
  expect(String(b.master.value)).toBe(valorEsperado);
  const j = ws.getCell(`J${fila}`);
  expect(j.isMerged, `J${fila} debería pertenecer al mismo merge que B${fila}`).toBe(true);
  expect(j.master.address).toBe(`B${fila}`);
  const d = ws.getCell(`D${fila}`);
  if (d.isMerged) expect(d.master.address).toBe(`B${fila}`);
  else expect(d.value).toBeFalsy();
}

describe("h) a n): merges tras ampliar g) Factores de evaluación", () => {
  it("h) Modalidad de pago: título conserva el formato", async () => {
    const ws = await hojaHN();
    const fila = filaConTexto(ws, "h) Modalidad de pago");
    assertFilaCombinadaBJ(ws, fila, "h) Modalidad de pago:");
  });

  it("i) Sistema de entrega: título conserva el formato", async () => {
    const ws = await hojaHN();
    const fila = filaConTexto(ws, "i) Sistema de entrega");
    assertFilaCombinadaBJ(ws, fila, "i) Sistema de entrega:");
  });

  it("k) Fuente de financiamiento: título conserva el formato", async () => {
    const ws = await hojaHN();
    const fila = filaConTexto(ws, "k) Fuente de financiamiento");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "k) Fuente de financiamiento de la contratación y actualización de la cuantía de la contratación determinada en el PAC:",
    );
  });

  it("l) Garantías y adelantos: título conserva el formato", async () => {
    const ws = await hojaHN();
    const fila = filaConTexto(ws, "l) Garantías y adelantos");
    assertFilaCombinadaBJ(ws, fila, "l) Garantías y adelantos:");
  });

  it("n) Verificación del tipo de interacción: título conserva el formato", async () => {
    const ws = await hojaHN();
    const fila = filaConTexto(ws, "n) Verificación del tipo de interacción");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "n) Verificación del tipo de interacción con el mercado determinado en la segmentación de contrataciones:",
    );
  });

  it("o) Cronograma sigue en su sitio tras el desplazamiento de g)", async () => {
    const ws = await hojaHN();
    // No se mueve por o)/p) (sin cronograma/roles ampliados), pero SÍ por los
    // 4 extra de g): confirma que el desplazamiento de g) llega hasta aquí.
    const fila = filaConTexto(ws, "El cronograma estimado del proceso de contratación");
    expect(fila).toBeGreaterThan(131);
  });
});
