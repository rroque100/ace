// "Solicitud de propuesta de miembros del Comité de Selección" (paso A6), en
// Excel, cuando el tipo de evaluador es COMITÉ. Carga la plantilla oficial
// (lib/plantillas-f1/solicitud-comite.xlsx) y solo rellena las celdas de datos:
// la plantilla ya trae todo el layout (merges, anchos, bordes, fuentes), así que
// no se reconstruye formato en runtime (mismo criterio que la certificación A7).
//
// El formato oficial tiene dos partes: la SOLICITUD del órgano encargado (OEC/DEC)
// y la PROPUESTA de miembros. Aquí se rellena lo que ACE conoce del expediente;
// lo que es decisión de un funcionario (suplentes, observaciones, firmas) se deja
// para completar a mano sobre el formato ya armado.

import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { CeldaPreview } from "./fase1-export";

const PLANTILLA = "solicitud-comite.xlsx";

export type MiembroComite = {
  nombre: string;
  grado?: string;
  cargo?: string;
  dni?: string;
  rol?: string;
  /** Titular o suplente (Arts. 59.1, 60.1); vacío = titular. */
  condicion?: "titular" | "suplente";
};

export type SolicitudComiteInput = {
  // Cabecera de memo, tomada del Informe de Segmentación (A2, Art. 42.2).
  /** Número del informe (A2). */
  numeroInforme: string;
  /** PARA — destinatario del informe (A2). */
  destinatario: string;
  /** ATENCIÓN — área usuaria (A2). */
  atencion: string;
  /** DE — remitente (A2). */
  remitente: string;
  /** Dependencia A LA CUAL se solicita la propuesta (área usuaria / competente). */
  dependenciaSolicitada: string;
  /** Dependencia QUE solicita la propuesta (DEC). */
  dependenciaSolicitante: string;
  /** Denominación de la convocatoria (objeto de la contratación). */
  denominacion: string;
  /** Nomenclatura del procedimiento (A4). */
  nomenclatura: string;
  /** Cuantía de la contratación. */
  monto: number;
  numeroRequerimiento: string;
  fechaRequerimientoISO: string;
  /** Propuesta de la DEC: su comprador público (titular D30, suplente D31). */
  miembrosDec: MiembroComite[];
  /** Propuesta del área usuaria: 2 expertos (1º D54/D55, 2º D56/D57 con sus suplentes). */
  miembrosAreaUsuaria: MiembroComite[];
  /** Sustento del perfil del evaluador (A4 · var_e_perfil_evaluador). Va a Observaciones. */
  sustentoPerfil?: string;
  /** Nombre completo del usuario en sesión que generó la solicitud. */
  elaboradoPor?: string | null;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const [, y, mes, d] = m;
  return `${Number(d)} de ${MESES[Number(mes) - 1] ?? ""} del ${y}`;
}

function soles(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `S/. ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Un integrante en una línea: "GRADO Nombre — Cargo · Rol (DNI 12345678)". */
function textoMiembro(m: MiembroComite): string {
  const nombre = `${(m.grado ?? "").trim()} ${(m.nombre ?? "").trim()}`.trim();
  const partes = [nombre];
  if ((m.cargo ?? "").trim()) partes.push(`— ${(m.cargo ?? "").trim()}`);
  // El rol (comprador público / experto; titular o suplente) es exigencia del
  // Art. 59: el comité debe integrar al menos un comprador público.
  if ((m.rol ?? "").trim()) partes.push(`· ${(m.rol ?? "").trim()}`);
  if ((m.dni ?? "").trim()) partes.push(`(DNI ${(m.dni ?? "").trim()})`);
  return partes.filter(Boolean).join(" ");
}

/** Escribe en la celda maestra respetando merges (no rompe el layout). */
function set(ws: ExcelJS.Worksheet, addr: string, value: string | number) {
  if (value === "" || value === null || value === undefined) return;
  const cell = ws.getCell(addr);
  const target = cell.isMerged && cell.master ? cell.master : cell;
  target.value = value as ExcelJS.CellValue;
}

// Se antepone al formato un bloque de cabecera de memo (Número/PARA/ATENCIÓN/DE,
// tomado del Informe de Segmentación de A2). Como se INSERTAN filas arriba, toda
// dirección original de la plantilla se corre uniformemente +FILAS_CABECERA: el
// helper `A()` aplica ese desplazamiento para no reescribir cada celda a mano.
const FILAS_CABECERA = 5;
const A = (col: string, row: number): string => `${col}${row + FILAS_CABECERA}`;

/**
 * Valor de una línea del memo como texto enriquecido: el NOMBRE (1.ª línea) en
 * negrita y el CARGO/OFICINA (líneas siguientes) en regular y algo menor, cada
 * uno en su renglón —igual que en el documento oficial, no unidos con guion—.
 */
function valorMemo(v: string | undefined): ExcelJS.CellRichTextValue {
  const partes = (v ?? "").split(/\n/).map((s) => s.trim()).filter(Boolean);
  return {
    richText: partes.map((p, i) => ({
      text: i === partes.length - 1 ? p : `${p}\n`,
      font: i === 0
        ? { name: "Arial", size: 10, bold: true }
        : { name: "Arial", size: 9, bold: false },
    })),
  };
}

/**
 * Repara el índice interno de fusiones tras `spliceRows`.
 *
 * exceljs reposiciona las CELDAS fusionadas al insertar filas, pero NO actualiza
 * su índice `_merges` (se queda con las posiciones viejas). Ese índice es el que
 * comprueba `mergeCells` para detectar solapes y el que se serializa al guardar,
 * así que quedaba envenenado: cualquier `mergeCells` posterior fallaba con
 * "Cannot merge already merged cells" —por eso las fusiones de la cabecera no se
 * aplicaban y el número salía sin centrar—. Aquí se reconstruye `_merges` desde
 * el estado REAL de las celdas (su `master`). El constructor de Range se toma en
 * runtime de una fusión existente, para no importar una ruta interna de exceljs
 * que el bundler podría no resolver.
 */
function repararMergesTrasInsercion(ws: ExcelJS.Worksheet): void {
  const wsAny = ws as unknown as {
    _merges: Record<string, { constructor: new (t: number, l: number, b: number, r: number) => unknown }>;
  };
  const RangeCtor = Object.values(wsAny._merges ?? {})[0]?.constructor;
  if (!RangeCtor) return;
  const cajas: Record<string, { t: number; l: number; b: number; r: number }> = {};
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.isMerged || !cell.master) return;
      const a = cell.master.address;
      const box = (cajas[a] ??= { t: Infinity, l: Infinity, b: 0, r: 0 });
      const fila = Number(cell.row);
      const col = Number(cell.col);
      box.t = Math.min(box.t, fila);
      box.l = Math.min(box.l, col);
      box.b = Math.max(box.b, fila);
      box.r = Math.max(box.r, col);
    });
  });
  const idx: Record<string, unknown> = {};
  for (const a of Object.keys(cajas)) {
    const c = cajas[a];
    idx[a] = new RangeCtor(c.t, c.l, c.b, c.r);
  }
  wsAny._merges = idx as typeof wsAny._merges;
}

/**
 * Cabecera de memo en las filas 1..N (insertadas arriba): el número a lo ancho y,
 * debajo, AL/ATENCIÓN/DE con la etiqueta en A:B y el valor (multilínea) en C:I,
 * de modo que el cargo quede alineado bajo el nombre.
 */
function cabeceraMemo(ws: ExcelJS.Worksheet, input: SolicitudComiteInput) {
  // Número del documento (fila 1): centrado, en negrita algo mayor y con una
  // línea inferior que lo separa del bloque AL/ATENCIÓN/DE. Es el identificador
  // del memorándum, así que encabeza la hoja como un título, no como un dato más.
  try { ws.mergeCells("A1:I1"); } catch { /* ya combinada */ }
  const num = ws.getCell("A1");
  num.value = (input.numeroInforme ?? "").trim();
  num.font = { name: "Arial", size: 11, bold: true };
  num.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;
  // El borde inferior va en cada celda del rango combinado (ExcelJS no lo propaga
  // desde la maestra al imprimir).
  for (let c = 1; c <= 9; c++) {
    ws.getCell(1, c).border = { bottom: { style: "thin", color: { argb: "FF808080" } } };
  }

  const filas: Array<{ r: number; et: string; v: string }> = [
    { r: 2, et: "AL:", v: input.destinatario },
    { r: 3, et: "ATENCIÓN:", v: input.atencion },
    { r: 4, et: "DE:", v: input.remitente },
    // La fila 5 queda como separador entre la cabecera y el cuerpo del formato.
  ];
  for (const f of filas) {
    // Se fusiona SIEMPRE (etiqueta en A:B, valor en C:I), aunque el valor esté
    // vacío: así las tres filas del enrutamiento tienen el mismo ancho y alineación.
    try { ws.mergeCells(`A${f.r}:B${f.r}`); } catch { /* ya */ }
    try { ws.mergeCells(`C${f.r}:I${f.r}`); } catch { /* ya */ }
    const et = ws.getCell(`A${f.r}`);
    et.value = f.et;
    // Tamaño 9 (no 10): "ATENCIÓN:" cabe entero en el ancho de A:B sin recortarse.
    et.font = { name: "Arial", size: 9, bold: true };
    et.alignment = { horizontal: "left", vertical: "top" };
    const val = ws.getCell(`C${f.r}`);
    if ((f.v ?? "").trim()) val.value = valorMemo(f.v);
    val.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    // Alto según las líneas (nombre + cargo), con algo más de aire por línea y un
    // mínimo mayor para que una sola línea no quede pegada a la de arriba.
    const nLineas = Math.max(1, (f.v ?? "").split(/\n/).map((s) => s.trim()).filter(Boolean).length);
    ws.getRow(f.r).height = Math.max(18, nLineas * 14 + 4);
  }
}

function llenar(ws: ExcelJS.Worksheet, input: SolicitudComiteInput) {
  // Estructura: se antepone la cabecera de memo (A2) insertando filas arriba y se
  // ocultan las filas 3-4 ("Datos del documento": Número/Fecha), que el memo
  // reemplaza. Ocultar —en vez de borrar— es el patrón seguro de la lib de
  // certificación: no toca merges ni corrompe el formato.
  ws.spliceRows(1, 0, [], [], [], [], []); // inserta FILAS_CABECERA filas arriba
  // Tras insertar filas, el índice de fusiones de exceljs queda desfasado y hace
  // fallar las fusiones de la cabecera; se reconstruye antes de tocarlas.
  repararMergesTrasInsercion(ws);
  // Se ocultan las filas 6-13 del formato final (antiguas filas 1-8): el título
  // vacío, la sección "Datos del documento" (Número/Fecha) y las secciones 2-3
  // (dependencia a la cual/que solicita), que el encabezado AL/ATENCIÓN/DE ya
  // cubre. Así la cabecera fluye directo a "Datos del procedimiento" (sección 4).
  for (let r = 1 + FILAS_CABECERA; r <= 8 + FILAS_CABECERA; r++) ws.getRow(r).hidden = true;

  // ── Terminología a la Ley N° 32069 (direcciones corridas +FILAS_CABECERA) ────
  // La plantilla es del régimen derogado (Ley 30225 / D.S. 344-2018-EF): "Órgano
  // Encargado (OEC)", "valor estimado o valor referencial", Art. 44 de aquel
  // reglamento. Se reescriben esos rótulos con la terminología vigente.
  set(ws, A("B", 24), "PROPUESTA DE LA DEPENDENCIA ENCARGADA DE LAS CONTRATACIONES (DEC)");
  set(ws, A("B", 38), "NOMBRE, DENOMINACIÓN DEL CARGO Y FIRMA DEL/DE LA JEFE(A) DE LA DEPENDENCIA ENCARGADA DE LAS CONTRATACIONES (DEC)");
  set(
    ws,
    A("B", 29),
    "Por medio de la presente, se solicita proponer a los miembros que integrarán el comité de selección (tres integrantes), de los cuales al menos uno (1) debe ser comprador público y al menos uno (1) debe contar con conocimiento técnico en el objeto de la contratación. Tratándose de ejecución de obras, consultoría en general y consultoría de obras, al menos dos (2) deben contar con conocimiento técnico. Asimismo, proponer a los miembros suplentes, precisando a qué titular reemplazará en caso de ausencia.",
  );
  set(
    ws,
    A("B", 32),
    "Ley N° 32069, Ley General de Contrataciones Públicas, y su Reglamento (D.S. N° 009-2025-EF), Arts. 56 al 60 (evaluadores). El comité de selección se integra por tres (3) miembros, con al menos un (1) comprador público, y decide de forma colegiada. Referencia: Guía de Actuaciones Preparatorias del OECE, Cuadros N° 6 y 7.",
  );
  // 4.4: "valor estimado o valor referencial" → "cuantía de la contratación"
  // (Art. 47.1). Ya no hay valor referencial: se oculta su renglón (antigua fila 19).
  set(ws, A("C", 18), "CUANTÍA DE LA CONTRATACIÓN");
  set(ws, A("E", 18), "Monto de la cuantía");
  ws.getRow(19 + FILAS_CABECERA).hidden = true;

  // 2 y 3. Dependencias.
  set(ws, A("E", 6), input.dependenciaSolicitada);
  set(ws, A("E", 8), input.dependenciaSolicitante);
  // 4. Datos del procedimiento (4.1 denominación, 4.3 nomenclatura, 4.4 cuantía).
  set(ws, A("E", 12), input.denominacion);
  set(ws, A("E", 16), input.nomenclatura);
  set(ws, A("H", 18), soles(input.monto));
  // 5. Antecedentes de la contratación (número y fecha del requerimiento).
  set(ws, A("G", 21), input.numeroRequerimiento);
  set(ws, A("G", 22), fechaLarga(input.fechaRequerimientoISO));

  // 6 y 12. Dos propuestas (Art. 59.1, con titulares y suplentes):
  //  · PROPUESTA DE LA DEC: su comprador público como TITULAR (D30) y su SUPLENTE
  //    (D31).
  //  · PROPUESTA DEL ÁREA USUARIA: los dos expertos —1º titular D54 y su suplente
  //    D55; 2º titular D56 y su suplente D57—.
  // El titular y el suplente se emparejan por orden dentro de cada lista.
  const decTit = input.miembrosDec.filter((x) => (x.condicion ?? "titular") === "titular");
  const decSup = input.miembrosDec.filter((x) => x.condicion === "suplente");
  if (decTit[0]) set(ws, A("D", 25), textoMiembro(decTit[0])); // D30
  if (decSup[0]) set(ws, A("D", 26), textoMiembro(decSup[0])); // D31

  const areaTit = input.miembrosAreaUsuaria.filter((x) => (x.condicion ?? "titular") === "titular");
  const areaSup = input.miembrosAreaUsuaria.filter((x) => x.condicion === "suplente");
  if (areaTit[0]) set(ws, A("D", 49), textoMiembro(areaTit[0])); // D54 · 1er miembro
  if (areaSup[0]) set(ws, A("D", 50), textoMiembro(areaSup[0])); // D55 · su suplente
  if (areaTit[1]) set(ws, A("D", 51), textoMiembro(areaTit[1])); // D56 · 2º miembro
  if (areaSup[1]) set(ws, A("D", 52), textoMiembro(areaSup[1])); // D57 · su suplente

  // Se ocultan las filas físicas 48-51 (plantilla 43-46): el segundo bloque "DATOS
  // DEL DOCUMENTO" (Número/Fecha) que la plantilla repite para la propuesta del
  // área usuaria, más sus dos filas en blanco. ACE no lo llena y no se usa, así que
  // la propuesta fluye directo de su encabezado a los miembros (D54-D57).
  for (let r = 43; r <= 46; r++) ws.getRow(r + FILAS_CABECERA).hidden = true;

  // 9. Observaciones: sustento del perfil del evaluador (A4). La celda de valor
  // (antigua fila 35) no viene combinada en la plantilla; se combina para que el
  // texto largo se vea entero.
  if ((input.sustentoPerfil ?? "").trim()) {
    const obs = A("B", 35);
    try { ws.mergeCells(`${obs}:${A("I", 35)}`); } catch { /* ya combinada */ }
    const cel = ws.getCell(obs);
    cel.value = `Sustento del perfil del evaluador: ${input.sustentoPerfil!.trim()}`;
    cel.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    cel.font = { name: "Arial", size: 9 };
    ws.getRow(35 + FILAS_CABECERA).height = 60;
  }

  // Trazabilidad de quién generó el documento: fila nueva, la plantilla termina
  // en la física 58 (firma del área usuaria) y no trae nada más.
  if (input.elaboradoPor) {
    ws.getCell("B60").value = `Elaborado por: ${input.elaboradoPor}`;
    ws.getCell("B60").font = { name: "Arial", size: 10, bold: true };
  }

  // Cabecera de memo (filas 1..N insertadas arriba).
  cabeceraMemo(ws, input);
}

async function cargarHoja(): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet }> {
  const ruta = path.join(process.cwd(), "lib", "plantillas-f1", PLANTILLA);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  return { wb, ws: wb.worksheets[0] };
}

export async function buildSolicitudComite(input: SolicitudComiteInput): Promise<Buffer> {
  const { wb, ws } = await cargarHoja();
  llenar(ws, input);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Texto plano de una celda (soporta richText), para la vista previa. */
function textoCelda(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    const rich = v as { richText?: { text?: string }[] };
    if (rich.richText) return rich.richText.map((t) => t.text ?? "").join("");
    return String((v as { text?: string }).text ?? "");
  }
  return String(v);
}

/**
 * Vista previa de la hoja tal y como se exporta: mismas celdas, combinaciones y
 * marcas. Se compara con la plantilla en blanco (con la cabecera ya insertada,
 * para que las filas coincidan) y así se resalta lo que rellena ACE.
 */
export async function previewSolicitudComite(
  input: SolicitudComiteInput,
): Promise<{ titulo: string; filas: CeldaPreview[][] }> {
  const { ws } = await cargarHoja();
  const { ws: wsBase } = await cargarHoja();
  // La plantilla base se alinea con la insertada por `llenar` (mismo número de
  // filas de cabecera), para que la comparación por posición no salga corrida.
  wsBase.spliceRows(1, 0, ...Array.from({ length: FILAS_CABECERA }, () => []));
  // Se recorre desde la columna A (1): ahí van el número del memo y las etiquetas
  // AL/ATENCIÓN/DE de la cabecera; sin la columna A la previa los ocultaba.
  const original = new Map<string, string>();
  for (let r = 1; r <= wsBase.rowCount; r++) {
    for (let c = 1; c <= 11; c++) original.set(`${r}:${c}`, textoCelda(wsBase.getCell(r, c)).trim());
  }

  llenar(ws, input);

  const cubierta = (cell: ExcelJS.Cell) =>
    cell.isMerged && cell.master ? cell.master.address !== cell.address : false;

  const filas: CeldaPreview[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    if (ws.getRow(r).hidden) continue; // las filas ocultas no se previsualizan
    const fila: CeldaPreview[] = [];
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getCell(r, c);
      if (cubierta(cell)) continue;
      const texto = textoCelda(cell);
      let colspan = 1;
      for (let cc = c + 1; cc <= 11; cc++) {
        const vecina = ws.getCell(r, cc);
        if (vecina.isMerged && vecina.master?.address === cell.address) colspan += 1;
        else break;
      }
      let rowspan = 1;
      for (let rr = r + 1; rr <= ws.rowCount; rr++) {
        const vecina = ws.getCell(rr, c);
        if (vecina.isMerged && vecina.master?.address === cell.address) rowspan += 1;
        else break;
      }
      const h = cell.alignment?.horizontal;
      fila.push({
        celda: cell.address,
        texto,
        colspan,
        rowspan,
        marca: texto.trim() === "X",
        negrita: Boolean(cell.font?.bold),
        relleno: texto.trim() !== "" && texto.trim() !== (original.get(`${r}:${c}`) ?? ""),
        alineacion: h === "center" ? "center" : h === "right" ? "right" : undefined,
      });
    }
    filas.push(fila);
  }
  return { titulo: "Solicitud de propuesta de miembros del Comité de Selección", filas };
}
