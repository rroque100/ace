/**
 * REVISIÓN de cobertura: genera el Formato de Estrategia con un expediente
 * FICTICIO COMPLETO (todas las variables a)–t) y las de obras respondidas) y lo
 * compara celda a celda contra la plantilla original (que es idéntica al
 * formato oficial). Muestra qué escribe ACE en cada celda y qué "Insertar…"
 * de la plantilla queda literal o como "NO CORRESPONDE".
 *   npx tsx --env-file=.env.local scripts/revision-formato-estrategia.mts
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { generarExcelF1 } from "../lib/fase1-export";

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
    return v.richText.map((t: { text?: string }) => t.text ?? "").join("");
  }
  return String(v).trim();
}

const P = await cargar(PLANTILLA);
const plantilla = new Map<string, string>();
for (let r = 1; r <= 259; r++) for (let c = 1; c <= 10; c++) plantilla.set(`${r}:${c}`, texto(P, r, c));

// ── Expediente ficticio: OBRA (para que se vea también la sección II) ──
const a1 = {
  procedimiento_pac: "LICITACION PUBLICA",
  referencia_pac: "LP N° 2026-0001",
  causal_art_55: "",
  documento_causal_art_55: "",
  en_pac: true,
};
const a2 = {
  objeto: "obras_consultoria_obras",
  cuantiaAlta: true,
  condicionesRiesgo: ["carretera"],
  criteriosBasica: [],
  centralizada: false,
  esIoarr: false,
};
const a4 = {
  var_a_proceso: "Licitación Pública para obras",
  var_a_sustento_cambio: "El procedimiento difiere del PAC por variación presupuestal.",
  si_sustenta_no_competitivo: "no",
  var_b_no_competitivo: "NO CORRESPONDE",
  si_es_inversion: "si",
  cui: "2578042",
  si_inversion_viable: "si",
  si_modalidad_eficiente: "no",
  var_d_modalidad_eficiente: "Se decide no usar modalidad eficiente.",
  modalidad_eficiente_tipo: "",
  var_e_tipo_evaluador: "comite",
  var_e_perfil_evaluador: "Comité de evaluación con tres integrantes, debidamente acreditados.",
  var_f_requisitos_calificacion: "Experiencia del postor en obras similares.",
  var_h_modalidad_pago: "suma_alzada",
  var_h_sustento_pago: "Pago a suma alzada conforme al artículo 130 del Reglamento.",
  var_i_sistema_entrega: "solo_construccion",
  var_i_sustento_entrega: "Obra por administración con sistema solo construcción.",
  var_j_puntos_no_negociables: "",
  var_k_financiamiento_cuantia: "Cuantía vigente conforme al presupuesto institucional.",
  si_cuantia_actualizada: "si",
  fuente_financiamiento: "recursos_ordinarios",
  si_garantia_fiel_cumplimiento: "si",
  si_garantia_accesorias: "no",
  si_garantia_adelantos: "si",
  adelantos_items: [
    { prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "10" },
  ],
  var_m_consumo_historico: "NO CORRESPONDE",
  var_n_tipo_interaccion: "Consulta al mercado básica por tratarse de obra.",
  var_p_roles: "Comité a cargo de la conducción; DEC supervisa.",
  cronograma_items: [
    { fase: "preparatorias", actividad: "Aprobación del expediente de contratación", inicio: "01/07/2026", fin: "15/07/2026" },
    { fase: "preparatorias", actividad: "Elaboración de las bases del procedimiento de selección", inicio: "16/07/2026", fin: "30/07/2026" },
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
  var_q_agrupar: "Agrupación en paquete por vinculación funcional.",
  agrupacion_tipo: "paquete",
  var_r_estandarizado: "NO CORRESPONDE",
  var_s_objetivo: "Contratación de la obra de acuerdo con la priorización institucional.",
  var_t_otras: "JPRD como medio de solución de controversias.",
  otra_var_jprd: true,
  obra_a_tipo_contrato: "Contrato estandarizado Llave en mano.",
  obra_b_bim: "Se requiere BIM nivel 1.",
  obra_c_incentivos: "Incentivo por cumplimiento anticipado.",
  obra_d_fast_track: "NO CORRESPONDE",
  obra_e_terreno: "Terreno disponible.",
  obra_f_licencias: "Se gestionarán licencias municipales.",
  obra_g_expediente_tecnico: "La entidad elaborará el expediente del adicional.",
  obra_h_estructura_costos: "Estructura de costos actualizada.",
  obra_i_metodologias_colaborativas: "Se usarán metodologías colaborativas BIM.",
  si_cuantia_referencia: "no",
  fecha_elaboracion: "2026-07-30",
};
const a5 = { nivel: "consulta", resultado_cuantia: "La cuantía se ha confirmado tras la consulta al mercado." };

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
    A1: { code: "A1", data: a1 },
    A2: { code: "A2", data: a2 },
    A4: { code: "A4", data: a4 },
    A5: { code: "A5", data: a5 },
  },
  necesidad: {
    nombre: "Construcción de puente peatonal",
    area_usuaria: "Gerencia de Infraestructura",
    monto_estimado: 1500000,
    tipo_objeto: "obra",
    fuente_financiamiento: "Recursos ordinarios",
    formula_reajuste: "Fórmula polinómica",
  },
};

const { buffer } = await generarExcelF1("estrategia", input as never);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const G = wb.worksheets[0];

console.log(`GENERADO: filas visibles ~${G.actualRowCount} (rowCount ${G.rowCount}).\n`);

// 1) Celdas donde ACE escibe algo distinto de la plantilla (o la marca).
type Cambio = { addr: string; plantilla: string; generado: string };
const cambios: Cambio[] = [];
const marcasX: string[] = [];
for (let r = 1; r <= 259; r++) {
  for (let c = 1; c <= 10; c++) {
    const plant = plantilla.get(`${r}:${c}`) ?? "";
    const gen = texto(G, r, c);
    if (plant !== gen) {
      // Celdas esclavas de merges verticales que heredan el texto del master se
      // pueden reportar duplicadas; el master ya aparecerá solo. Filtro por celdas
      // cuya dirección de master sea la suya propia o sin merge.
      const cell = G.getCell(r, c);
      if (cell.isMerged && cell.master.address !== cell.address) continue;
      cambios.push({ addr: cell.address, plantilla: plant, generado: gen });
      if (gen === "X") marcasX.push(cell.address);
    }
  }
}

console.log(`══ LO QUE ACE ESCRIBE (${cambios.length} celdas distintas de la plantilla) ══\n`);
for (const { addr, plantilla, generado } of cambios) {
  const antes = plantilla ? `«${plantilla.slice(0, 70)}»` : "(vacía)";
  console.log(`  ${addr.padEnd(5)} ${antes.padEnd(80)} → ${generado.slice(0, 110)}`);
}

console.log(`\n══ CASILLAS MARCADAS (X) (${marcasX.length}) ══`);
console.log("  " + marcasX.join(" "));

// 2) Marcadores "[Insertar…]" de la plantilla: qué pasó con cada uno.
console.log(`\n══ DESTINO DE LOS MARCADORES "[Insertar…]" / "[…]" DE LA PLANTILLA ══\n`);
const marcadores = [...plantilla.entries()]
  .filter(([, t]) => t.startsWith("[Insertar") || t.startsWith("[…]") || t === "[...]" || t.startsWith("[…"))
  .map(([k]) => k);
let sinTocar = 0;
for (const key of marcadores) {
  const [r, c] = key.split(":").map(Number);
  const gen = texto(G, r, c);
  const estado = gen === "NO CORRESPONDE" ? "NO CORRESPONDE" : gen ? "ESCRIBE" : "vacío";
  if (estado === "vacío") sinTocar++;
  if (estado !== "NO CORRESPONDE") {
    const addr = `${String.fromCharCode(64 + c)}${r}`;
    if (estado === "ESCRIBE") {
      console.log(`  ${addr.padEnd(5)} "${plantilla.get(key)!.slice(0, 50)}" → ${gen.slice(0, 80)}`);
    } else {
      console.log(`  ${addr.padEnd(5)} "${plantilla.get(key)!.slice(0, 50)}" → ⚠ queda VACÍO`);
    }
  }
}
console.log(`\n  Marcadores tratados: ${marcadores.length} · vacíos sin escribir (posible hueco): ${sinTocar}`);
if (sinTocar > 0) console.log("  ⚠ Revisar las celdas vacías listadas arriba: el formato original las pide llenar.");

// 3) Las "Señalar si…" / "Seleccionar…" del original: ¿tienen casilla marcada?
console.log(`\n══ PREGUNTAS "Señalar si…" que quedan CON LAS CASILLAS EN BLANCO ══\n`);
for (let r = 1; r <= 259; r++) {
  const t = texto(P, r, 2);
  if (!/^Señalar|^Seleccion(a|ar)|¿/.test(t) && !t.includes("Señalar")) continue;
  // la fila de la pregunta: ver si alguna celda de la fila es X
  let x = "";
  for (let c = 1; c <= 10; c++) if (texto(G, r, c) === "X") x = `X en ${String.fromCharCode(64 + c)}${r}`;
  if (!x) console.log(`  r${r} «${t.slice(0, 80)}»`);
}