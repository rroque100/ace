// Los tres documentos de la designación de evaluadores (A6), en Word.
//
// Reproducen los formatos oficiales de la entidad:
//   1. Memorándum de designación del evaluador (Arts. 56 y 58 del Reglamento).
//   2. Anexo N° 1 · Declaración jurada de no tener conflicto de interés
//      (Art. 56.7 del Reglamento).
//   3. Anexo N° 3 · Consentimiento para el tratamiento de datos personales
//      (Ley N° 29733 y su Reglamento D.S. 016-2024-JUS).
//
// La jurada y el consentimiento se firman UNO POR CADA integrante, así que su
// documento lleva una página por evaluador. El memorándum es único y los
// designa a todos.

import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";

const FUENTE = "Arial";
const TAM = 20; // 10 pt, como los formatos de la entidad.

export type IntegranteDoc = {
  nombre: string;
  dni: string;
  /** Grado que antecede al nombre en el "A:" del memorándum (p. ej. "ABG."). */
  grado?: string;
  /** Cargo/unidad, que va DEBAJO del nombre en el "A:" (p. ej. "UNIDAD DE ADQUISICIÓN"). */
  cargo?: string;
  /** Rol en el panel (Art. 56.1): comprador público, experto/profesional… */
  rol?: string;
  /** Titular o suplente (Arts. 59.1, 60.1); vacío = titular. */
  condicion?: "titular" | "suplente";
};

export type EvaluadoresDocInput = {
  entidad: string;
  /** Ciudad de la fecha (Configuración → Municipalidad). */
  lugar: string;
  /** Fecha del documento de designación (A6). */
  fecha: string; // ISO
  /** Etiqueta del tipo de evaluador: "Oficial de compra", "Comité"… */
  tipoEvaluadorLabel: string;
  /** Clave del tipo, para el cuerpo del memorándum (oficial_compra / comite / jurado). */
  tipoEvaluador: string;
  /** Procedimiento de selección (de A4): etiqueta + nomenclatura. */
  procedimientoLabel: string;
  nomenclatura: string;
  /** Los evaluadores designados. */
  integrantes: IntegranteDoc[];
  /** Nº del memorándum de designación (A6). */
  memoNumero: string;
  /**
   * Quien EMITE el memorándum (línea "DE:"): el jefe de logística / de la
   * Dependencia Encargada de las Contrataciones, con su grado y nombre completo.
   * Se toma de Configuración › Usuarios (el usuario con rol de la DEC).
   */
  emisor: { grado?: string; nombre: string };
  /** Nombre completo del usuario en sesión que generó el documento. */
  elaboradoPor?: string | null;
};

/**
 * Normaliza el número del memorándum quitando un "MEMORANDUM N°/Nro" que el
 * usuario haya escrito por su cuenta: la cabecera ya lo antepone, así que sin
 * esto salía duplicado ("MEMORANDUM N° MEMORANDUM NRO 52-…"). Tolera la errata
 * "MEMORADUN" y variantes de "N°/Nro". Si no hay prefijo, se deja igual.
 */
export function numeroMemo(raw: string): string {
  // 1) el nombre del documento ("MEMORANDUM"/"MEMORADUN"… o "INFORME", según el
  // tipo de evaluador) 2) opcionalmente su marcador de número ("NRO", "N°", "Nº",
  // "N."). "nro" va ANTES que "n" para que no se quede una "RO" suelta.
  return (raw ?? "")
    .replace(/^\s*(?:memor[a-záéíóúñüÁÉÍÓÚÑÜ]*|informe)\.?\s*(?:nro\.?|n[°ºo]?\.?)?\s*/i, "")
    .trim();
}

/**
 * `elaboradoPor` es la trazabilidad de quién generó el documento en el
 * sistema, no una firma: va en el pie de página —se repite en cada una, a
 * diferencia de un párrafo en el cuerpo— y no en el cuerpo que se imprime y
 * se firma.
 */
function base(children: Paragraph[], elaboradoPor?: string | null): Document {
  return new Document({
    styles: {
      default: {
        document: { run: { font: FUENTE, size: TAM } },
      },
    },
    sections: [
      {
        footers: elaboradoPor
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ font: FUENTE, size: 16, text: `Elaborado por: ${elaboradoPor}` })],
                  }),
                ],
              }),
            }
          : undefined,
        // Márgenes normales: 2.5 cm superior/inferior, 3 cm izquierda/derecha.
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1701, right: 1701 } } },
        children,
      },
    ],
  });
}

function run(text: string, opts?: { bold?: boolean; underline?: boolean }): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold,
    underline: opts?.underline ? { type: UnderlineType.SINGLE } : undefined,
    font: FUENTE,
    size: TAM,
  });
}

/** Párrafo justificado con un poco de aire debajo. */
function p(children: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED): Paragraph {
  return new Paragraph({ alignment: align, spacing: { after: 160, line: 276 }, children });
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "29 del mes de abril del 2026" (como en los anexos). */
function fechaConMes(iso: string, lugar: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return lugar ? `${lugar}, ______________` : "______________";
  const [, y, mes, d] = m;
  const fecha = `${Number(d)} del mes de ${MESES[Number(mes) - 1] ?? ""} del ${y}`;
  return lugar ? `${lugar}, ${fecha}` : fecha;
}

/** "29 de abril del 2026" (como en el memorándum). */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "______________";
  const [, y, mes, d] = m;
  return `${Number(d)} de ${MESES[Number(mes) - 1] ?? ""} del ${y}`;
}

function identidad(i: IntegranteDoc): string {
  const grado = (i.grado ?? "").trim();
  const nombre = (i.nombre ?? "").trim() || "____________________";
  return grado ? `${grado} ${nombre}` : nombre;
}

// ===== 1. Memorándum de designación =====

/** Cuerpo legal del memorándum según el tipo de evaluador (Arts. 56 y 58). */
function cuerpoMemo(input: EvaluadoresDocInput): string {
  const ref = `${input.procedimientoLabel} N° ${input.nomenclatura || "____"}`;
  if (input.tipoEvaluador === "oficial_compra") {
    return (
      `Por medio del presente, se dispone que deberá ser el evaluador a cargo del procedimiento de selección ${ref}, ` +
      `como Oficial de Compra de acuerdo a lo establecido en el artículo 56 del Reglamento de la Ley N° 32069, numeral 56.2: ` +
      `"El oficial de compra o el comité, según corresponda, es responsable de la conducción y realización de la fase de selección, ` +
      `incluyendo la preparación de las bases"; y el artículo 58: "58.1. El oficial de compra es el funcionario o servidor designado ` +
      `por la DEC, responsable de la fase de selección. 58.2. Un oficial de compra puede ser designado en más de un procedimiento de ` +
      `selección simultáneamente".`
    );
  }
  if (input.tipoEvaluador === "comite") {
    return (
      `Por medio del presente, se designa al Comité de Selección a cargo del procedimiento de selección ${ref}, ` +
      `de acuerdo a lo establecido en el artículo 56 del Reglamento de la Ley N° 32069, numeral 56.2, siendo responsable de la conducción ` +
      `y realización de la fase de selección, incluyendo la preparación de las bases, mediante decisión colegiada de sus integrantes.`
    );
  }
  return (
    `Por medio del presente, se designa al Jurado a cargo del procedimiento de selección ${ref}, ` +
    `de acuerdo a lo establecido en el artículo 56 del Reglamento de la Ley N° 32069. El jurado es responsable de la evaluación de las ofertas, ` +
    `en tanto que la DEC, representada por quien tiene a cargo dicha dependencia, del resto de actuaciones y actos correspondientes al procedimiento de selección.`
  );
}

export async function buildMemoDesignacionDocx(input: EvaluadoresDocInput): Promise<Buffer> {
  const tab = (etiqueta: string, valor: TextRun[]): Paragraph =>
    p([run(etiqueta, { bold: true }), ...valor], AlignmentType.LEFT);

  const asunto = `DESIGNACIÓN COMO ${input.tipoEvaluadorLabel.toUpperCase()}`;
  // Quien emite el memorándum (línea "DE:"): el jefe de logística de la DEC.
  const emisor = `${input.emisor.grado ? `${input.emisor.grado} ` : ""}${input.emisor.nombre || "____________________"}`;

  // Sangría para la 2ª línea (el cargo/unidad), alineada con el texto tras "A: ".
  const SANGRIA = "                   ";
  // "A:" con el nombre y, DEBAJO, su cargo/unidad — igual que "DE:" lleva la
  // dependencia debajo. Con varios integrantes, cada uno con su cargo.
  const destinatarioParrafos: Paragraph[] = [];
  if (input.integrantes.length === 0) {
    destinatarioParrafos.push(tab("A            : ", [run("____________________")]));
  } else {
    input.integrantes.forEach((it, idx) => {
      // El comité y el jurado se designan con titulares y suplentes (Arts. 59.1,
      // 60.1): se marca la condición junto al nombre. El oficial de compra es
      // único, así que ahí no se etiqueta.
      const marca =
        (input.tipoEvaluador === "comite" || input.tipoEvaluador === "jurado") && it.condicion
          ? ` (${it.condicion === "suplente" ? "suplente" : "titular"})`
          : "";
      destinatarioParrafos.push(
        idx === 0
          ? tab("A            : ", [run(`${identidad(it)}${marca}`)])
          : p([run(`${SANGRIA}${identidad(it)}${marca}`)], AlignmentType.LEFT),
      );
      if ((it.cargo ?? "").trim()) {
        destinatarioParrafos.push(p([run(`${SANGRIA}${it.cargo!.trim()}`)], AlignmentType.LEFT));
      }
    });
  }

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      // Oficial de compra → MEMORANDUM (lo designa la DEC); comité/jurado → INFORME.
      children: [
        run(
          `${input.tipoEvaluador === "oficial_compra" ? "MEMORANDUM" : "INFORME"} N° ${numeroMemo(input.memoNumero) || "____"}`,
          { bold: true, underline: true },
        ),
      ],
    }),
    tab("DE          : ", [run(emisor)]),
    p([run("                  DEPENDENCIA ENCARGADA DE LAS CONTRATACIONES")], AlignmentType.LEFT),
    ...destinatarioParrafos,
    tab("ASUNTO  : ", [run(asunto, { bold: true })]),
    tab("REF        : ", [run(`${input.procedimientoLabel.toUpperCase()} N° ${input.nomenclatura || "____"}`)]),
    tab("FECHA   : ", [run(`${input.lugar || "____"}, ${fechaCorta(input.fecha)}.`)]),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    p([run(cuerpoMemo(input))]),
    p([
      run(
        `En ese sentido se le designa como ${input.tipoEvaluadorLabel.toLowerCase()}, debiendo cumplir sus funciones dentro del parámetro legal señalado.`,
      ),
    ]),
    p([run("Sin otro en particular, es todo cuanto dispongo a Usted, para su cumplimiento bajo responsabilidad.")]),
    p([run("Atentamente;")], AlignmentType.LEFT),
  ];

  return Buffer.from(await Packer.toBuffer(base(children, input.elaboradoPor)));
}

// ===== 2. Anexo N° 1 · Declaración jurada de no conflicto de interés =====

const DEFINICION_CONFLICTO =
  "Definición contenida en el artículo 4.4 del Decreto Supremo N° 082-2023-PCM, Reglamento de la Ley N° 31564, Ley de prevención y " +
  "mitigación del conflicto de intereses en el acceso y salida de personal del servicio público. En el sector público, surge cuando un " +
  "funcionario o servidor de la institución es influenciado por consideraciones personales (e incluso institucionales) al realizar su trabajo. " +
  "Es la declaración que se realiza sobre los ámbitos: personal, familiar, laboral, económico y/o financiero, a fin de evitar o gestionar " +
  "oportunamente posibles conflictos de intereses, resguardando la transparencia, independencia y objetividad en el ejercicio de sus actividades o funciones.";

function paginaJurada(input: EvaluadoresDocInput, i: IntegranteDoc, esUltima: boolean): Paragraph[] {
  const nombre = (i.nombre ?? "").trim() || "____________________";
  const dni = (i.dni ?? "").trim() || "____________";
  const out: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run("ANEXO N° 1", { bold: true })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run("DECLARACIÓN JURADA DE NO TENER CONFLICTO DE INTERES", { bold: true })],
    }),
    p([
      run(`Yo, ${nombre} identificado con DNI N° ${dni}, declaro bajo juramento y en honor a la verdad que no me encuentro en una situación de conflicto de intereses de índole económica, política, familiar, sentimental o de otra naturaleza que puedan afectar durante el procedimiento selectivo que se está llevando desde los actos preparatorios hasta el consentimiento de la buena pro por la entidad contratante.`),
    ]),
    p([run("En caso de tener situación de conflicto de interés marcar con un aspa:")]),
    p([run("SÍ (  )        NO (X)")], AlignmentType.LEFT),
    p([
      run(
        "De conformidad y en cumplimiento del Reglamento de la Ley General de Contrataciones Públicas según su artículo 56, numeral 56.7: los evaluadores están obligados a presentar previo a su designación una declaración jurada de no mantener conflicto de intereses en el proceso de contratación; así mismo su numeral 56.8, de corresponder.",
      ),
    ]),
    p([run("(*) Conflicto de intereses:", { bold: true })], AlignmentType.LEFT),
    p([run(DEFINICION_CONFLICTO)]),
    p([run("Como constancia de lo expresado en la presente declaración firmo a continuación.")]),
    // Lugar y fecha alineados a la derecha, como en los formatos oficiales.
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
      children: [run(`${input.lugar || "____"}, ${fechaConMes(input.fecha, "")}`)],
    }),
    // Espacio para la firma manuscrita: ~4 líneas en blanco tras la fecha antes
    // de la línea de firma, para que quepa el sello y la rúbrica.
    ...Array.from({ length: 4 }, () => new Paragraph({ spacing: { after: 0 }, children: [run("")] })),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run("_______________________________")] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(nombre, { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`DNI: ${dni}`)] }),
  ];
  if (!esUltima) out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

export async function buildDeclaracionJuradaDocx(input: EvaluadoresDocInput): Promise<Buffer> {
  const integrantes = input.integrantes.length ? input.integrantes : [{ nombre: "", dni: "" }];
  const children = integrantes.flatMap((i, idx) => paginaJurada(input, i, idx === integrantes.length - 1));
  return Buffer.from(await Packer.toBuffer(base(children, input.elaboradoPor)));
}

// ===== 3. Anexo N° 3 · Consentimiento para el tratamiento de datos personales =====

const CONSENTIMIENTO_INTRO =
  "Con la finalidad de dar cumplimiento a la Ley N° 29733, Ley de Protección de Datos Personales y su Reglamento, aprobado por Decreto " +
  "Supremo N° 016-2024-JUS, relativo a la protección de la información de las personas en lo que respecta al tratamiento de datos personales " +
  "y su consentimiento, siguiendo las recomendaciones e instrucciones emitidas por la Autoridad Nacional de Datos Personales.";

const CONSENTIMIENTO_INFORMA = [
  "Los datos de carácter personal solicitados y facilitados por usted, son incorporados en los bancos de datos personales pertenecientes al Organismo Especializado para las Contrataciones Públicas Eficientes (en adelante OECE) como único destinatario.",
  "Solo son solicitados aquellos datos estrictamente necesarios para prestar adecuadamente los servicios solicitados al OECE o en el cumplimiento de las funciones de la entidad contratante establecidas en el artículo 11 de la Ley N° 32069, Ley General de Contrataciones Públicas.",
  "Todos los datos recogidos cuentan con el compromiso de confidencialidad, con las medidas de seguridad establecidas legalmente, y bajo ningún concepto son cedidos o tratados por terceras personas, físicas o jurídicas, sin el previo consentimiento del ciudadano, tutor o representante legal, salvo en aquellos casos en los que su uso sea imprescindible para el cumplimiento de las funciones de la entidad y en obligación legal de ser comunicado.",
  "Los nombres y apellidos de los usuarios activos de las entidades contratantes son publicados en la Plataforma Única del Estado Peruano GOB.PE/OECE, con la finalidad de informar a los mismos.",
  "Una vez finalizada la actualización en el SEACE de los datos del ciudadano, éstos son archivados y conservados con la confidencialidad y seguridad de la información definida por la normatividad de la materia.",
];

function paginaConsentimiento(input: EvaluadoresDocInput, i: IntegranteDoc, esUltima: boolean): Paragraph[] {
  const nombre = (i.nombre ?? "").trim() || "____________________";
  const dni = (i.dni ?? "").trim() || "____________";
  const out: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run("ANEXO N° 3", { bold: true })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run("CONSENTIMIENTO PARA EL TRATAMIENTO DE DATOS PERSONALES", { bold: true })],
    }),
    p([run(CONSENTIMIENTO_INTRO)]),
    p([run("SE INFORMA:", { bold: true })], AlignmentType.LEFT),
    ...CONSENTIMIENTO_INFORMA.map(
      (t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 276 }, bullet: { level: 0 }, children: [run(t)] }),
    ),
    p([
      run(
        "Asimismo, señalo haber sido informado de la Política de Privacidad del OECE que incluye la posibilidad de ejercer los derechos de acceso, rectificación, cancelación y oposición (ARCO) y derecho de información, indicándolo por escrito a través de los canales formales para su presentación. Dicha política se encuentra publicada en el portal institucional del OECE.",
      ),
    ]),
    p([run("Manifiesto mi consentimiento al tratamiento de mis datos personales, ante la información comunicada.")]),
    p([run("FIRMA DE AUTORIZACIÓN:", { bold: true })], AlignmentType.LEFT),
    new Paragraph({ spacing: { after: 120 }, children: [run(`Nombre y apellidos del ciudadano: ${nombre}`)] }),
    new Paragraph({ spacing: { after: 120 }, children: [run(`DNI: ${dni}`)] }),
    // Espacio para la firma manuscrita: ~4 líneas en blanco tras el DNI, para
    // que quepan la rúbrica y el sello antes de la línea de firma.
    ...Array.from({ length: 4 }, () => new Paragraph({ spacing: { after: 0 }, children: [run("")] })),
    new Paragraph({ spacing: { after: 240 }, children: [run("FIRMA DIGITAL O MANUSCRITA: _______________________________")] }),
    // Lugar y fecha alineados a la derecha, como en los formatos oficiales.
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [run(`${input.lugar || "____"}, ${fechaConMes(input.fecha, "")}`)],
    }),
  ];
  if (!esUltima) out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

export async function buildConsentimientoDatosDocx(input: EvaluadoresDocInput): Promise<Buffer> {
  const integrantes = input.integrantes.length ? input.integrantes : [{ nombre: "", dni: "" }];
  const children = integrantes.flatMap((i, idx) => paginaConsentimiento(input, i, idx === integrantes.length - 1));
  return Buffer.from(await Packer.toBuffer(base(children, input.elaboradoPor)));
}

export type EvaluadorDocKind = "memo" | "jurada" | "consentimiento";

/** Genera el documento pedido. Un solo punto de entrada para la ruta. */
export function buildEvaluadorDoc(kind: EvaluadorDocKind, input: EvaluadoresDocInput): Promise<Buffer> {
  if (kind === "memo") return buildMemoDesignacionDocx(input);
  if (kind === "jurada") return buildDeclaracionJuradaDocx(input);
  return buildConsentimientoDatosDocx(input);
}
