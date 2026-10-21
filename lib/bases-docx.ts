// Bases del procedimiento de selección (A9) en Word: Sección General (fija,
// transcrita en lib/bases-plantillas.ts) + Sección Específica (resuelta desde
// los hitos A1-A9 por lib/bases-elaboracion.ts).
//
// Portada, página A4 con márgenes, encabezados con estilo real de Word
// (CAPÍTULO → Heading1, numerales → Heading2, visibles en el panel de
// navegación) y pie de página con numeración. Los márgenes son un estándar
// razonable de documento gubernamental (3cm vertical, 2.5cm horizontal), NO
// medidos al milímetro contra el PDF oficial; tampoco se reproduce el
// logo/escudo del OECE ni su leyenda de simbología — ver "Fuera de alcance"
// en docs/superpowers/specs/2026-09-02-bases-docx-formato-oficial-design.md.
//
// Un campo con `resuelto: false` se imprime como "[...]", igual que la propia
// plantilla oficial deja sus campos sin completar — nunca se inventa un valor.

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { FilaFactorEvaluacion, ValorBases } from "./bases-elaboracion";

const FUENTE = "Arial";
const TAM = 20; // 10 pt.
const TAM_PORTADA = 32; // 16 pt., para el título de portada.

// Márgenes de un documento gubernamental estándar (no medidos al milímetro
// contra el PDF oficial). 1 cm ≈ 567 twips.
const MARGEN_VERTICAL = 1701; // 3 cm
const MARGEN_HORIZONTAL = 1417; // 2.5 cm
const PAGINA_A4 = { height: 16838, width: 11906 }; // twips

const TITULO_CAPITULO: Record<string, string> = {
  cap1: "CAPÍTULO I: GENERALIDADES",
  cap2: "CAPÍTULO II: DEL PROCEDIMIENTO DE SELECCIÓN",
  cap3: "CAPÍTULO III: REQUERIMIENTO",
  cap4: "CAPÍTULO IV: EVALUACIÓN",
  cap5: "CAPÍTULO V: PROFORMA DEL CONTRATO",
};

function parrafo(
  texto: string,
  opts?: { negrita?: boolean; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts?.alineacion ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ bold: opts?.negrita, font: FUENTE, size: TAM, text: texto })],
    spacing: { after: 200 },
  });
}

// 1 = CAPÍTULO (Heading1); 2 = numeral en mayúsculas tipo "2.2 CONSIDERACIONES
// PARA TODOS LOS PROVEEDORES:" (Heading2); null = párrafo de contenido
// normal. Distingue DOS niveles para que el panel de navegación de Word
// refleje la jerarquía real del documento, no solo "negrita a ciegas".
export function nivelEncabezado(linea: string): 1 | 2 | null {
  if (/^CAPÍTULO\s/.test(linea)) return 1;
  const sinNumeral = linea.replace(/^\d+(\.\d+)*\.?\s*/, "");
  if (sinNumeral === linea) return null; // no empezaba con numeral
  if (sinNumeral.length > 0 && sinNumeral.length < 90 && sinNumeral === sinNumeral.toUpperCase()) return 2;
  return null;
}

function parrafoConNivel(linea: string): Paragraph {
  const nivel = nivelEncabezado(linea);
  if (nivel === 1) {
    return new Paragraph({
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: linea })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200, before: 200 },
    });
  }
  if (nivel === 2) {
    return new Paragraph({
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: linea })],
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 150, before: 150 },
    });
  }
  return parrafo(linea);
}

function parrafosSeccionGeneral(seccionGeneral: string): Paragraph[] {
  return seccionGeneral
    .split("\n")
    .filter((linea) => linea.trim() !== "")
    .map((linea) => parrafoConNivel(linea.trim()));
}

// Tabla de 2 columnas (Factor | Sustento) para un campo con `filas` reales
// (hoy, solo Factores de evaluación — ver lib/bases-elaboracion.ts).
export function filasATabla(filas: FilaFactorEvaluacion[]): Table {
  const encabezado = new TableRow({
    children: ["Factor", "Sustento / metodología"].map(
      (texto) =>
        new TableCell({
          children: [parrafo(texto, { negrita: true })],
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
    ),
  });
  const filasTabla = filas.map(
    (f) =>
      new TableRow({
        children: [f.factor, f.sustento].map(
          (texto) => new TableCell({ children: [parrafo(texto)], width: { size: 50, type: WidthType.PERCENTAGE } }),
        ),
      }),
  );
  return new Table({ rows: [encabezado, ...filasTabla], width: { size: 100, type: WidthType.PERCENTAGE } });
}

// Un campo de la Sección Específica: si trae `filas` (dato tabular real), se
// pinta como tabla. Si no, como párrafos: la etiqueta en negrita seguida del
// valor, partiendo el valor en varios párrafos cuando trae saltos de línea
// reales (confirmado en otras_penalidades/var_f_requisitos_calificacion, que
// sí los traen) — antes se aplastaba todo en un solo párrafo largo.
export function parrafosDeCampo(campo: ValorBases): (Paragraph | Table)[] {
  if (campo.filas && campo.filas.length > 0) {
    return [parrafo(campo.label, { negrita: true }), filasATabla(campo.filas)];
  }
  const valor = campo.resuelto ? campo.valor : "[...]";
  const lineas = valor.split("\n");
  if (lineas.length > 1) {
    return [parrafo(`${campo.label}:`, { negrita: true }), ...lineas.map((l) => parrafo(l))];
  }
  return [parrafo(`${campo.label}: ${lineas[0]}`)];
}

function parrafosSeccionEspecifica(valores: ValorBases[]): (Paragraph | Table)[] {
  const capitulos = new Map<string, ValorBases[]>();
  for (const v of valores) {
    const prefijo = v.ruta.split(".")[0];
    const grupo = capitulos.get(prefijo) ?? [];
    grupo.push(v);
    capitulos.set(prefijo, grupo);
  }

  const salida: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: "SECCIÓN ESPECÍFICA" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  ];
  for (const [prefijo, campos] of capitulos) {
    salida.push(
      new Paragraph({
        children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: TITULO_CAPITULO[prefijo] ?? prefijo.toUpperCase() })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 150, before: 150 },
      }),
    );
    for (const campo of campos) salida.push(...parrafosDeCampo(campo));
  }
  return salida;
}

// Portada: título del procedimiento + nomenclatura y objeto (ambos entre
// corchetes, igual que el PDF oficial: ACE no tiene esos datos en A1-A9
// todavía). Termina con un salto de página — la Sección General arranca en
// su propia página, como en el documento oficial.
function paginaPortada(proceso: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM_PORTADA, text: proceso.toUpperCase() })],
      spacing: { after: 400, before: 2000 },
    }),
    parrafo("N° [NOMENCLATURA DEL PROCEDIMIENTO DE SELECCIÓN]", { alineacion: AlignmentType.CENTER }),
    parrafo("CONTRATACIÓN DE [CONSIGNAR SEGÚN EL OBJETO]", { alineacion: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function piePagina(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: FUENTE, size: TAM }),
        ],
      }),
    ],
  });
}

export async function generarBasesDocx(
  proceso: string,
  valores: ValorBases[],
  seccionGeneral: string,
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          ...paginaPortada(proceso),
          parrafo("SECCIÓN GENERAL", { alineacion: AlignmentType.CENTER, negrita: true }),
          ...parrafosSeccionGeneral(seccionGeneral),
          ...parrafosSeccionEspecifica(valores),
        ],
        footers: { default: piePagina() },
        properties: {
          page: {
            margin: { bottom: MARGEN_VERTICAL, left: MARGEN_HORIZONTAL, right: MARGEN_HORIZONTAL, top: MARGEN_VERTICAL },
            size: PAGINA_A4,
          },
        },
      },
    ],
  });
  return Packer.toBuffer(doc);
}
