/**
 * Vuelca el contenido COMPLETO del formato original de estrategia de
 * contratación a texto legible (fila a fila), para tener la referencia exacta
 * de cómo debe verse la salida del .xlsx generado.
 *   npx tsx --env-file=.env.local scripts/volcar-original-estrategia.mts
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const ORIGINAL = "actuaciones-preparatorias/formato-de-estrategia-de-contratacion.xlsx";

async function cargar(ruta: string) {
  const buf = await readFile(ruta);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const merges: string[] = (ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
  return { ws, merges };
}

function texto(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t: { text?: string }) => t.text ?? "").join("").trim();
  }
  return String(v).trim();
}

const { ws, merges } = await cargar(ORIGINAL);
// `actualRowCount` subestima el total en esta hoja (se queda corto, corta el
// volcado a mitad del bloque "II. SOLO PARA OBRAS"); `rowCount` sí cuenta las
// filas con formato aunque su valor solo sea alcanzable vía celda maestra de
// un merge, que es como quedó el resto del documento tras la fila 237.
console.log(`FORMATO ORIGINAL: ${ws.rowCount} filas × ${ws.actualColumnCount} cols; ${merges.length} merges\n`);

function estadoR(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  if (!cell.isMerged) return ".";
  return cell.master.address === cell.address ? "[M]" : `^${cell.master.address}`;
}

for (let r = 1; r <= ws.rowCount; r++) {
  let a = texto(ws, r, 1);
  let b = texto(ws, r, 2);
  if (b && (!a || a === b)) a = "";
  if (!a && !b) continue; // saltar filas del todo vacías (los huecos entre bloques)

  const aEst = estadoR(ws, r, 1);
  const bEst = estadoR(ws, r, 2);

  if (!a && !b) {
    console.log(`${String(r).padStart(3)}  [vacía]`);
    continue;
  }
  const aParte = a ? `A${aEst} "${a}"` : "";
  const bParte = b ? `B${bEst} "${b}"` : "";
  console.log(`${String(r).padStart(3)}  ${aParte}${a && b ? "  |  " : ""}${bParte}`);
}