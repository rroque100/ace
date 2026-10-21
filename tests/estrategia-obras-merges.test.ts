import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

/**
 * Bug real: en un expediente de obra/consultoría de obra con cronograma y
 * roles ampliados (más actividades/roles que los que trae la plantilla), las
 * celdas de "II. SOLO PARA OBRAS" a partir de a) Tipo de contrato (fila 191
 * de la plantilla en blanco) salían desformateadas en el .xlsx exportado:
 * `duplicateRow` (usado para insertar filas de cronograma/roles) desincroniza
 * las combinaciones de TODO lo que queda por debajo, y solo c)/f)/g)/i)
 * tenían reparación (`BLOQUES_OBRAS`). a), b), d), e) y h) —y el título
 * "II." mismo— no la tenían.
 */
const proceso: ProcesoExport = {
  amount: 450_000,
  entity: "MDCH",
  nomenclature: "N° 12-2026-DEC-MDCH",
  object_type: "obras",
  procedure_type: null,
  valor_estimado: 450_000,
};

// Más actividades/roles que la plantilla (3 selección + 3 ejecución + 2
// roles): fuerza las mismas inserciones de fila que desincronizan los merges
// de todo lo que queda por debajo, incluida la sección "SOLO PARA OBRAS".
const CRONOGRAMA_AMPLIO = [
  { fase: "preparatorias", actividad: "Aprobación del expediente", fin: "2026-07-16", inicio: "2026-07-16" },
  { fase: "preparatorias", actividad: "Elaboración de las bases", fin: "2026-07-16", inicio: "2026-07-16" },
  { fase: "seleccion", actividad: "Convocatoria", fin: "2026-07-17", inicio: "2026-07-17" },
  { fase: "seleccion", actividad: "Formulación de consultas y observaciones", fin: "2026-07-22", inicio: "2026-07-22" },
  { fase: "seleccion", actividad: "Absolución de consultas y observaciones", fin: "2026-07-23", inicio: "2026-07-23" },
  { fase: "seleccion", actividad: "Integración de las Bases", fin: "2026-07-23", inicio: "2026-07-23" },
  { fase: "seleccion", actividad: "Otorgamiento de buena pro", fin: "2026-07-30", inicio: "2026-07-30" },
  { fase: "seleccion", actividad: "Consentimiento de buena pro", fin: "2026-08-12", inicio: "2026-08-12" },
  { fase: "ejecucion", actividad: "Presentación de requisitos para firma", fin: "2026-08-24", inicio: "2026-08-13" },
  { fase: "ejecucion", actividad: "Suscripción del contrato", fin: "2026-08-27", inicio: "2026-08-16" },
  { fase: "ejecucion", actividad: "Ejecución contractual", fin: "SEGÚN BASES", inicio: "SEGÚN BASES" },
];

const ROLES_AMPLIO = [
  { etapa: "actos_preparatorios", rol: "Área Usuaria: elabora las Especificaciones Técnicas" },
  { etapa: "actos_preparatorios", rol: "Oficina de Abastecimiento: planificación y segmentación" },
  { etapa: "convocatoria", rol: "Oficial de compra: elaboración y aprobación de bases" },
  { etapa: "post_convocatoria", rol: "Oficina de Abastecimiento: formalización contractual" },
  { etapa: "ejecucion_contractual", rol: "Área Usuaria: control de ingreso y conformidad" },
];

async function hojaObras() {
  const a4: Record<string, unknown> = {
    cronograma_items: CRONOGRAMA_AMPLIO,
    roles_items: ROLES_AMPLIO,
    obra_a_tipo_contrato: "SUSTENTO-TIPO-CONTRATO-XYZ",
    obra_b_bim: "SUSTENTO-BIM-XYZ",
    obra_c_incentivos: "SUSTENTO-INCENTIVOS-XYZ",
    obra_d_fast_track: "SUSTENTO-FAST-TRACK-XYZ",
    obra_e_terreno: "SUSTENTO-TERRENO-XYZ",
    obra_f_licencias: "SUSTENTO-LICENCIAS-XYZ",
    obra_g_expediente_tecnico: "SUSTENTO-RESPONSABLE-XYZ",
    obra_h_estructura_costos: "SUSTENTO-ESTRUCTURA-COSTOS-XYZ",
    obra_i_metodologias_colaborativas: "SUSTENTO-METODOLOGIAS-XYZ",
  };
  const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

// Busca la fila cuyo texto de columna B (celda maestra si está combinada)
// contiene `texto`, y devuelve su número. Como las inserciones de cronograma
///roles desplazan todo lo de abajo, no se puede asumir una fila fija.
function filaConTexto(ws: ExcelJS.Worksheet, texto: string): number {
  for (let r = 1; r <= ws.rowCount; r++) {
    const cell = ws.getCell(`B${r}`);
    const target = cell.isMerged ? cell.master : cell;
    const v = target.value;
    const t = typeof v === "string" ? v : v && typeof v === "object" && "richText" in v ? (v as { richText: { text?: string }[] }).richText.map((x) => x.text ?? "").join("") : "";
    if (t.includes(texto)) return r;
  }
  throw new Error(`No se encontró ninguna fila con "${texto}"`);
}

// La celda debe estar combinada B..J de esa fila, con el VALOR en la celda
// maestra (B) y ninguna copia "fantasma" repetida en las demás columnas.
function assertFilaCombinadaBJ(ws: ExcelJS.Worksheet, fila: number, valorEsperado: string) {
  const b = ws.getCell(`B${fila}`);
  expect(b.isMerged, `B${fila} debería estar combinada`).toBe(true);
  expect(b.master.address).toBe(`B${fila}`);
  expect(String(b.master.value)).toBe(valorEsperado);
  const j = ws.getCell(`J${fila}`);
  expect(j.isMerged, `J${fila} debería pertenecer al mismo merge que B${fila}`).toBe(true);
  expect(j.master.address).toBe(`B${fila}`);
  // Ninguna columna intermedia debe traer el texto repetido (el síntoma del bug).
  for (const col of ["D", "F", "H"]) {
    const c = ws.getCell(`${col}${fila}`);
    if (c.isMerged) expect(c.master.address).toBe(`B${fila}`);
    else expect(c.value).toBeFalsy();
  }
}

describe("II. Solo para obras: merges tras insertar filas de cronograma/roles", () => {
  it("a) Tipo de contrato conserva el formato (regresión: fila 191 de la plantilla)", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Sustento de la elección del tipo de contrato");
    assertFilaCombinadaBJ(ws, fila + 1, "SUSTENTO-TIPO-CONTRATO-XYZ");
  });

  it("b) BIM conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Sustento de la necesidad de emplear");
    assertFilaCombinadaBJ(ws, fila + 1, "SUSTENTO-BIM-XYZ");
  });

  it("d) Ejecución rápida (fast track) conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Sustento para ejecutar la obra mediante");
    assertFilaCombinadaBJ(ws, fila + 1, "SUSTENTO-FAST-TRACK-XYZ");
  });

  it("e) Disponibilidad del terreno conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Sustento para la disponibilidad física");
    assertFilaCombinadaBJ(ws, fila + 1, "SUSTENTO-TERRENO-XYZ");
  });

  it("h) Estructura de costos conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Sustento de la actualización de la estru");
    assertFilaCombinadaBJ(ws, fila + 1, "SUSTENTO-ESTRUCTURA-COSTOS-XYZ");
  });

  it("c) Incentivos: el sub-título conserva el formato (regresión: no estaba cubierto ni antes de este fix)", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Propuesta de incentivos por beneficios");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "Propuesta de incentivos por beneficios o mejoras de naturaleza técnica, económica, social, ambiental y de plazo para la entidad contratante y para el proyecto",
    );
  });

  it("f) Licencias: el sub-título conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Plan para la obtención de las licencias");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "Plan para la obtención de las licencias, autorizaciones, permisos, servidumbre y similares por parte de la entidad contratante.",
    );
  });

  it("g) Responsable del expediente técnico: el sub-título conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Determinación del responsable de la elaboración");
    assertFilaCombinadaBJ(ws, fila, "Determinación del responsable de la elaboración del expediente técnico del adicional de obra.");
  });

  it("i) Metodologías colaborativas: el sub-título conserva el formato", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "Metodologías colaborativas que contribuyen");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "Metodologías colaborativas que contribuyen a la optimización de procesos, sostenibilidad y eficiencia en la ejecución de las obras y/o consultorías de obras.",
    );
  });

  it("el título 'II. SOLO PARA OBRAS…' sigue combinado B:J", async () => {
    const ws = await hojaObras();
    const fila = filaConTexto(ws, "SOLO PARA OBRAS");
    assertFilaCombinadaBJ(
      ws,
      fila,
      "II. SOLO PARA OBRAS Y CONSULTORÍA DE OBRAS (Numeral 154.1 del artículo 154 del Reglamento)",
    );
  });
});
