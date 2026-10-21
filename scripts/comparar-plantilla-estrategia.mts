/**
 * Compara la PLANTILLA de Estrategia con un .xlsx GENERADO (descargado),
 * enfocado en celdas combinadas y contenido desde la fila 140, donde el
 * usuario reporta celdas combinadas raras. Robusto a celdas esclavas de merge.
 *   npx tsx --env-file=.env.local scripts/comparar-plantilla-estrategia.mts
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const PLANTILLA = "lib/plantillas-f1/estrategia-contratacion.xlsx";
const GENERADO = "actuaciones-preparatorias/Formato-Estrategia-Contratacion-REQ-2026-0024_ADQUISICION_E_INSTALACION_ (1).xlsx";

async function cargar(ruta: string) {
  const buf = await readFile(ruta);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const merges: string[] = (ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
  return { ws, merges };
}

function filaDe(rango: string): number {
  const m = rango.match(/^([A-Z]+)(\d+):/);
  return m ? Number(m[2]) : 0;
}

// Texto seguro: la celda master del merge lleva el valor; las esclavas tienen value=null.
function texto(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t: { text?: string }) => t.text ?? "").join("");
  }
  return String(v);
}

const P = await cargar(PLANTILLA);
const G = await cargar(GENERADO);

console.log(`PLANTILLA: ${P.ws.actualRowCount} filas × ${P.ws.actualColumnCount} cols; ${P.merges.length} merges`);
console.log(`GENERADO : ${G.ws.actualRowCount} filas × ${G.ws.actualColumnCount} cols; ${G.merges.length} merges`);

const desde = 140;
const pm = P.merges.filter((m) => filaDe(m) >= desde).sort((a, b) => filaDe(a) - filaDe(b));
const gm = G.merges.filter((m) => filaDe(m) >= desde).sort((a, b) => filaDe(a) - filaDe(b));

console.log(`\n══ MERGES desde fila ${desde} ══`);
console.log(`PLANTILLA (${pm.length}):`);
pm.forEach((m) => console.log(`    ${m.padEnd(14)}  "${texto(P.ws, filaDe(m), 1).slice(0, 50) || texto(P.ws, filaDe(m), 2).slice(0, 50)}"`));
console.log(`GENERADO  (${gm.length}):`);
gm.forEach((m) => console.log(`    ${m.padEnd(14)}  "${texto(G.ws, filaDe(m), 1).slice(0, 50) || texto(G.ws, filaDe(m), 2).slice(0, 50)}"`));

// Buscar dónde quedó el punto q) "Evaluación de la posibilidad de agrupar" en cada uno.
const buscarFila = (ws: ExcelJS.Worksheet, aguja: string): number => {
  for (let r = 1; r <= ws.actualRowCount; r++) {
    for (let c = 1; c <= (ws.actualColumnCount || 12); c++) {
      if (texto(ws, r, c).includes(aguja)) return r;
    }
  }
  return 0;
};
console.log(`\n══ POSICIÓN DEL PUNTO q) "agrupar prestaciones" ══`);
console.log(`  PLANTILLA fila: ${buscarFila(P.ws, "agrupar prestaciones")}`);
console.log(`  GENERADO  fila: ${buscarFila(G.ws, "agrupar prestaciones")}`);

// Contenido por filas en el GENERADO desde 140 hasta 175 (columna A y B).
console.log(`\n══ CONTENIDO del GENERADO, filas 140-180 (A | B | C) ══`);
for (let r = 140; r <= 180; r++) {
  const a = texto(G.ws, r, 1).slice(0, 18);
  const b = texto(G.ws, r, 2).slice(0, 60);
  const c = texto(G.ws, r, 3).slice(0, 30);
  if (a || b || c) console.log(`  ${String(r).padStart(3)}  ${a.padEnd(18)} | ${b.padEnd(60)} | ${c}`);
}
