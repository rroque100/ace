/**
 * Inspecciona el RESULTADO REAL del buffer (las filas 128-170) para ver si la
 * desalineación del cronograma→roles es real en el .xlsx que se descarga, o un
 * artefacto de comparar por posición contra la plantilla.
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { generarExcelF1 } from "../lib/fase1-export";

function texto(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t: { text?: string }) => t.text ?? "").join("");
  }
  const m =
    cell.isMerged && cell.master ? (cell.master.address !== cell.address ? `[esclava→${cell.master.address}]` : "[M]") : "";
  return `${m} ${String(v).trim()}`.trim();
}

const a4 = {
  var_a_proceso: "Licitación Pública para obras",
  si_sustenta_no_competitivo: "no",
  si_es_inversion: "si",
  cui: "2578042",
  var_e_tipo_evaluador: "comite",
  var_h_modalidad_pago: "suma_alzada",
  var_i_sistema_entrega: "solo_construccion",
  si_cuantia_actualizada: "si",
  fuente_financiamiento: "recursos_ordinarios",
  si_garantia_fiel_cumplimiento: "si",
  si_garantia_accesorias: "no",
  si_garantia_adelantos: "si",
  adelantos_items: [{ prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "10" }],
  agrupacion_tipo: "paquete",
  var_q_agrupar: "Agrupación en paquete.",
  cronograma_items: [
    { fase: "preparatorias", actividad: "A", inicio: "01/07/2026", fin: "15/07/2026" },
    { fase: "preparatorias", actividad: "B", inicio: "16/07/2026", fin: "30/07/2026" },
    { fase: "seleccion", actividad: "Convocatoria", inicio: "01/08/2026", fin: "05/08/2026" },
    { fase: "seleccion", actividad: "Registro de participantes", inicio: "06/08/2026", fin: "10/08/2026" },
    { fase: "seleccion", actividad: "Consultas y observaciones", inicio: "11/08/2026", fin: "20/08/2026" },
    { fase: "seleccion", actividad: "Absolución e integración", inicio: "21/08/2026", fin: "25/08/2026" },
    { fase: "seleccion", actividad: "Presentación de ofertas", inicio: "26/08/2026", fin: "30/08/2026" },
    { fase: "seleccion", actividad: "Evaluación y calificación", inicio: "31/08/2026", fin: "05/09/2026" },
    { fase: "seleccion", actividad: "Otorgamiento de la buena pro", inicio: "06/09/2026", fin: "08/09/2026" },
    { fase: "ejecucion", actividad: "Presentación de requisitos para firma del contrato", inicio: "10/09/2026", fin: "20/09/2026" },
    { fase: "ejecucion", actividad: "Suscripción del contrato", inicio: "21/09/2026", fin: "25/09/2026" },
    { fase: "ejecucion", actividad: "Ejecución contractual", inicio: "", fin: "" },
  ],
  roles_items: [
    { rol: "Comité de selección", etapa: "conduccion" },
    { rol: "Área usuaria", etapa: "aprobar_bases" },
  ],
  fecha_elaboracion: "2026-07-30",
};

const input = {
  proceso: {
    nomenclature: "OBRA-PUBLICA-2026-0001",
    object_type: "obra",
    procedure_type: "licitacion_publica",
    amount: 1500000,
    valor_estimado: 1500000,
    entity: "Municipalidad de Prueba",
  },
  hitos: {
    A1: { code: "A1", data: { procedimiento_pac: "LICITACION PUBLICA", referencia_pac: "LP N° 2026-0001", en_pac: true } },
    A2: { code: "A2", data: { objeto: "obras_consultoria_obras", cuantiaAlta: true, condicionesRiesgo: ["carretera"], criteriosBasica: [], centralizada: false, esIoarr: false } },
    A4: { code: "A4", data: a4 },
    A5: { code: "A5", data: { nivel: "consulta", resultado_cuantia: "x" } },
  },
  necesidad: {
    nombre: "n",
    area_usuaria: "a",
    monto_estimado: 1,
    tipo_objeto: "obra",
    fuente_financiamiento: "Recursos ordinarios",
  },
};

const { buffer } = await generarExcelF1("estrategia", input as never);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.worksheets[0];

console.log("══ RESULTADO REAL (filas 126-172), columnas B | C | G | I ══\n");
for (let r = 126; r <= 172; r++) {
  const b = texto(ws, r, 2).slice(0, 55);
  const c = texto(ws, r, 3).slice(0, 40);
  const g = texto(ws, r, 7).slice(0, 12);
  const i = texto(ws, r, 9).slice(0, 12);
  if (!b && !c && !g && !i) continue;
  console.log(`${String(r).padStart(3)}  B:${b.padEnd(58)} C:${c.padEnd(44)} G:${g.padEnd(12)} I:${i}`);
}