/**
 * Vuelco fino del bloque q) (agrupación) y r) (estandarizado) en el ORIGINAL y
 * en el GENERADO real, columna C especialmente (las opciones impresas), con el
 * estado de merge. Decide si las opciones se repiten por duplicateRow.
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const ORIGINAL = "actuaciones-preparatorias/formato-de-estrategia-de-contratacion.xlsx";
const GENERADO = "actuaciones-preparatorias/Formato-Estrategia-Contratacion-REQ-2026-0024_ADQUISICION_E_INSTALACION_ (1).xlsx";

async function cargar(ruta: string) {
  const buf = await readFile(ruta);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets[0];
}

function celda(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  let t = "";
  if (v != null) {
    t =
      typeof v === "object" && "richText" in v && Array.isArray(v.richText)
        ? v.richText.map((x: { text?: string }) => x.text ?? "").join("")
        : String(v);
  }
  const m = cell.isMerged ? (cell.master.address === cell.address ? "MASTER" : `esclava→${cell.master.address}`) : "·";
  return `${m}|${t}`.padEnd(48);
}

const O = await cargar(ORIGINAL);
const G = await cargar(GENERADO);

// q) en el original es filas 150-156; en el generado 156-162.
console.log("══ ORIGINAL · q) agrupación (filas 149-157) ══");
for (let r = 149; r <= 157; r++) {
  const cs: string[] = [];
  for (let c = 2; c <= 10; c++) cs.push(celda(O, r, c));
  console.log(`${String(r).padStart(3)} ${cs.join("  ")}`);
}
console.log("\n══ GENERADO REAL · q) agrupación (filas 155-163) ══");
for (let r = 155; r <= 163; r++) {
  const cs: string[] = [];
  for (let c = 2; c <= 10; c++) cs.push(celda(G, r, c));
  console.log(`${String(r).padStart(3)} ${cs.join("  ")}`);
}

// r) en original filas 158-164; en generado 164-170.
console.log("\n══ ORIGINAL · r) estandarizado (filas 158-164) ══");
for (let r = 158; r <= 164; r++) {
  const cs: string[] = [];
  for (let c = 2; c <= 10; c++) cs.push(celda(O, r, c));
  console.log(`${String(r).padStart(3)} ${cs.join("  ")}`);
}
console.log("\n══ GENERADO REAL · r) estandarizado (filas 163-171) ══");
for (let r = 163; r <= 171; r++) {
  const cs: string[] = [];
  for (let c = 2; c <= 10; c++) cs.push(celda(G, r, c));
  console.log(`${String(r).padStart(3)} ${cs.join("  ")}`);
}