/**
 * Compara el ORIGINAL del usuario con la PLANTILLA del código celda a celda
 * (B..J, texto y merges), para confirmar si la plantilla es la referencia y
 * localizar dónde quedan las celdas tardías que escribe el código (B241, B249,
 * B255, C258) en cada uno.
 *   npx tsx --env-file=.env.local scripts/comparar-original-plantilla.mts
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const ORIGINAL = "actuaciones-preparatorias/formato-de-estrategia-de-contratacion.xlsx";
const PLANTILLA = "lib/plantillas-f1/estrategia-contratacion.xlsx";

const TARDIA = ["B241", "B249", "B255", "C258"];

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

const O = await cargar(ORIGINAL);
const P = await cargar(PLANTILLA);

console.log(
  `ORIGINAL : filas ${O.ws.actualRowCount} · cols ${O.ws.actualColumnCount} · merges ${O.merges.length} · rowCount primer fila con algo`,
);
console.log(`PLANTILLA: filas ${P.ws.actualRowCount} · cols ${P.ws.actualColumnCount} · merges ${P.merges.length}`);
console.log(`ExcelJS ws.rowCount (incluye filas solo formateadas): O=${O.ws.rowCount} P=${P.ws.rowCount}`);

// ¿Celdas tardías existen y qué contienen en cada uno?
console.log("\n══ CELDAS TARDÍAS (las que escribe el código tras insertar filas) ══");
for (const addr of TARDIA) {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  const c = m[1].charCodeAt(0) - 64;
  const r = Number(m[2]);
  const o = texto(O.ws, r, c) || "·";
  const p = texto(P.ws, r, c) || "·";
  const oEst = O.ws.getCell(r, c).isMerged ? "[M]" : ".";
  const pEst = P.ws.getCell(r, c).isMerged ? "[M]" : ".";
  console.log(`  ${addr}: ORIGINAL ${oEst} "${o.slice(0, 60)}" | PLANTILLA ${pEst} "${p.slice(0, 60)}"`);
}

// ¿Tienen el bloque III. OTRAS CONSIDERACIONES?
for (const [nombre, ws] of [["ORIGINAL", O.ws], ["PLANTILLA", P.ws]] as const) {
  let hallado = -1;
  for (let r = 1; r <= 300; r++) {
    const t = texto(ws, r, 2);
    if (t.toUpperCase().includes("III. OTRAS CONSIDERACIONES")) {
      hallado = r;
      break;
    }
  }
  console.log(`  Bloque "III. OTRAS CONSIDERACIONES": ${nombre} → ${hallado > 0 ? "fila " + hallado : "NO está"}`);
}

// Texto de la última fila con contenido en cada archivo.
for (const [nombre, ws] of [["ORIGINAL", O.ws], ["PLANTILLA", P.ws]] as const) {
  let ultima = 0;
  let ultimoTexto = "";
  for (let r = 1; r <= ws.actualRowCount; r++) {
    for (let c = 2; c <= 10; c++) {
      const t = texto(ws, r, c);
      if (t) {
        if (r > ultima) {
          ultima = r;
          ultimoTexto = t;
        }
      }
    }
  }
  console.log(`  Última fila con contenido ${nombre}: ${ultima} → "${ultimoTexto.slice(0, 60)}"`);
}

// ¿El bloque "II. SOLO PARA OBRAS" existe en ambos y cuántas variables tiene?
for (const [nombre, ws] of [["ORIGINAL", O.ws], ["PLANTILLA", P.ws]] as const) {
  const varsObras = [];
  for (let r = 186; r <= 265; r++) {
    const t = texto(ws, r, 2);
    if (t && !t.includes("Insertar sustento") && !t.startsWith("(*)") && !t.startsWith("NOTA")) {
      varsObras.push(`r${r} "${t.slice(0, 45)}"`);
    }
  }
  if (varsObras.length) console.log(`\n  ${nombre} · contenidos B 186-265 (${varsObras.length}):`);
  varsObras.forEach((v) => console.log(`    ${v}`));
}