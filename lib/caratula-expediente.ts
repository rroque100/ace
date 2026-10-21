// Carátula del expediente de contratación: una página con lo decidido.
//
// ── Para qué ──────────────────────────────────────────────────────────────────
//
// El panel "Resumen del expediente" junta en una vista decisiones repartidas en
// cinco pasos (A3, A4, A5, A7, A8). Eso sirve en pantalla, pero su uso más
// valioso —entregarle el expediente a la AGA para que lo apruebe, o enseñárselo
// a quien audita— pide papel. Sin esto, quien recibe el expediente tiene que
// abrir la aplicación y recorrer cinco acordeones.
//
// ── Qué NO es ─────────────────────────────────────────────────────────────────
//
// No es el "expediente de contratación consolidado" del Art. 54: eso es el
// legajo completo con todos sus documentos. Esto es su portada. Por eso se
// archiva como "otros" y no reclama ningún requisito del ciclo: dar por foliada
// una etapa con una portada sería mentir sobre el expediente.

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ResumenExpediente } from "./expediente-columnas";

// Arial 10.5 justificado con márgenes normales: el mismo estilo que el resto
// de documentos que emite la entidad.
const FUENTE = "Arial";
const CUERPO = 21;
const MARGENES = { top: 1418, right: 1701, bottom: 1418, left: 1701 };

export type DatosCaratula = {
  nomenclatura: string;
  entidad: string | null;
  objeto: string;
  estado: string;
  codigoNecesidad: string | null;
  areaUsuaria: string | null;
  metaPresupuestal: string | null;
  valorEstimado: number | null;
  moneda: string | null;
  procedimiento: string | null;
  resumen: ResumenExpediente;
  /** Fecha de emisión ya formateada: la construye quien llama, no este módulo. */
  fechaEmision: string;
  /** Nombre completo del usuario en sesión que generó la carátula. */
  elaboradoPor?: string | null;
};

function celda(texto: string, opciones?: { negrita?: boolean; ancho?: number }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ bold: opciones?.negrita, font: FUENTE, size: CUERPO, text: texto }),
        ],
        spacing: { after: 0 },
      }),
    ],
    width: opciones?.ancho ? { size: opciones.ancho, type: WidthType.PERCENTAGE } : undefined,
  });
}

/**
 * Fila de la tabla. El guion largo marca lo que aún no se ha decidido.
 *
 * Se imprime la fila aunque esté vacía a propósito: en una carátula que se
 * entrega, un hueco visible dice "esto falta", mientras que omitir la fila
 * escondería la carencia y el documento parecería completo.
 */
function fila(etiqueta: string, valor: string | null | undefined, paso?: string): TableRow {
  const texto = (valor ?? "").trim();
  return new TableRow({
    children: [
      celda(paso ? `${etiqueta} (${paso})` : etiqueta, { ancho: 34, negrita: true }),
      celda(texto || "—", { ancho: 66 }),
    ],
  });
}

function parrafo(texto: string, opciones?: { negrita?: boolean; cursiva?: boolean }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        bold: opciones?.negrita,
        font: FUENTE,
        italics: opciones?.cursiva,
        size: CUERPO,
        text: texto,
      }),
    ],
  });
}

export async function construirCaratula(datos: DatosCaratula): Promise<Buffer> {
  const { resumen: r } = datos;
  const importe =
    datos.valorEstimado != null && datos.valorEstimado > 0
      ? `${datos.moneda === "USD" ? "US$" : "S/"} ${datos.valorEstimado.toLocaleString("es-PE", {
          minimumFractionDigits: 2,
        })}`
      : null;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ bold: true, font: FUENTE, size: 28, text: "CARÁTULA DEL EXPEDIENTE DE CONTRATACIÓN" }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                font: FUENTE,
                italics: true,
                size: 18,
                text: "Ley N° 32069, Ley General de Contrataciones Públicas, y su Reglamento",
              }),
            ],
            spacing: { after: 320 },
          }),

          parrafo("I. IDENTIFICACIÓN", { negrita: true }),
          new Table({
            rows: [
              fila("Denominación", datos.nomenclatura),
              fila("Entidad contratante", datos.entidad),
              fila("Objeto de la contratación", datos.objeto),
              fila("Área usuaria", datos.areaUsuaria),
              fila("Meta presupuestal", datos.metaPresupuestal),
              fila("Necesidad de origen", datos.codigoNecesidad),
              fila("Etapa actual del ciclo", datos.estado),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          new Paragraph({ spacing: { after: 240 }, text: "" }),
          parrafo("II. DECISIONES DEL EXPEDIENTE", { negrita: true }),
          // La referencia al paso viaja al papel: quien reciba la carátula y vea
          // un hueco sabe en qué actuación se resuelve, sin preguntar.
          new Table({
            rows: [
              fila("Cuantía de la contratación", importe, "A5"),
              fila("Moneda", datos.moneda, "Ficha"),
              fila("Certificación presupuestal", r.certificacionPresupuestal, "A7"),
              fila("Tipo de procedimiento", datos.procedimiento, "A4"),
              fila("Sistema de entrega", r.sistemaEntrega, "A4"),
              fila("Modalidad de pago", r.modalidadPago, "A4"),
              fila("Fórmula de reajuste", r.formulaReajuste, "A3"),
              fila("Interacción con el mercado", r.interaccionMercado, "A4"),
              fila("Tipo de evaluador", r.tipoEvaluador, "A4"),
              fila("Garantías y adelantos", r.garantiasAdelantos, "A4"),
              fila("Requisitos de calificación", r.requisitosCalificacion, "A4"),
              fila("Aprobación del expediente", r.aprobacion, "A8"),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          new Paragraph({ spacing: { after: 300 }, text: "" }),
          parrafo(
            "Esta carátula resume las decisiones registradas en el expediente. No sustituye a los " +
              "documentos que lo integran conforme al artículo 54 del Reglamento: se incorpora como " +
              "portada del legajo. Los campos con guion corresponden a actuaciones aún no registradas.",
            { cursiva: true },
          ),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ font: FUENTE, italics: true, size: 18, text: `Emitida el ${datos.fechaEmision}` }),
            ],
            spacing: { before: 240 },
          }),
        ],
        // "Elaborado por" es la trazabilidad de quién generó el documento en el
        // sistema, no una firma: va en el pie de página, no en el cuerpo.
        footers: datos.elaboradoPor
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ font: FUENTE, size: 16, text: `Elaborado por: ${datos.elaboradoPor}` })],
                  }),
                ],
              }),
            }
          : undefined,
        properties: { page: { margin: MARGENES } },
      },
    ],
    styles: {
      default: {
        document: {
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 } },
          run: { font: FUENTE, size: CUERPO },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}
