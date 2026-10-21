import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Header,
} from "docx";
import { PDFDocument as PDL, StandardFonts, rgb } from "pdf-lib";
import { numeroALetras } from "./numero-a-letras";
import { fechaES } from "./fecha-es";

export type ContratoCpInput = {
  numeroContrato?: string;
  proceso: {
    nomenclatura: string;
    denominacion: string;
    entidadNombre: string;
    entidadRuc: string;
    entidadDomicilio: string;
    fechaBuenaPro?: string;
    entidadRepresentante?: string;
    entidadRepresentanteDni?: string;
    entidadRepresentanteCargo?: string;
  };
  postor: {
    razonSocial: string;
    ruc: string;
    domicilio: string;
    partidaRegistral?: string;
    asiento?: string;
    ciudadRegistro?: string;
    representante: string;
    docTipo?: string;
    docNumero?: string;
    poderPartida?: string;
    poderAsiento?: string;
    poderCiudad?: string;
    correo?: string;
  };
  contrato: {
    monto: string;
    formaPago?: string;
    lugarEntrega?: string;
    plazoEntrega?: string;
    inicioPlazo?: string;
    cronograma: Array<{ paquete: string; descripcion: string; marca?: string; unidad: string; cantidad: string }>;
    preciosUnitarios?: Array<{ concepto: string; marca: string; unidad: string; cantidad: string; precioUnitario: string; precioTotal: string }>;
    preciosTotalGeneral?: string;
    viciosOcultosAnios?: string;
    institucionArbitral?: string;
    recepcionArea?: string;
    conformidadArea?: string;
    plazoConformidadDias?: string;
    ciudadFirma?: string;
    fechaFirma?: string;
  };
};

const FALTA = (campo: string) => `[POR COMPLETAR: ${campo}]`;

function texto(value: string | undefined | null, fallback: string): string {
  return value?.trim() ? value.trim() : fallback;
}

function p(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; size?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 160 },
    children: [new TextRun({ font: "Calibri", size: opts.size ?? 22, bold: opts.bold, text })],
  });
}

function clausula(titulo: string, cuerpo: string[]): Paragraph[] {
  return [
    p(titulo, { bold: true, align: AlignmentType.LEFT, after: 80 }),
    ...cuerpo.map((c) => p(c)),
  ];
}

export async function buildContratoCpDocx(input: ContratoCpInput): Promise<Buffer> {
  const { proceso, postor: po, contrato } = input;
  const anio = new Date().getFullYear();
  const numero = texto(input.numeroContrato, `CONTRATO N° ___-${anio}`);
  const entidad = texto(proceso.entidadNombre, FALTA("nombre de la entidad"));
  const contratista = texto(po.razonSocial, FALTA("razón social del contratista"));

  const children: (Paragraph | Table)[] = [];

  // Título
  children.push(
    p(numero.toUpperCase(), { bold: true, align: AlignmentType.CENTER, after: 60 }),
    p(`CONTRATO DE ${texto(proceso.denominacion, FALTA("denominación de la convocatoria")).toUpperCase()}`, {
      bold: true, align: AlignmentType.CENTER, after: 60,
    }),
    p(`COMPARACIÓN DE PRECIOS N° ${texto(proceso.nomenclatura, FALTA("nomenclatura del procedimiento")).toUpperCase()}`, {
      bold: true, align: AlignmentType.CENTER, after: 240,
    }),
  );

  // Comparecencia
  const registroPostor =
    po.partidaRegistral || po.asiento
      ? `, inscrita en la Partida Registral N° ${texto(po.partidaRegistral, "[…]")} Asiento N° ${texto(po.asiento, "[…]")} del Registro de Personas Jurídicas de la ciudad de ${texto(po.ciudadRegistro, "[…]")}`
      : "";
  const poderPostor =
    po.poderPartida || po.poderAsiento
      ? `, según poder inscrito en la Partida Registral N° ${texto(po.poderPartida, "[…]")}, Asiento N° ${texto(po.poderAsiento, "[…]")} del Registro de Personas Jurídicas de la ciudad de ${texto(po.poderCiudad ?? po.ciudadRegistro, "[…]")}`
      : "";
  const entidadRepresentante = texto(proceso.entidadRepresentante, FALTA("nombre del representante de la entidad"));
  const entidadRepresentanteCargo = texto(proceso.entidadRepresentanteCargo, "Gerente General");
  const entidadRepresentanteDni = texto(proceso.entidadRepresentanteDni, FALTA("DNI del representante de la entidad"));

  children.push(
    p(
      `Conste por el presente documento, la contratación de ${texto(proceso.denominacion, FALTA("denominación de la convocatoria"))}, que celebra de una parte ${entidad}, en adelante LA ENTIDAD CONTRATANTE, con RUC N° ${texto(proceso.entidadRuc, FALTA("RUC de la entidad"))}, con domicilio legal en ${texto(proceso.entidadDomicilio, FALTA("domicilio de la entidad"))}, representada por ${entidadRepresentanteCargo} ${entidadRepresentante}, identificado con DNI N° ${entidadRepresentanteDni}; y de otra parte ${contratista}, con RUC N° ${texto(po.ruc, FALTA("RUC del contratista"))}, con domicilio legal en ${texto(po.domicilio, FALTA("domicilio del contratista"))}${registroPostor}, debidamente representado por su Representante Legal, ${texto(po.representante, FALTA("representante legal"))}, con ${texto(po.docTipo, "DNI")} N° ${texto(po.docNumero, "[…]")}${poderPostor}, a quien en adelante se le denomina EL CONTRATISTA, en los términos y condiciones siguientes:`,
      { after: 200 },
    ),
  );

  // Cláusulas
  children.push(
    ...clausula("CLÁUSULA PRIMERA: ANTECEDENTES", [
      `Con fecha ${texto(proceso.fechaBuenaPro, FALTA("fecha de la buena pro"))}, el oficial de compra adjudicó la buena pro de la COMPARACIÓN DE PRECIOS N° ${texto(proceso.nomenclatura, FALTA("nomenclatura"))} para la contratación de ${texto(proceso.denominacion, FALTA("denominación"))}, a ${contratista}, cuyos detalles e importe constan en los documentos integrantes del presente contrato.`,
    ]),
    ...clausula("CLÁUSULA SEGUNDA: OBJETO", [
      `El presente contrato tiene por objeto ${texto(proceso.denominacion, FALTA("objeto de la contratación"))}.`,
    ]),
    ...clausula("CLÁUSULA TERCERA: MONTO CONTRACTUAL", (() => {
      const montoText = texto(contrato.monto, FALTA("moneda y monto"));
      const montoLetras = contrato.monto ? numeroALetras(contrato.monto) : "";
      return [`El monto total del presente contrato asciende a la suma de ${montoText} (${montoLetras}), que incluye todos los impuestos de Ley. Este monto comprende el costo total de ${texto(proceso.denominacion, "los bienes")}, incluyendo, de ser aplicable, todos los impuestos, seguros, transporte, inspecciones, pruebas y, de ser el caso, los costos laborales conforme a la legislación vigente, así como cualquier otro concepto que pueda tener incidencia sobre la ejecución del servicio materia del presente contrato.`];
    })()),
    ...clausula("CLÁUSULA CUARTA: DEL PAGO", [
      `LA ENTIDAD CONTRATANTE se obliga a pagar la contraprestación a EL CONTRATISTA en soles, en ${texto(contrato.formaPago, "pago único")}, luego de la recepción formal y completa de la documentación correspondiente, según lo establecido en el artículo 144 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF.`,
      `Para tal efecto, el responsable de otorgar la conformidad de la prestación deberá hacerlo en un plazo que no excederá de los siete (7) días del día siguiente de la recepción del bien, salvo que se requiera efectuar pruebas que permitan verificar el cumplimiento de la obligación, en cuyo caso la conformidad se emite en un plazo máximo de veinte (20) días, bajo responsabilidad de dicho servidor.`,
      `LA ENTIDAD CONTRATANTE debe efectuar el pago dentro de los diez (10) días hábiles siguientes de otorgada la conformidad de los bienes, siempre que se verifiquen las condiciones establecidas en el contrato para ello, bajo responsabilidad del servidor competente.`,
      `En caso de retraso en el pago por parte de LA ENTIDAD CONTRATANTE, salvo que se deba a caso fortuito o fuerza mayor, EL CONTRATISTA tendrá derecho al pago de intereses legales conforme a lo establecido en el artículo 67 de la Ley N° 32069, Ley General de Contrataciones Públicas.`,
    ]),
  );

  if (contrato.preciosUnitarios && contrato.preciosUnitarios.length > 0) {
    children.push(p("DETALLE DE PRECIOS UNITARIOS", { bold: true, align: AlignmentType.LEFT, after: 80 }));
    const tBorders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
    } as const;
    const hdrCell = (text: string) =>
      new TableCell({
        children: [p(text, { bold: true, size: 18, align: AlignmentType.CENTER })],
        shading: { fill: "E8E8E8" },
        verticalAlign: "center" as unknown as undefined,
      });
    const valCell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
      new TableCell({ children: [p(text, { size: 18, align })] });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tBorders,
        rows: [
          new TableRow({
            tableHeader: true,
            children: [hdrCell("CONCEPTO"), hdrCell("MARCA"), hdrCell("UNIDAD"), hdrCell("CANT."), hdrCell("P. UNITARIO S/."), hdrCell("P. TOTAL S/.")],
          }),
          ...contrato.preciosUnitarios.map(
            (it) =>
              new TableRow({
                children: [
                  valCell(it.concepto),
                  valCell(it.marca),
                  valCell(it.unidad, AlignmentType.CENTER),
                  valCell(it.cantidad, AlignmentType.RIGHT),
                  valCell(it.precioUnitario, AlignmentType.RIGHT),
                  valCell(it.precioTotal, AlignmentType.RIGHT),
                ],
              }),
          ),
          new TableRow({
            children: [
              new TableCell({
                children: [p("TOTAL GENERAL S/.", { bold: true, size: 18, align: AlignmentType.RIGHT })],
                columnSpan: 5,
              }),
              new TableCell({
                children: [p(contrato.preciosTotalGeneral || "", { bold: true, size: 18, align: AlignmentType.RIGHT })],
              }),
            ],
          }),
        ],
      }),
    );
    children.push(p("", { after: 120 }));
  }

  children.push(
    ...clausula("CLÁUSULA QUINTA: DEL PLAZO DE LA EJECUCIÓN DE LA PRESTACIÓN", [
      `El plazo de ejecución del presente contrato es de ${texto(contrato.plazoEntrega, FALTA("plazo de ejecución"))}, el mismo que se computa desde ${texto(contrato.inicioPlazo, "el día siguiente del perfeccionamiento del contrato")}.`,
      "Cuando el Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF, no establezca un plazo específico para la respuesta de las partes, aplica el plazo máximo de respuesta de siete (7) días calendario. Durante la ejecución contractual, las partes pueden acordar la prórroga de este plazo máximo específico para cada caso específico.",
    ]),
    ...clausula("CLÁUSULA SEXTA: PARTES INTEGRANTES DEL CONTRATO", [
      "El presente contrato está conformado por las bases integradas, la oferta ganadora, así como los documentos derivados del procedimiento de selección que establezcan obligaciones para las partes, incluyendo las modificaciones contractuales y adendas aprobadas por la entidad contratante, de ser el caso.",
    ]),
    ...clausula("CLÁUSULA SÉTIMA: CONFORMIDAD DE LA PRESTACIÓN", [
      "La recepción y conformidad de la prestación se regula por lo dispuesto en el artículo 144 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado mediante Decreto Supremo N° 009-2025-EF.",
      `La recepción será otorgada por ${texto(contrato.recepcionArea, "el Almacén de la entidad o la unidad que haga sus veces")} y la conformidad será otorgada por ${texto(contrato.conformidadArea, "el área usuaria")} en el plazo máximo de ${texto(contrato.plazoConformidadDias, "siete (7)")} días computados desde el día siguiente de producida la recepción.`,
      "De existir observaciones, LA ENTIDAD CONTRATANTE las comunica al CONTRATISTA, indicando claramente el sentido de estas, otorgándole un plazo para subsanar no mayor al 30% del plazo del entregable correspondiente. Si pese al plazo otorgado, EL CONTRATISTA no cumpliese a cabalidad con la subsanación, LA ENTIDAD CONTRATANTE puede otorgar periodos adicionales para las correcciones pertinentes. En este supuesto corresponde aplicar la penalidad por mora desde el vencimiento del plazo para subsanar.",
      "Este procedimiento no resulta aplicable cuando los bienes manifiestamente no cumplan con las características y condiciones ofrecidas, en cuyo caso no se efectúa la recepción ni se otorga la conformidad, debiendo considerarse como no ejecutada la prestación, aplicándose la penalidad que corresponda por cada día de atraso.",
    ]),
    ...clausula("CLÁUSULA OCTAVA: GESTIÓN DE RIESGOS", [
      "LAS PARTES realizan la gestión de riesgos de acuerdo con lo establecido en el presente contrato y los documentos que lo conforman, a fin de tomar decisiones informadas, aprovechando el impacto de las oportunidades y disminuyendo la probabilidad de las amenazas durante la ejecución contractual, considerando la finalidad pública de la contratación.",
    ]),
    ...clausula("CLÁUSULA NOVENA: RESPONSABILIDAD POR VICIOS OCULTOS", [
      `La recepción conforme de la prestación por parte de LA ENTIDAD CONTRATANTE no enerva su derecho a reclamar posteriormente por defectos o vicios ocultos, conforme a los artículos 69 de la Ley N° 32069 y 144 de su Reglamento. El plazo máximo de responsabilidad del CONTRATISTA es de ${texto(contrato.viciosOcultosAnios, "un (1)")} año(s) contado a partir de la conformidad otorgada por LA ENTIDAD CONTRATANTE.`,
    ]),
    ...clausula("CLÁUSULA DÉCIMA: PENALIDADES", [
      "Si EL CONTRATISTA incurre en retraso injustificado en la ejecución de las prestaciones objeto del contrato, LA ENTIDAD CONTRATANTE le aplica automáticamente una penalidad por mora por cada día de atraso, de acuerdo con la siguiente fórmula: Penalidad Diaria = (0.10 x monto) / (F x plazo), donde F = 0.40.",
      "El retraso se justifica a través de la solicitud de ampliación de plazo debidamente aprobada. Adicionalmente, se considera justificado el retraso y no se aplica penalidad cuando EL CONTRATISTA acredite, de modo objetivamente sustentado, que el mayor tiempo transcurrido no le resulta imputable. En este caso la calificación del retraso como justificado no da lugar al pago de gastos generales ni costos directos de ningún tipo.",
      "Las penalidades se deducen de los pagos a cuenta, pagos parciales o del pago final, según corresponda. Cuando se llegue a cubrir el monto máximo de la penalidad (10% del monto vigente del contrato), LA ENTIDAD CONTRATANTE puede resolver el contrato por incumplimiento.",
    ]),
    ...clausula("CLÁUSULA DECIMOPRIMERA: RESOLUCIÓN DEL CONTRATO", [
      "Cualquiera de las partes puede resolver el contrato, de conformidad con el numeral 68.1 del artículo 68 de la Ley General de Contrataciones Públicas. De encontrarse en alguno de los supuestos de resolución del contrato, LAS PARTES proceden de acuerdo con lo establecido en el artículo 122 del Reglamento de la Ley N° 32069, aprobado mediante Decreto Supremo N° 009-2025-EF.",
    ]),
    ...clausula("CLÁUSULA DECIMOSEGUNDA: RESPONSABILIDAD DE LAS PARTES", [
      "Cuando se resuelva el contrato por causas imputables a alguna de las partes, se debe resarcir los daños y perjuicios ocasionados, a través de la indemnización correspondiente. Ello no obsta la aplicación de las sanciones administrativas, penales y pecuniarias a que dicho incumplimiento diere lugar, en el caso que éstas correspondan. Lo señalado precedentemente no exime a ninguna de las partes del cumplimiento de las demás obligaciones previstas en el presente contrato.",
    ]),
    ...clausula("CLÁUSULA DECIMOTERCERA: ANTICORRUPCIÓN Y ANTISOBORNO", [
      "A la suscripción de este contrato, EL CONTRATISTA declara y garantiza no haber ofrecido, negociado, prometido o efectuado ningún pago o entrega de cualquier beneficio o incentivo ilegal, de manera directa o indirecta, a los evaluadores del proceso de contratación o cualquier servidor de la entidad contratante.",
      "Asimismo, EL CONTRATISTA se obliga a mantener una conducta proba e íntegra durante la vigencia del contrato, y después de culminado el mismo en caso existan controversias pendientes de resolver.",
      "EL CONTRATISTA se obliga a abstenerse de ofrecer, negociar, prometer o dar regalos, cortesías, invitaciones, donativos o cualquier beneficio o incentivo ilegal, directa o indirectamente, a funcionarios públicos, servidores públicos, locadores de servicios o proveedores de servicios del área usuaria, de la dependencia encargada de la contratación, actores del proceso de contratación y/o cualquier servidor de la entidad contratante.",
      "Tratándose de una persona jurídica, lo anterior se extiende a sus accionistas, participacionistas, integrantes de los órganos de administración, apoderados, representantes legales, funcionarios, asesores o cualquier persona vinculada. El incumplimiento de estas obligaciones otorga a LA ENTIDAD CONTRATANTE el derecho de resolver total o parcialmente el contrato, sin perjuicio de las acciones civiles, penales y administrativas a que hubiera lugar.",
    ]),
    ...clausula("CLÁUSULA DECIMOCUARTA: MARCO LEGAL DEL CONTRATO", [
      "El marco legal comprende la Ley N° 32069, Ley General de Contrataciones Públicas, y su Reglamento aprobado por Decreto Supremo N° 009-2025-EF, las directivas que emita la Dirección General de Abastecimiento del Ministerio de Economía y Finanzas, así como el OECE, PERÚ COMPRAS y demás normativa especial que resulte aplicable.",
    ]),
    ...clausula("CLÁUSULA DECIMOQUINTA: SOLUCIÓN DE CONTROVERSIAS", [
      "Las controversias que surjan entre las partes durante la ejecución del contrato se resuelven mediante arbitraje, según el acuerdo de las partes. Cualquiera de las partes tiene derecho a iniciar el arbitraje dentro del plazo de caducidad previsto en la Ley N° 32069 y su Reglamento. El laudo arbitral emitido es inapelable, definitivo y obligatorio para las partes desde el momento de su notificación.",
    ]),
    ...clausula("CLÁUSULA DECIMOSEXTA: CONVENIO ARBITRAL", [
      `Las partes acuerdan que todo litigio y controversia resultante de este contrato o relativo a éste, se resolverá mediante arbitraje de acuerdo con los artículos 332 y 333 del Reglamento de la Ley N° 32069. El arbitraje es organizado y administrado por ${texto(contrato.institucionArbitral, FALTA("institución arbitral"))}, de conformidad con sus reglamentos y estatutos vigentes, a los cuales las partes se someten libremente.`,
    ]),
    ...clausula("CLÁUSULA DECIMOSÉPTIMA: FACULTAD DE ELEVAR A ESCRITURA PÚBLICA", [
      "Cualquiera de las partes podrá elevar el presente contrato a Escritura Pública corriendo con todos los gastos que demande esta formalidad.",
    ]),
    ...clausula("CLÁUSULA DECIMOCTAVA: NOTIFICACIONES DURANTE LA EJECUCIÓN CONTRACTUAL", [
      `Las partes declaran el siguiente domicilio para efecto de las notificaciones que se realicen conforme a la Décimo Tercera Disposición Complementaria Transitoria del Reglamento de la Ley N° 32069: DOMICILIO DE LA ENTIDAD CONTRATANTE: ${texto(proceso.entidadDomicilio, FALTA("domicilio de la entidad"))}. DOMICILIO DEL CONTRATISTA: ${texto(po.domicilio, FALTA("domicilio del contratista"))}.`,
      "La variación del domicilio aquí declarado de alguna de las partes debe ser comunicada a la otra parte, formalmente y por escrito, con una anticipación no menor de quince (15) días calendario.",
      `EL CONTRATISTA señala el siguiente correo electrónico para efectos de las notificaciones durante la ejecución del presente contrato: ${texto(po.correo, FALTA("correo del contratista"))}. La variación del correo electrónico debe ser comunicada formalmente y por escrito con una anticipación no menor de cinco (5) días calendario.`,
    ]),
    p(
      `De acuerdo con las bases integradas, la oferta y las disposiciones del presente contrato, las partes lo firman por duplicado en señal de conformidad en la ciudad de ${texto(contrato.ciudadFirma, FALTA("ciudad"))}, al ${fechaES(contrato.fechaFirma) || texto(contrato.fechaFirma, FALTA("fecha de suscripción"))}.`,
      { after: 600 },
    ),
  );

  // Firmas
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ font: "Calibri", size: 22, text: "_____________________________" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: "Calibri", size: 22, bold: true, text: "“LA ENTIDAD CONTRATANTE”" })] }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ font: "Calibri", size: 22, text: "_____________________________" })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: "Calibri", size: 22, bold: true, text: "“EL CONTRATISTA”" })] }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  const MARGIN_2CM = 1134;
  const document = new Document({
    sections: [{
      properties: { page: { margin: { top: MARGIN_2CM, bottom: MARGIN_2CM, left: MARGIN_2CM, right: MARGIN_2CM } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ font: "Calibri", size: 18, color: "555555", children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES] })],
            }),
          ],
        }),
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

// ── PDF ──
function wrapText(text: string, maxLen: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if ((cur + " " + word).trim().length > maxLen && cur.length > 0) {
      lines.push(cur.trim());
      cur = word;
    } else cur += (cur ? " " : "") + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export async function buildContratoCpPdf(input: ContratoCpInput): Promise<Buffer> {
  const doc = await PDL.create();
  const page = doc.addPage([612, 792]);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesB = await doc.embedFont(StandardFonts.TimesRomanBold);
  const pw = page.getWidth();
  const ph = page.getHeight();
  const M = 50;
  let y = ph - M;

  function tb(text: string, size = 18, bold = true) {
    page.drawText(text, { x: M, y, size, font: bold ? helvB : times });
    y -= size + 4;
  }
  function drawTextBlock(text: string, size = 10, bold = false) {
    const font = bold ? timesB : times;
    const lines = wrapText(text, 95);
    for (const ln of lines) {
      if (y < M + 20) { y = ph - M; doc.addPage([612, 792]); }
      page.drawText(ln, { x: M, y, size, font });
      y -= size + 2;
    }
  }
  function drawLine() {
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: pw - M, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= 6;
  }

  const c = input.contrato;
  const p = input.proceso;
  const po = input.postor;

  tb("CONTRATO DE COMPARACIÓN DE PRECIOS", 14, true);
  tb(`Nº ${input.numeroContrato || "[POR COMPLETAR]"}`, 11, false);
  y -= 8;

  tb("PARTES CONTRATANTES", 11, true);
  drawTextBlock(`Conste por el presente documento, la contratación de ${texto(p.denominacion, FALTA("denominación"))}, que celebra ${texto(p.entidadNombre, FALTA("entidad"))}, con RUC ${texto(p.entidadRuc, FALTA("RUC"))}, con domicilio en ${texto(p.entidadDomicilio, FALTA("domicilio"))}, representada por ${texto(p.entidadRepresentante ?? "", FALTA("representante"))}, y de otra parte ${texto(po.razonSocial, FALTA("contratista"))}, con RUC ${texto(po.ruc, FALTA("RUC"))}, con domicilio en ${texto(po.domicilio, FALTA("domicilio"))}, representada por ${texto(po.representante, FALTA("representante"))}.`, 9);
  y -= 4;

  tb("OBJETO", 11, true);
  drawTextBlock(`El presente contrato tiene por objeto ${texto(p.denominacion, FALTA("objeto"))}.`, 9);
  y -= 4;

  const montoLetras = c.monto ? numeroALetras(c.monto) : "";
  tb("MONTO", 11, true);
  drawTextBlock(`El monto asciende a ${texto(c.monto, FALTA("monto"))} (${montoLetras}), incluidos impuestos.`, 9);
  y -= 4;

  tb("PAGO", 11, true);
  drawTextBlock(`LA ENTIDAD CONTRATANTE pagará en soles, en ${texto(c.formaPago, "pago único")}, luego de la recepción formal de la documentación.`, 9);
  y -= 4;

  tb("PLAZO", 11, true);
  drawTextBlock(`El plazo de ejecución es de ${texto(c.plazoEntrega, FALTA("plazo"))}, computado desde ${texto(c.inicioPlazo, "el día siguiente del perfeccionamiento del contrato")}.`, 9);
  y -= 4;

  if (c.cronograma.length > 0) {
    tb("BIENES / CRONOGRAMA", 10, true);
    const rh = 16; const fontSize = 8;
    const colWidths = [30, 160, 60, 50, 50];
    const x0 = M;
    function drawTableRows(headers: string[], rows: string[][]) {
      if (y < M + 40) { y = ph - M; doc.addPage([612, 792]); }
      let cx = x0;
      for (let i = 0; i < headers.length; i++) {
        page.drawRectangle({ x: cx, y: y - rh, width: colWidths[i], height: rh, color: rgb(0.9, 0.9, 0.9), borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
        page.drawText(headers[i], { x: cx + 2, y: y - rh + 4, size: fontSize, font: helvB });
        cx += colWidths[i];
      }
      y -= rh;
      for (const row of rows) {
        if (y < M + 20) { y = ph - M; doc.addPage([612, 792]); }
        cx = x0;
        for (let i = 0; i < row.length; i++) {
          page.drawRectangle({ x: cx, y: y - rh, width: colWidths[i], height: rh, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
          page.drawText(row[i].substring(0, Math.floor(colWidths[i] / 5)), { x: cx + 2, y: y - rh + 4, size: fontSize, font: times });
          cx += colWidths[i];
        }
        y -= rh;
      }
    }
    drawTableRows(
      ["Paq.", "Descripción", "Marca", "Unid.", "Cant."],
      c.cronograma.map((b) => [b.paquete, b.descripcion.substring(0, 25), b.marca ?? "", b.unidad, b.cantidad]),
    );
    y -= 4;
  }

  tb("VICIOS OCULTOS", 11, true);
  drawTextBlock(`El plazo máximo de responsabilidad es de ${texto(c.viciosOcultosAnios, "un (1)")} año(s).`, 9);
  y -= 4;

  tb("ARBITRAJE", 11, true);
  drawTextBlock(`Las controversias se resuelven mediante arbitraje ante ${texto(c.institucionArbitral, FALTA("institución arbitral"))}.`, 9);
  y -= 8;

  drawLine();
  tb("FIRMA", 11, true);
  drawTextBlock(`Suscrito en ${texto(c.ciudadFirma, FALTA("ciudad"))}, al ${fechaES(c.fechaFirma) || texto(c.fechaFirma, FALTA("fecha"))}.`, 9);
  y -= 12;
  drawTextBlock("____________________________\nLA ENTIDAD CONTRATANTE", 9);
  y -= 10;
  drawTextBlock("____________________________\nEL CONTRATISTA", 9);

  return Buffer.from(await doc.save());
}
