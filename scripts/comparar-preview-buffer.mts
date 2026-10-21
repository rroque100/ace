/**
 * Compare what previewHoja (the modal preview) shows vs the actual exported
 * buffer, for the blocks q) and r) (vertically merged labels in column B).
 */
import ExcelJS from "exceljs";
import { previewHoja } from "../lib/fase1-export";
import { generarExcelF1 } from "../lib/fase1-export";

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

// ---- Buffer exportado (lo que se descarga) ----
const { buffer } = await generarExcelF1("estrategia", input as never);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.worksheets[0];

const textoBuf = (r: number, c: number) => {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  const t = v == null ? "" : typeof v === "object" && "richText" in v && Array.isArray(v.richText) ? v.richText.map((x: { text?: string }) => x.text ?? "").join("") : String(v).trim();
  const est = cell.isMerged ? (cell.master.address === cell.address ? "[M]" : `^${cell.master.address}`) : "·";
  return `${est}${t}`;
};

console.log("══ BUFFER (lo que se descarga), filas 150-170 · col B y C ══");
for (let r = 150; r <= 170; r++) {
  const b = textoBuf(r, 2).slice(0, 70);
  const c = textoBuf(r, 3).slice(0, 45);
  console.log(`${String(r).padStart(3)}  B:${b.padEnd(72)} C:${c}`);
}

// ---- Preview (lo que muestra el modal) ----
const prev = await previewHoja("estrategia", input as never);
console.log("\n══ PREVIEW (modal), filas con texto del bloque r) (estandarizado) ══");
const etiqueta = "requerimiento se encuentra estandarizado";
const fragmentos: string[] = [];
prev.filas.forEach((fila, idx) => {
  for (const celda of fila) {
    if (celda.texto.includes("estandarizado") && celda.texto.includes("Señalar") && celda.rowspan > 1) {
      fragmentos.push(`  fila${idx} ${celda.celda} · texto="${celda.texto.slice(0, 40)}" · rowspan=${celda.rowspan} colspan=${celda.colspan}`);
    }
  }
});
console.log(fragmentos.length ? fragmentos.join("\n") : "  (no hay rótulo vertical 'estandarizado' con rowspan>1)");

// Muestra TODA la fila donde aparezca "estandarizado" con rowspan, y sus vecinas.
for (let idx = 0; idx < prev.filas.length; idx++) {
  const fila = prev.filas[idx];
  const r = fila.find((c) => c.texto.includes("estandarizado") && c.texto.includes("Señalar"));
  if (r) {
    console.log(`\n  → el rótulo "${r.texto.slice(0, 40)}" aparece en fila ${idx} (celda ${r.celda}, rowspan ${r.rowspan})`);
    console.log(`    celda ${r.celda} col=${r.celda.charAt(0)} — ¿es columna B o C? El rowspan dice si sigue siendo un merge VERTICAL.`);
    break;
  }
}

// Ver también cómo se ve el bloque q) en la preview (búsqueda por "agrupación").
const q = prev.filas.find((fila) => fila.some((c) => c.texto.includes("Seleccionar el tipo de agrupación")));
if (q) {
  const celda = q.find((c) => c.texto.includes("Seleccionar el tipo de agrupación"))!;
  console.log(`\n  → bloque q) en preview: celda ${celda.celda} · texto="${celda.texto.slice(0, 50)}" · rowspan=${celda.rowspan} colspan=${celda.colspan}`);
}
console.log("\nEl preview usa spans nativos del sheet en memoria; si las filas insertadas dejaron el merge vertical roto, previa y archivo coinciden en eso.");