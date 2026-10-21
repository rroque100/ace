// Anexo "Solicitud de Certificación de Crédito Presupuestario" (paso A7), en
// Excel. Carga la plantilla oficial de la entidad (lib/plantillas-f1/
// solicitud-certificacion.xlsx —derivada del modelo aprobado por la entidad—) y
// solo rellena las celdas de datos. La plantilla ya trae TODO el layout (merges,
// anchos, altos, bordes, fuentes, alineaciones y pageSetup), así que el builder
// no reconstruye formato en runtime: calca el modelo y evita las corrupciones
// que causaba la cirugía de celdas.

import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { CeldaPreview } from "./fase1-export";
import { numeroALetras } from "./numero-a-letras";

const PLANTILLA = "solicitud-certificacion.xlsx";

export type SolicitudCertInput = {
  informeNumero: string;
  /** Destinatario "A": nombre del responsable + nombre de la oficina (OGA). */
  al: { nombre: string; oficina: string };
  /** Atención: nombre del responsable + nombre de la oficina (Planeamiento y Presupuesto). */
  atencion: { nombre: string; oficina: string };
  /** Remitente "DE": Jefe de Logística / Abastecimiento (la DEC). */
  del: { grado?: string; nombre: string; cargo: string };
  ciudad: string;
  fechaISO: string;
  procedimientoLabel: string;
  nomenclatura: string;
  objeto: string;
  proyectoInversion: string;
  cui: string;
  monto: number;
  esObra: boolean;
  areaUsuaria: string;
  referenciaPac: string;
  plazoEjecucion: string;
  anioCertificacion: string;
  montoCertificacion: number;
  anioPrevision: string;
  montoPrevision: number;
  /**
   * ¿Se muestra el bloque de previsión (filas 39-42)? true para "ambas" y
   * "previsión"; false para certificación de crédito presupuestal (se ocultan).
   */
  mostrarPrevision: boolean;
  /** ¿El procedimiento de A4 es competitivo? Si sí, se ocultan las filas 25-26. */
  esCompetitivo: boolean;
  /** N.° del CMN (A1 · "N.° del CMN"), para la columna interna de la fila 30. */
  nroCmn: string;
  /** Clasificador de gasto de la Necesidad, para la columna interna de la fila 37. */
  clasificadorGasto: string;
  // Coordenadas presupuestales de la certificación/previsión (de la Necesidad).
  // Sin ellas, Presupuesto no puede afectar el crédito (DL 1440; Art. 54.2.f).
  fuenteFinanciamiento: string;
  rubro: string;
  metaPresupuestal: string;
  cadenaFuncional: string;
  /** Nombre completo del usuario en sesión que generó la solicitud. */
  elaboradoPor?: string | null;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "____________________";
  const [, y, mes, d] = m;
  return `${Number(d)} de ${MESES[Number(mes) - 1] ?? ""} del ${y}`;
}

/** Monto con símbolo de soles y separadores: 300000 → "S/. 300,000.00". */
function soles(n: number): string {
  return `S/. ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Texto plano de una celda (para el rellenado y la vista previa). */
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

// Escribe en la celda maestra respetando merges.
function set(ws: ExcelJS.Worksheet, addr: string, value: string | number) {
  if (value === "" || value === null || value === undefined) return;
  const cell = ws.getCell(addr);
  const target = cell.isMerged && cell.master ? cell.master : cell;
  target.value = value as ExcelJS.CellValue;
}

/**
 * Mueve una etiqueta a otra celda combinada conservando el estilo.
 *
 * Se usa para las etiquetas cuya celda maestra queda en una fila OCULTA: al
 * ocultar la fila, un rótulo anclado ahí no se ve. Se descombina el rango
 * viejo, se combina el nuevo —dentro de filas visibles—, se copia el estilo de
 * la maestra original y se escribe el texto (o se reescribe el que había).
 *
 * Es cirugía PUNTUAL sobre un merge conocido, no el splice de filas que corrompía
 * el formato (por eso el resto del layout viene intacto de la plantilla).
 */
/** Ancho por defecto de la plantilla (columnas sin ancho propio). */
const ANCHO_COL_DEFECTO = 9.14;
/** Altura de una línea con Arial 11 (puntos). */
const ALTO_LINEA = 15;

/**
 * Ajusta la altura de una fila al texto que contiene, para que se vea entero.
 *
 * Las celdas de denominación (14, 16) y objeto (18) llevan textos largos y
 * `wrapText`, pero Excel NO recalcula el alto de la fila al abrir el archivo:
 * si la altura fija se queda corta, el texto queda cortado. ExcelJS tampoco
 * autoajusta, así que se estima aquí.
 *
 * Cuántos caracteres caben por línea ≈ la suma de anchos de las columnas
 * combinadas (la unidad de ancho de Excel es aproximadamente un carácter). Se
 * aplica un 0.92 para quedar del lado seguro: el ajuste rompe por PALABRAS, no
 * por caracteres, así que caben algo menos de los que la anchura sugiere. Es
 * preferible pasarse de alto —queda blanco abajo— a cortar texto.
 *
 * Crece y decrece: una denominación corta deja la fila baja; una larga la sube.
 */
function ajustarAlto(
  ws: ExcelJS.Worksheet,
  fila: number,
  colInicio: number,
  colFin: number,
  texto: string,
) {
  let ancho = 0;
  for (let c = colInicio; c <= colFin; c++) ancho += ws.getColumn(c).width ?? ANCHO_COL_DEFECTO;
  const porLinea = Math.max(1, ancho * 0.92);
  // Se cuentan las líneas de cada salto explícito por separado (un renglón corto
  // seguido de uno largo no comparten cupo).
  const lineas = (texto || "")
    .split("\n")
    .reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / porLinea)), 0);
  ws.getRow(fila).height = Math.max(ALTO_LINEA, lineas * ALTO_LINEA + 3);
}

function reanclarEtiqueta(
  ws: ExcelJS.Worksheet,
  rangoViejo: string,
  rangoNuevo: string,
  texto?: string,
) {
  const maestraVieja = ws.getCell(rangoViejo.split(":")[0]);
  const estilo = maestraVieja.style;
  const valor = texto ?? (maestraVieja.value as ExcelJS.CellValue);
  ws.unMergeCells(rangoViejo);
  ws.mergeCells(rangoNuevo);
  const maestraNueva = ws.getCell(rangoNuevo.split(":")[0]);
  maestraNueva.style = estilo;
  maestraNueva.value = valor;
}

/** Rellena la hoja con los datos del expediente (compartido por export y preview). */
function llenarSolicitud(ws: ExcelJS.Worksheet, input: SolicitudCertInput) {
  const delNombre = `${(input.del.grado ?? "").trim()} ${input.del.nombre}`.trim();

  // Cabecera (memo). B1 recibe la numeración completa ("INFORME N° 001-2026-…").
  if (input.informeNumero) set(ws, "B1", input.informeNumero);
  if (input.al.nombre) set(ws, "C2", `: ${input.al.nombre}`);
  if (input.al.oficina) set(ws, "C3", input.al.oficina);
  if (input.atencion.nombre) set(ws, "C5", `: ${input.atencion.nombre}`);
  if (input.atencion.oficina) set(ws, "C6", input.atencion.oficina);
  if (delNombre) set(ws, "C8", `: ${delNombre}`);
  if (input.del.cargo) set(ws, "C9", input.del.cargo);
  set(ws, "C12", `: ${input.ciudad || "____________"}, ${fechaLarga(input.fechaISO)}`);

  // La plantilla (derivada del modelo oficial de la entidad) YA trae todo el
  // layout: merges, anchos de columna, altos de fila, bordes, fuentes y
  // alineaciones. Aquí solo se rellenan los datos del expediente y se ocultan
  // las filas que no aplican. Así el resultado calca el modelo y se evita la
  // frágil cirugía de formato en runtime (origen de las corrupciones previas).

  // 1. Denominación de la convocatoria = nombre de la contratación (Necesidad).
  set(ws, "E14", input.objeto);
  // 2. Denominación de la inversión + código de inversión.
  if (input.proyectoInversion) set(ws, "E16", input.proyectoInversion);
  if (input.cui) set(ws, "K16", input.cui);
  // 3. Objeto de la solicitud.
  const objetoSolicitud = `Emisión de la certificación del crédito presupuestario para ${input.objeto}`;
  set(ws, "E18", objetoSolicitud);

  // La altura de las filas de texto largo se ajusta al contenido para que se vea
  // entero. E14:K14 y E18:K18 abarcan E..K; E16:I16, E..I.
  ajustarAlto(ws, 14, 5, 11, input.objeto);
  ajustarAlto(ws, 16, 5, 9, input.proyectoInversion ?? "");
  ajustarAlto(ws, 18, 5, 11, objetoSolicitud);
  // 4. Cuantía de la contratación. La Ley 32069 sustituyó "valor estimado o
  // valor referencial" por "cuantía de la contratación": ya no hay elección
  // entre ambos, así que las filas 19-20 (los dos sub-encabezados con sus
  // casillas) se ocultan y la etiqueta se renombra y se mueve a la fila 21, que
  // sigue visible. Solo quedan MONEDA (21) y MONTO (22).
  ws.getRow(19).hidden = true;
  ws.getRow(20).hidden = true;
  reanclarEtiqueta(ws, "C19:D22", "C21:D22", "CUANTÍA DE LA CONTRATACIÓN");
  reanclarEtiqueta(ws, "B19:B22", "B21:B22", "4");
  set(ws, "G21", "X"); // moneda: soles
  // Monto con símbolo de soles y, entre paréntesis, el importe en letras.
  set(ws, "F22", `${soles(input.monto)} (${numeroALetras(String(input.monto))})`);
  // 5. Tipo de procedimiento + nomenclatura del proceso (A4).
  const procNomenclatura = [input.procedimientoLabel, (input.nomenclatura ?? "").trim()]
    .filter(Boolean)
    .join(" ");
  set(ws, "C24", `TIPO DE PROCEDIMIENTO DE SELECCIÓN:  ${procNomenclatura}`);
  // 6. Área usuaria.
  set(ws, "E28", input.areaUsuaria);
  // 7. Referencia en el CMN y el PAC (la plantilla ya divide E30:G30 / H30:K30).
  set(ws, "C30", "NÚMERO DE REFERENCIA EN EL CMN Y PAC");
  set(ws, "E30", input.nroCmn ? `N° CMN: ${input.nroCmn}` : "N° CMN: -");
  set(ws, "H30", input.referenciaPac ? `N° PAC: ${input.referenciaPac}` : "N° PAC: -");
  // 8. Duración aproximada del procedimiento (— si no hay dato).
  set(ws, "E32", "-");
  // 9. Plazo de ejecución.
  set(ws, "E34", input.plazoEjecucion || "-");
  // 10. Certificación (año en curso).
  //
  // La fila 36 traía el banner "TRATÁNDOSE DE EJECUCIONES CONTRACTUALES…", que
  // era redundante con la nota legal del pie (DL 1440). En su lugar aloja las
  // COORDENADAS PRESUPUESTALES que Presupuesto necesita para afectar el crédito:
  // fuente de financiamiento, rubro, meta y clasificador de gasto. Sin ellas la
  // solicitud pide un monto sin decir contra qué partida (Art. 54.2.f y 53.1 del
  // Reglamento; el detalle presupuestal lo gobierna el DL 1440).
  //
  // Se descombina el banner (C36:K36) y se arma etiqueta + valor. El valor va en
  // una sola celda que se ajusta de alto al contenido, para que quepan todas las
  // coordenadas sin cortar. El "10" de B36:B37 se conserva: sigue siendo el ítem
  // de la certificación, ahora con sus coordenadas.
  // Una coordenada por renglón (salto de línea dentro de la celda), no separadas
  // por "|": con la celda combinada y muchos datos, la línea corrida no se leía.
  // `wrapText` ya está activo y `ajustarAlto` cuenta cada renglón, así que la
  // fila crece para mostrarlos todos.
  const coordenadas = [
    `Fuente de financiamiento: ${input.fuenteFinanciamiento || "-"}`,
    input.rubro ? `Rubro: ${input.rubro}` : "",
    `Meta presupuestaria: ${input.metaPresupuestal || "-"}`,
    input.cadenaFuncional ? `Cadena funcional: ${input.cadenaFuncional}` : "",
    `Clasificador de gasto: ${input.clasificadorGasto || "-"}`,
  ]
    .filter(Boolean)
    .join("\n");
  reanclarEtiqueta(ws, "C36:K36", "C36:D36", "DATOS PRESUPUESTALES");
  ws.mergeCells("E36:K36");
  const celdaCoord = ws.getCell("E36");
  celdaCoord.value = coordenadas;
  celdaCoord.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  celdaCoord.font = { name: "Arial", size: 10 };
  ajustarAlto(ws, 36, 5, 11, coordenadas);

  if (input.anioCertificacion) set(ws, "E37", input.anioCertificacion);
  // El clasificador ya va en las coordenadas de la fila 36; la celda F37 (un
  // hueco entre año y monto) se deja como en la plantilla.
  if (input.montoCertificacion > 0) set(ws, "J37", soles(input.montoCertificacion));
  // 11. Previsión (años futuros). Solo para "ambas"/"previsión"; en certificación
  // de crédito presupuestal se ocultan sus filas (39-42).
  if (input.mostrarPrevision) {
    if (input.anioPrevision) set(ws, "E40", input.anioPrevision);
    if (input.montoPrevision > 0) set(ws, "J40", soles(input.montoPrevision));
  } else {
    for (let r = 39; r <= 42; r++) ws.getRow(r).hidden = true;
  }
  // 12. Línea de firma: solo "DEC".
  set(ws, "C45", "DEC");

  // Trazabilidad de quién generó el documento: fila nueva, la plantilla termina
  // en la 48 (nota IMPORTANTE) y no trae nada más.
  if (input.elaboradoPor) {
    set(ws, "B50", `Elaborado por: ${input.elaboradoPor}`);
    ws.getCell("B50").font = { name: "Arial", size: 10, bold: true };
  }

  // Nota "IMPORTANTE" al pie: es la BASE LEGAL de la previsión presupuestal (DL
  // 1440, Art. 41.4) y lo que la sustenta ante Presupuesto. Antes se ocultaba
  // siempre; se restaura porque explica por qué existe el bloque de previsión.
  // La 48 lleva un texto largo: se ajusta de alto para que se lea completo.
  ajustarAlto(ws, 48, 2, 11, textoCelda(ws.getCell("B48")));

  // Si el procedimiento de A4 es COMPETITIVO, se ocultan las filas 25-26
  // (aplican solo a los no competitivos / contratación directa).
  if (input.esCompetitivo) {
    ws.getRow(25).hidden = true;
    ws.getRow(26).hidden = true;
  }

  // ExcelJS descarta el ancho de la columna K al reescribir la plantilla; se
  // re-fija (9) para calcar el modelo.
  ws.getColumn(11).width = 9;

  // Impresión: A4, portrait, centrada horizontalmente, en una sola hoja con la
  // misma escala fija del modelo (modo escala, no fit-to-page, que Excel acepta).
  ws.pageSetup.paperSize = 9; // 9 = A4
  ws.pageSetup.orientation = "portrait";
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.verticalCentered = false;
  ws.pageSetup.fitToPage = false;
  ws.pageSetup.scale = 69;
}

async function cargarHoja(): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet }> {
  const ruta = path.join(process.cwd(), "lib", "plantillas-f1", PLANTILLA);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  return { wb, ws: wb.worksheets[0] };
}

export async function buildSolicitudCertificacion(input: SolicitudCertInput): Promise<Buffer> {
  const { wb, ws } = await cargarHoja();
  llenarSolicitud(ws, input);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Vista previa de la hoja tal y como se exporta: mismas celdas, combinaciones y
 * marcas. Compara con la plantilla en blanco para resaltar lo que rellena ACE.
 */
export async function previewSolicitudCertificacion(
  input: SolicitudCertInput,
): Promise<{ titulo: string; filas: CeldaPreview[][] }> {
  const { ws } = await cargarHoja();
  const { ws: wsBase } = await cargarHoja();
  const original = new Map<string, string>();
  for (let r = 1; r <= wsBase.rowCount; r++) {
    for (let c = 2; c <= 11; c++) original.set(`${r}:${c}`, textoCelda(wsBase.getCell(r, c)).trim());
  }

  llenarSolicitud(ws, input);

  const cubierta = (cell: ExcelJS.Cell) =>
    cell.isMerged && cell.master ? cell.master.address !== cell.address : false;

  const filas: CeldaPreview[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    // Las filas ocultas (p. ej. la previsión en certificación) no se previsualizan.
    if (ws.getRow(r).hidden) continue;
    const fila: CeldaPreview[] = [];
    for (let c = 2; c <= 11; c++) {
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
      fila.push({
        celda: cell.address,
        texto,
        colspan,
        rowspan,
        marca: texto.trim() === "X",
        negrita: Boolean(cell.font?.bold),
        relleno: texto.trim() !== "" && texto.trim() !== (original.get(`${r}:${c}`) ?? ""),
      });
    }
    filas.push(fila);
  }
  return { titulo: "Solicitud de Certificación de Crédito Presupuestario", filas };
}
