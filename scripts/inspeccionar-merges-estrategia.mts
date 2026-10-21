/**
 * Inspecciona el estado REAL de los merges (relaciones cell.master vivas) del
 * .xlsx generado en el rango del punto q), para decidir el arreglo.
 *   npx tsx --env-file=.env.local scripts/inspeccionar-merges-estrategia.mts
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const GENERADO = "actuaciones-preparatorias/Formato-Estrategia-Contratacion-REQ-2026-0024_ADQUISICION_E_INSTALACION_ (1).xlsx";
const PLANTILLA = "lib/plantillas-f1/estrategia-contratacion.xlsx";

async function cargar(ruta: string) {
  const buf = await readFile(ruta);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets[0];
}

function texto(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t) => t.text ?? "").join("");
  }
  return String(v);
}

const G = await cargar(GENERADO);
const P = await cargar(PLANTILLA);

console.log("\n══ PLANTILLA filas 149-156 (cómo DEBERÍA verse el bloque q) ══");
for (let r = 149; r <= 156; r++) {
  const partes: string[] = [];
  for (let c = 2; c <= 10; c++) {
    const cell = P.getCell(r, c);
    const m = cell.isMerged ? (cell.master.address === cell.address ? "[M]" : `→${cell.master.address}`) : " . ";
    const t = texto(P, r, c).slice(0, 6) || "·";
    partes.push(`${cell.address}${m}:${t.padEnd(6)}`);
  }
  console.log(`  ${String(r).padStart(3)}  ${partes.join(" ")}`);
}

console.log("\n══ GENERADO filas 149-165 (cómo SE VE roto) ══");
for (let r = 149; r <= 165; r++) {
  const partes: string[] = [];
  for (let c = 2; c <= 10; c++) {
    const cell = G.getCell(r, c);
    const m = cell.isMerged ? (cell.master.address === cell.address ? "[M]" : `→${cell.master.address}`) : " . ";
    const t = texto(G, r, c).slice(0, 6) || "·";
    partes.push(`${cell.address}${m}:${t.padEnd(6)}`);
  }
  console.log(`  ${String(r).padStart(3)}  ${partes.join(" ")}`);
}

// Cuenta: merges vivos (master) en el bloque q del generado (filas 155-162).
console.log("\n══ MERGES VIVOS (master) del GENERADO en filas 150-166 ══");
let n = 0;
for (let r = 150; r <= 166; r++) {
  for (let c = 2; c <= 10; c++) {
    const cell = G.getCell(r, c);
    if (cell.isMerged && cell.master.address === cell.address) {
      console.log(`  master ${cell.address}`);
      n++;
    }
  }
}
console.log(`  Total masters vivos en 150-166: ${n}`);
