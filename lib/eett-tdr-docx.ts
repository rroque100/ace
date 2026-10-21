import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";

// Convierte la propuesta de EETT/TDR (Markdown: «## título», «### subtítulo»,
// «- » viñeta, «1. » numeración, tablas `| a | b |`, placeholders «[IMAGEN: …]»,
// y formato inline **negrita** *cursiva* __subrayado__) en un documento Word
// (.docx) profesional LISTO PARA IMPRIMIR: tipografía Arial 10.5, cuerpo
// JUSTIFICADO, y tablas ajustadas al contenido y centradas.

type Bloque = Paragraph | Table;

const FUENTE = "Arial";
const TAM = 21; // 10.5 pt (docx usa medios puntos: 10.5 × 2 = 21)

/** Parsea formato inline (**negrita**, *cursiva*, __subrayado__ o <u>…</u>) a runs. */
function runsInline(s: string, base: { bold?: boolean; size?: number } = {}): TextRun[] {
  const texto = (s ?? "").replace(/<u>(.+?)<\/u>/gi, "__$1__");
  const runs: TextRun[] = [];
  const re = /\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*]+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: texto.slice(last, m.index), ...base }));
    if (m[1] != null) runs.push(new TextRun({ text: m[1], bold: true, ...base }));
    else if (m[2] != null) runs.push(new TextRun({ text: m[2], underline: { type: UnderlineType.SINGLE }, ...base }));
    else if (m[3] != null) runs.push(new TextRun({ text: m[3], italics: true, ...base }));
    last = re.lastIndex;
  }
  if (last < texto.length) runs.push(new TextRun({ text: texto.slice(last), ...base }));
  if (runs.length === 0) runs.push(new TextRun({ text: "", ...base }));
  return runs;
}

/** Solo texto (sin marcas) — para títulos. */
function limpiarInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/`(.+?)`/g, "$1");
}

const esFilaTabla = (t: string) => t.startsWith("|") && t.endsWith("|") && t.length > 2;
const esSeparadorTabla = (t: string) =>
  t
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .every((c) => /^[\s:-]*$/.test(c) && c.includes("-"));

function celdasDeFila(fila: string): string[] {
  return fila
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const BORDES_TABLA = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE, insideHorizontal: BORDE, insideVertical: BORDE };

function construirTabla(filas: string[]): Table {
  const datos = filas.filter((f) => !esSeparadorTabla(f));
  const cols = Math.max(1, ...datos.map((f) => celdasDeFila(f).length));
  const rows = datos.map((fila, idx) => {
    const celdas = celdasDeFila(fila);
    while (celdas.length < cols) celdas.push("");
    celdas.length = cols;
    return new TableRow({
      tableHeader: idx === 0,
      children: celdas.map(
        (c) =>
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: idx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: runsInline(c, { bold: idx === 0 }),
              }),
            ],
          }),
      ),
    });
  });
  // Ajustada al contenido (AUTOFIT) y centrada en la página.
  return new Table({ alignment: AlignmentType.CENTER, layout: TableLayoutType.AUTOFIT, borders: BORDES_TABLA, rows });
}

/** Cuadro (placeholder) para colocar luego la imagen real. */
function cuadroImagen(caption: string): Table {
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 80, type: WidthType.PERCENTAGE },
    borders: BORDES_TABLA,
    rows: [
      new TableRow({
        height: { value: 2600, rule: "atLeast" },
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 400 },
                children: [
                  new TextRun({ text: "🖼  Espacio para imagen", italics: true, color: "777777" }),
                  ...(caption ? [new TextRun({ text: caption, italics: true, color: "777777", break: 1 })] : []),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function lineaAParrafo(linea: string): Paragraph {
  const t = linea.replace(/\s+$/, "");
  if (!t.trim()) return new Paragraph({ text: "" });
  if (/^###\s+/.test(t)) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 60 }, text: limpiarInline(t.replace(/^###\s+/, "")) });
  }
  if (/^##\s+/.test(t)) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 }, text: limpiarInline(t.replace(/^##\s+/, "")) });
  }
  if (/^#\s+/.test(t)) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 }, text: limpiarInline(t.replace(/^#\s+/, "")) });
  }
  if (/^[-•*]\s+/.test(t)) {
    return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, alignment: AlignmentType.JUSTIFIED, children: runsInline(t.replace(/^[-•*]\s+/, "")) });
  }
  // Numeración manual (1., 3.1, A., a)…): se conserva como texto (numeral semántico).
  return new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: runsInline(t) });
}

function construirBloques(contenido: string): Bloque[] {
  const lineas = (contenido ?? "").split(/\r?\n/);
  const out: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const t = lineas[i].trim();
    const img = t.match(/^\[\s*IMAGEN\s*:?\s*(.*?)\s*\]$/i);
    if (img) {
      out.push(cuadroImagen(img[1] ?? ""));
      i += 1;
      continue;
    }
    if (esFilaTabla(t)) {
      const filas: string[] = [];
      while (i < lineas.length && esFilaTabla(lineas[i].trim())) {
        filas.push(lineas[i].trim());
        i += 1;
      }
      if (filas.filter((f) => !esSeparadorTabla(f)).length >= 1) {
        out.push(construirTabla(filas));
        continue;
      }
    }
    out.push(lineaAParrafo(lineas[i]));
    i += 1;
  }
  return out;
}

const estiloTitulo = (size: number) => ({
  run: { font: FUENTE, bold: true, size },
  paragraph: { alignment: AlignmentType.LEFT },
});

export async function buildEettTdrDocx(input: {
  contenido: string;
  titulo: string;
  tipo: "eett" | "tdr";
}): Promise<Buffer> {
  const encabezado = input.tipo === "eett" ? "ESPECIFICACIONES TÉCNICAS (EETT)" : "TÉRMINOS DE REFERENCIA (TDR)";
  const children: Bloque[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 40 }, text: encabezado }),
  ];
  if (input.titulo.trim()) {
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: input.titulo.trim(), italics: true })] }),
    );
  }
  children.push(...construirBloques(input.contenido));

  const document = new Document({
    styles: {
      // Tipografía por defecto Arial 10.5, cuerpo justificado.
      default: {
        document: { run: { font: FUENTE, size: TAM }, paragraph: { alignment: AlignmentType.JUSTIFIED } },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...estiloTitulo(26) },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...estiloTitulo(24) },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, ...estiloTitulo(22) },
      ],
    },
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(document));
}
