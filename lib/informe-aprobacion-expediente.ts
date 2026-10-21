// Informe de solicitud de aprobación del expediente de contratación (paso A8).
//
// Reproduce el modelo "INFORME APROBACION DE EXPEDIENTE.docx" que usa la
// entidad: misma cabecera (AL / C/C / DE / Asunto / Referencia / Fecha), mismos
// párrafos de sustento y la misma tabla de siete filas al final.
//
// ── El cuerpo legal va LITERAL ────────────────────────────────────────────────
//
// Los párrafos que citan los Arts. 51 de la Ley y 54 y 63 del Reglamento están
// copiados palabra por palabra, verificados contra el texto publicado. Los "(…)"
// del modelo se conservan donde el redactor cortó de verdad la cita — con UNA
// excepción: el 54.3 llevaba "(…)" y es una sola frase completa, así que ese se
// quitó. Insinuaba una omisión que no existe.
//
// ── Qué cambia según el procedimiento ─────────────────────────────────────────
//
// El modelo de la entidad es de una subasta inversa y no distingue. Dos cosas sí
// dependen del tipo:
//
//   · El apoyo del cierre. El Art. 63 habla de CONVOCAR, y en los procedimientos
//     no competitivos no hay convocatoria: la fase de selección "consiste
//     únicamente en la invitación al proveedor identificado" (Art. 101.2). Ahí
//     se cita el 101.2 y se añade el bloque del Art. 102 —la aprobación del
//     procedimiento no competitivo es OTRA, por resolución, con informes técnico
//     y legal, y la firma la AGA o el TITULAR según la causal—.
//   · La fila de designación de evaluadores. En los no competitivos "no se
//     designan evaluadores" (Art. 101.2), así que pedirla sería exigir un
//     documento que la norma dice que no existe.
//
// Los contratos menores no pasan por aquí: el Título VI, Cap. I no exige aprobar
// el expediente ni hay convocatoria. Lo corta el endpoint, no este módulo.
//
// ── De dónde sale cada dato ───────────────────────────────────────────────────
//
//   INFORME N°              → numeración de Configuración (no consume correlativo)
//   AL                      → autoridad que aprueba el expediente (Art. 54.2: la AGA)
//   C/C                     → jefatura de la Oficina General de Administración
//   DE                      → quien instruye el expediente (jefe de la DEC)
//   REFERENCIA              → A4: procedimiento + nomenclatura
//   Fecha                   → ciudad de la entidad + fecha de emisión
//   OBJETO DE LA CONVOCATORIA → ficha de la necesidad (nombre y CUI)
//   AREA USUARIA            → ficha de la necesidad
//   VALOR DE LA CUANTIA     → A5 (Art. 47.1); si aún no hay, el monto de la ficha
//   CERTIFICACION CREDITO   → A7 (monto de la CCP)
//   TIPO DEL PROCEDIMIENTO  → A4
//   N° DE PAC               → A1 (referencia/ítem del PAC)
//   MODALIDAD DE PAGO       → A4
//
// Lo que no está registrado sale con guion, no en blanco: en un documento que se
// lleva a firmar, un hueco visible dice "falta esto" y un blanco pasa inadvertido.

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FUENTE = "Arial";
const CUERPO = 21; // 10.5 pt, el del modelo
// Márgenes en twips (1 cm = 567). Superior e inferior 2,5 cm; izquierdo y
// derecho 3 cm, como pide el formato de la entidad.
const MARGENES = { top: 1418, right: 1701, bottom: 1418, left: 1701 };
const VACIO = "—";
/** Interlineado 1.15 (240 = sencillo; 276 = 1.15). */
const INTERLINEADO = 276;
/** Posición del tabulador que alinea los dos puntos de la cabecera (~2.5 cm). */
const TAB_CABECERA = 1418;

export type FirmanteInforme = {
  /** Grado + nombre, ya compuesto ("CPC. SAUL QUISPE CHIPANA"). */
  nombre: string;
  /** Cargo, en la línea de debajo. */
  cargo: string;
};

export type DatosInformeAprobacion = {
  numeroInforme: string;
  destinatario: FirmanteInforme;
  copia: FirmanteInforme | null;
  emisor: FirmanteInforme;
  referencia: string;
  lugar: string;
  fecha: string;
  objeto: string;
  areaUsuaria: string;
  valorCuantia: string;
  certificacionCredito: string;
  tipoProcedimiento: string;
  numeroPac: string;
  modalidadPago: string;

  // ── Lo que el Art. 54.2 enumera y el modelo de la entidad no acreditaba ──
  //
  // El informe listaba los siete literales en el cuerpo y luego la tabla solo
  // probaba cuatro. Quien firma leía "el expediente contiene estas siete cosas"
  // y veía menos de la mitad.

  /** Literal a): "indicando si se encuentra estandarizado". */
  requerimientoEstandarizado: string;
  /** Literal b): documento que aprueba la compatibilización, cuando corresponda. */
  compatibilizacion: string;
  /** Literal e): documento que designó a los evaluadores. */
  designacionEvaluadores: string;
  /** Art. 54.3: la necesidad debe estar prevista en el CMN. NO es el PAC. */
  cmn: string;

  /**
   * Familia del procedimiento. Cambia el cierre del informe: en los no
   * competitivos no hay convocatoria, así que el Art. 63 no sirve de apoyo.
   */
  esNoCompetitivo: boolean;
  /** Solo en no competitivos: causal, quién aprueba y con qué artículo. */
  noCompetitivo: {
    causal: string;
    aprobador: string;
    articuloAprobador: string;
  } | null;
  /** El expediente viene de un procedimiento declarado desierto (Art. 54.4). */
  vieneDeDesierto: boolean;
  /**
   * Aprobación por facultad delegada (Art. 25.2 Ley): la resolución con la que el
   * titular o la AGA delegó la facultad. `null` cuando la aprobación no es delegada.
   */
  delegacion: { resolucion: string; fecha: string } | null;
  /** Nombre completo del usuario en sesión que generó el informe. */
  elaboradoPor?: string | null;
};

import { contenidoInformeAprobacion, type Bloque, type Fragmento } from "./informe-aprobacion-contenido";

function runs(fragmentos: Fragmento[]): TextRun[] {
  return fragmentos.map(
    (f) =>
      new TextRun({ bold: f.negrita, font: FUENTE, italics: f.cursiva, size: CUERPO, text: f.texto }),
  );
}

function celda(texto: string, opciones: { negrita?: boolean; ancho: number }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: runs([{ negrita: opciones.negrita, texto }]),
        spacing: { after: 0, line: INTERLINEADO },
      }),
    ],
    width: { size: opciones.ancho, type: WidthType.PERCENTAGE },
  });
}

/**
 * Un bloque → sus párrafos de Word.
 *
 * La cabecera se compone con una TABULACIÓN a posición fija en vez de espacios:
 * con espacios, los dos puntos de "AL", "ATENCIÓN" y "DE" no quedaban alineados
 * —Arial no es monoespaciada— y la cabecera salía escalonada.
 */
function bloqueAParrafos(b: Bloque): (Paragraph | Table)[] {
  switch (b.tipo) {
    case "titulo":
      // El número del informe encabeza a la IZQUIERDA, en negrita y SUBRAYADO,
      // como en el membrete de la entidad (no centrado). `runs()` no lleva
      // subrayado, así que el TextRun se arma aquí.
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ bold: true, font: FUENTE, size: CUERPO, text: b.texto, underline: {} })],
          spacing: { after: 280, line: INTERLINEADO },
        }),
      ];
    case "subtitulo":
      return [
        new Paragraph({
          children: runs([{ negrita: true, texto: b.texto }]),
          spacing: { after: 120, line: INTERLINEADO },
        }),
      ];
    case "cabecera":
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            ...runs([{ negrita: true, texto: b.etiqueta }]),
            new TextRun({ children: [new Tab()], font: FUENTE, size: CUERPO }),
            ...runs([{ negrita: true, texto: `: ${b.nombre || VACIO}` }]),
            ...(b.cargo
              ? [
                  new TextRun({ break: 1, font: FUENTE, size: CUERPO, text: "" }),
                  new TextRun({ children: [new Tab()], font: FUENTE, size: CUERPO }),
                  new TextRun({ font: FUENTE, size: CUERPO, text: `  ${b.cargo}` }),
                ]
              : []),
          ],
          spacing: { after: 100, line: INTERLINEADO },
          tabStops: [{ position: TAB_CABECERA, type: TabStopType.LEFT }],
        }),
      ];
    case "parrafo":
      return [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: runs(b.fragmentos),
          spacing: { after: 120, line: INTERLINEADO },
        }),
      ];
    case "vinetas":
      return b.items.map(
        (t) =>
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            bullet: { level: 0 },
            // Los literales del Art. 54.2 son cita: van en cursiva como el resto.
            children: runs([{ cursiva: true, texto: t }]),
            spacing: { after: 60, line: INTERLINEADO },
          }),
      );
    case "tabla":
      return [
        new Table({
          rows: b.filas.map(
            (f) =>
              new TableRow({
                children: [
                  celda(f.etiqueta, { ancho: 38, negrita: true }),
                  celda(f.valor, { ancho: 62 }),
                ],
              }),
          ),
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ];
    case "linea":
      // Regla horizontal: un párrafo vacío con borde inferior. Ocupa todo el
      // ancho del área de escritura (de margen a margen), que es el "borde a
      // borde" del texto.
      return [
        new Paragraph({
          border: { bottom: { color: "000000", size: 8, space: 1, style: BorderStyle.SINGLE } },
          children: [],
          spacing: { after: 120, line: INTERLINEADO },
        }),
      ];
    case "espacio":
      return [new Paragraph({ children: [], spacing: { after: 60, line: INTERLINEADO } })];
    // Se desvía al `Footer` de la sección (ver `construirInformeAprobacion`),
    // así que aquí no produce nada en el cuerpo.
    case "pie":
      return [];
  }
}

export async function construirInformeAprobacion(d: DatosInformeAprobacion): Promise<Buffer> {
  const bloques = contenidoInformeAprobacion(d);
  // El pie de página ("Elaborado por") viaja como bloque aparte —no un
  // párrafo del cuerpo— para que la vista previa (que lee estos mismos
  // bloques) y el .docx real coincidan sin una segunda composición.
  const piePagina = bloques.filter((b): b is Extract<Bloque, { tipo: "pie" }> => b.tipo === "pie");
  const hijos = bloques.flatMap(bloqueAParrafos);

  const doc = new Document({
    sections: [
      {
        children: hijos,
        footers:
          piePagina.length > 0
            ? {
                default: new Footer({
                  children: piePagina.map(
                    (b) =>
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: b.fragmentos.map(
                          (f) => new TextRun({ bold: f.negrita, font: FUENTE, italics: f.cursiva, size: 16, text: f.texto }),
                        ),
                      }),
                  ),
                }),
              }
            : undefined,
        properties: { page: { margin: MARGENES } },
      },
    ],
    styles: {
      default: {
        document: {
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120, line: INTERLINEADO },
          },
          run: { font: FUENTE, size: CUERPO },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}
