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

// ── Contrato de SUBASTA INVERSA ELECTRÓNICA (proforma bases estándar 2026) ──
// Basado en el CAPÍTULO V "PROFORMA DEL CONTRATO" de las bases estándar de
// SIE para bienes y servicios comunes (Ley 32069 / D.S. 009-2025-EF),
// págs. 49-57 del documento de referencia de la entidad.

export type BienCronograma = {
  paquete: string;
  descripcion: string;
  marca?: string;
  unidad: string;
  cantidad: string;
  // Plazo o fecha de entrega del ítem (si difiere del plazo general).
  entrega?: string;
  // N° de entrega/armada a la que pertenece el bien (1, 2, 3...).
  nroEntrega?: number;
};

export type ContratoSieInput = {
  numeroContrato?: string;
  proceso: {
    // Ej. "SUBASTA INVERSA ELECTRONICA Nº 02-2026-DEC-MDCH-1"
    nomenclatura: string;
    // Denominación de la convocatoria (objeto de la contratación).
    denominacion: string;
    entidadNombre: string;
    entidadRuc: string;
    entidadDomicilio: string;
    fechaBuenaPro?: string;
    // Representante legal de la entidad (gerente/titular) — viene de entity_settings.
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
    docTipo?: string; // DNI | Carné de extranjería
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
    cronograma: BienCronograma[];
    entregas?: Array<{ nro: number; lugarEntrega: string; plazoEntrega: string; tipoDias: string }>;
    preciosUnitarios?: { concepto: string; marca: string; unidad: string; cantidad: string; precioUnitario: string; precioTotal: string }[];
    preciosTotalGeneral?: string;
    garantiaAplica: boolean;
    garantiaDetalle?: string;
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

function celda(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new TextRun({ font: "Calibri", size: 20, bold: opts.bold, text })],
      }),
    ],
  });
}

export async function buildContratoSieDocx(input: ContratoSieInput): Promise<Buffer> {
  const { proceso, postor, contrato } = input;
  const anio = new Date().getFullYear();
  const numero = texto(input.numeroContrato, `CONTRATO N° ___-${anio}`);
  const entidad = texto(proceso.entidadNombre, FALTA("nombre de la entidad"));
  const contratista = texto(postor.razonSocial, FALTA("razón social del contratista"));

  const children: (Paragraph | Table)[] = [];

  // Título
  children.push(
    p(numero.toUpperCase(), { bold: true, align: AlignmentType.CENTER, after: 60 }),
    p(`CONTRATO DE ${texto(proceso.denominacion, FALTA("denominación de la convocatoria")).toUpperCase()}`, {
      bold: true,
      align: AlignmentType.CENTER,
      after: 60,
    }),
    p(texto(proceso.nomenclatura, FALTA("nomenclatura del procedimiento")).toUpperCase(), {
      bold: true,
      align: AlignmentType.CENTER,
      after: 240,
    }),
  );

  // Comparecencia
  const registroPostor =
    postor.partidaRegistral || postor.asiento
      ? `, inscrita en la Partida Registral N° ${texto(postor.partidaRegistral, "[…]")} Asiento N° ${texto(postor.asiento, "[…]")} del Registro de Personas Jurídicas de la ciudad de ${texto(postor.ciudadRegistro, "[…]")}`
      : "";
  const poderPostor =
    postor.poderPartida || postor.poderAsiento
      ? `, según poder inscrito en la Partida Registral N° ${texto(postor.poderPartida, "[…]")}, Asiento N° ${texto(postor.poderAsiento, "[…]")} del Registro de Personas Jurídicas de la ciudad de ${texto(postor.poderCiudad ?? postor.ciudadRegistro, "[…]")}`
      : "";
  const entidadRepresentante = texto(proceso.entidadRepresentante, FALTA("nombre del representante de la entidad"));
  const entidadRepresentanteCargo = texto(proceso.entidadRepresentanteCargo, "Gerente General");
  const entidadRepresentanteDni = texto(proceso.entidadRepresentanteDni, FALTA("DNI del representante de la entidad"));

  children.push(
    p(
      `Conste por el presente documento, la contratación de ${texto(proceso.denominacion, FALTA("denominación de la convocatoria"))}, que celebra de una parte ${entidad}, en adelante LA ENTIDAD CONTRATANTE, con RUC N° ${texto(proceso.entidadRuc, FALTA("RUC de la entidad"))}, con domicilio legal en ${texto(proceso.entidadDomicilio, FALTA("domicilio de la entidad"))}, representada por ${entidadRepresentanteCargo} ${entidadRepresentante}, identificado con DNI N° ${entidadRepresentanteDni}; y de otra parte ${contratista}, con RUC N° ${texto(postor.ruc, FALTA("RUC del contratista"))}, con domicilio legal en ${texto(postor.domicilio, FALTA("domicilio del contratista"))}${registroPostor}, debidamente representado por su Representante Legal, ${texto(postor.representante, FALTA("representante legal"))}, con ${texto(postor.docTipo, "DNI")} N° ${texto(postor.docNumero, "[…]")}${poderPostor}, a quien en adelante se le denominará EL CONTRATISTA, en los términos y condiciones siguientes:`,
      { after: 200 },
    ),
  );

  // Cláusulas
  children.push(
    ...clausula("CLÁUSULA PRIMERA: ANTECEDENTES", [
      `Con fecha ${texto(proceso.fechaBuenaPro, FALTA("fecha de la buena pro"))}, el oficial de compra adjudicó la buena pro de la ${texto(proceso.nomenclatura, FALTA("nomenclatura"))} para la contratación de ${texto(proceso.denominacion, FALTA("denominación"))}, a ${contratista}, cuyos detalles e importe constan en los documentos integrantes del presente contrato.`,
    ]),
    ...clausula("CLÁUSULA SEGUNDA: OBJETO", [
      `El presente contrato tiene por objeto la ${texto(proceso.denominacion, FALTA("objeto de la contratación"))}.`,
    ]),
    ...clausula("CLÁUSULA TERCERA: MONTO CONTRACTUAL", (() => {
      const montoText = texto(contrato.monto, FALTA("moneda y monto"));
      const montoLetras = contrato.monto ? numeroALetras(contrato.monto) : "";
      const cuerpo = `El monto total del presente contrato asciende a ${montoText} (${montoLetras}), que incluye todos los impuestos de ley. Este monto comprende el costo del objeto contractual, todos los tributos, seguros, transporte, inspecciones, pruebas y, de ser el caso, los costos laborales conforme a la legislación vigente, así como cualquier otro concepto que pueda tener incidencia sobre la ejecución de la prestación materia del presente contrato.`;
      return [cuerpo];
    })()),
  );

  if (contrato.preciosUnitarios && contrato.preciosUnitarios.length > 0) {
    children.push(p("DETALLE DE LOS PRECIOS UNITARIOS DEL PRECIO OFERTADO", { bold: true, align: AlignmentType.LEFT, after: 80 }));
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
    ...clausula("CLÁUSULA CUARTA: DEL PAGO", [
      `LA ENTIDAD CONTRATANTE se obliga a pagar la contraprestación a EL CONTRATISTA en soles, en ${texto(contrato.formaPago, "pago único")}, luego de la recepción formal y completa de la documentación correspondiente, según lo establecido en el artículo 144 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado mediante Decreto Supremo N° 009-2025-EF.`,
      `Para tal efecto, el responsable de otorgar la conformidad de la prestación debe hacerlo en un plazo que no excederá de los siete (7) días del día siguiente de producida la recepción, salvo que se requiera efectuar pruebas que permitan verificar el cumplimiento de la obligación, en cuyo caso la conformidad se emite en un plazo máximo de veinte (20) días, bajo responsabilidad de dicho servidor.`,
      `LA ENTIDAD CONTRATANTE debe efectuar el pago dentro de los diez (10) días hábiles siguientes de otorgada la conformidad de los bienes, siempre que se verifiquen las condiciones establecidas en el contrato para ello, bajo responsabilidad del funcionario competente. En caso de retraso en el pago, salvo caso fortuito o fuerza mayor, EL CONTRATISTA tendrá derecho al pago de intereses legales conforme al artículo 67 de la Ley General de Contrataciones Públicas.`,
    ]),
    ...clausula("CLAUSULA QUINTA: DEL PLAZO DE LA EJECUCION DE LA PRESTACION", (() => {
      const ents = contrato.entregas ?? [];
      if (ents.length > 1) {
        return ents.map((e) => `ENTREGA ${e.nro} DE ${ents.length}: plazo de ${texto(e.plazoEntrega, FALTA("plazo"))} dias ${e.tipoDias === "habil" ? "habiles" : "calendario"} contados desde ${texto(contrato.inicioPlazo, "el dia siguiente del perfeccionamiento del contrato")}. LUGAR DE ENTREGA: ${texto(e.lugarEntrega, FALTA("lugar de entrega"))}.`);
      } else {
        const e = ents[0];
        return [`El plazo de ejecucion del presente contrato es de ${texto(e?.plazoEntrega ?? contrato.plazoEntrega, FALTA("plazo de entrega"))} dias ${e?.tipoDias === "habil" ? "habiles" : "calendario"} contados desde ${texto(contrato.inicioPlazo, "el dia siguiente del perfeccionamiento del contrato")}.`,`LUGAR DE ENTREGA: ${texto(e?.lugarEntrega ?? contrato.lugarEntrega, FALTA("lugar de entrega"))}.`];
      }
    })()),
  );

  // Cronograma de entrega (lista de bienes del objeto de la convocatoria)
  if (contrato.cronograma.length > 0) {
    const maxEntrega = Math.max(...contrato.cronograma.map((b) => b.nroEntrega ?? 1), 1);
    const tieneMultiplesEntregas = maxEntrega > 1;

    children.push(p("CRONOGRAMA DE ENTREGA", { bold: true, align: AlignmentType.LEFT, after: 80 }));

    const cronBorders = {
      top: { style: BorderStyle.SINGLE, size: 2, color: "888888" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "888888" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "888888" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "888888" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "BBBBBB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "BBBBBB" },
    };
    const cronHeader = new TableRow({
      children: [
        celda("PAQUETE", { bold: true, width: 12 }),
        celda("DESCRIPCIÓN", { bold: true, width: 44 }),
        celda("MARCA", { bold: true, width: 14 }),
        celda("UNIDAD", { bold: true, width: 14 }),
        celda("CANTIDAD", { bold: true, width: 16 }),
      ],
    });
    const cronRow = (b: BienCronograma) =>
      new TableRow({
        children: [
          celda(b.paquete),
          celda(b.descripcion),
          celda(b.marca ?? ""),
          celda(b.unidad),
          celda(b.cantidad),
        ],
      });

    if (tieneMultiplesEntregas) {
      for (let n = 1; n <= maxEntrega; n += 1) {
        const grupo = contrato.cronograma.filter((b) => (b.nroEntrega ?? 1) === n);
        if (grupo.length === 0) continue;
        const e = (contrato.entregas ?? []).find((en) => en.nro === n);
        children.push(
          p(`Entrega ${n} de ${maxEntrega}: plazo de ${texto(e?.plazoEntrega ?? "", FALTA("plazo"))} dias ${e?.tipoDias === "habil" ? "habiles" : "calendario"} contados desde el dia siguiente del perfeccionamiento del contrato. LUGAR DE ENTREGA: ${texto(e?.lugarEntrega ?? "", FALTA("lugar de entrega"))}.`, { size: 20, after: 60 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: cronBorders,
            rows: [cronHeader, ...grupo.map(cronRow)],
          }),
          p("", { after: 120 }),
        );
      }
    } else {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: cronBorders,
          rows: [cronHeader, ...contrato.cronograma.map(cronRow)],
        }),
        p("", { after: 160 }),
      );
    }
  }

  children.push(
    ...clausula("CLÁUSULA SEXTA: PARTES INTEGRANTES DEL CONTRATO", [
      "El presente contrato está conformado por las bases integradas, la oferta ganadora, así como los documentos derivados del procedimiento de selección que establezcan obligaciones para las partes, incluyendo las modificaciones contractuales y adendas aprobadas por la entidad contratante, de ser el caso.",
    ]),
    ...clausula(
      "CLÁUSULA SÉTIMA: GARANTÍAS",
      contrato.garantiaAplica
        ? [
            `EL CONTRATISTA entregó al perfeccionamiento del contrato la respectiva garantía incondicional, solidaria, irrevocable y de realización automática en el país al solo requerimiento, a favor de LA ENTIDAD CONTRATANTE: Garantía de fiel cumplimiento del contrato: ${texto(contrato.garantiaDetalle, FALTA("monto, mecanismo, número y emisor de la garantía"))}, la misma que debe mantenerse vigente hasta la conformidad de la prestación. El monto señalado es equivalente al diez por ciento (10%) del monto del contrato original.`,
          ]
        : [
            "Conforme a lo dispuesto en el literal a) del artículo 139 del Reglamento de la Ley N° 32069, por tratarse de un contrato de bienes cuyo monto es menor o igual a 50 UIT, no corresponde presentar garantía de fiel cumplimiento.",
          ],
    ),
    ...clausula("CLÁUSULA OCTAVA: EJECUCIÓN DE GARANTÍAS POR FALTA DE RENOVACIÓN", [
      "LA ENTIDAD CONTRATANTE puede solicitar la ejecución de las garantías cuando EL CONTRATISTA no las hubiere renovado antes de la fecha de su vencimiento, conforme a lo dispuesto en el artículo 118 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado mediante Decreto Supremo N° 009-2025-EF.",
    ]),
    ...clausula("CLÁUSULA NOVENA: RECEPCIÓN Y CONFORMIDAD DE LA PRESTACIÓN", [
      `La recepción y conformidad de la prestación se regula por lo dispuesto en el artículo 144 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas. La recepción será otorgada por ${texto(contrato.recepcionArea, "el Almacén de la entidad o la unidad que haga sus veces")} y la conformidad será otorgada por ${texto(contrato.conformidadArea, "el área usuaria")} en el plazo máximo de ${texto(contrato.plazoConformidadDias, "siete (7)")} días computados desde el día siguiente de producida la recepción.`,
      "De existir observaciones, LA ENTIDAD CONTRATANTE las comunica al CONTRATISTA, indicando claramente el sentido de estas, otorgándole un plazo para subsanar no mayor al 30% del plazo del entregable correspondiente. Si pese al plazo otorgado, EL CONTRATISTA no cumpliese a cabalidad con la subsanación, LA ENTIDAD CONTRATANTE puede otorgar periodos adicionales, aplicando la penalidad por mora desde el vencimiento del plazo para subsanar. Este procedimiento no resulta aplicable cuando los bienes manifiestamente no cumplan con las características y condiciones ofrecidas, en cuyo caso no se efectúa la recepción ni se otorga la conformidad, considerándose como no ejecutada la prestación.",
    ]),
    ...clausula("CLÁUSULA DÉCIMA: GESTIÓN DE RIESGOS", [
      "LAS PARTES realizan la gestión de riesgos de acuerdo con lo establecido en el presente contrato y los documentos que lo conforman, a fin de tomar decisiones informadas, aprovechando el impacto de las oportunidades y disminuyendo la probabilidad de las amenazas durante la ejecución contractual, considerando la finalidad pública de la contratación.",
    ]),
    ...clausula("CLÁUSULA DECIMOPRIMERA: RESPONSABILIDAD POR VICIOS OCULTOS", [
      `La recepción conforme de la prestación por parte de LA ENTIDAD CONTRATANTE no enerva su derecho a reclamar posteriormente por defectos o vicios ocultos, conforme a los artículos 69 de la Ley N° 32069 y 144 de su Reglamento. El plazo máximo de responsabilidad del contratista es de ${texto(contrato.viciosOcultosAnios, "un (1)")} año(s) contado a partir de la conformidad otorgada por LA ENTIDAD CONTRATANTE.`,
    ]),
    ...clausula("CLÁUSULA DECIMOSEGUNDA: PENALIDADES", [
      "Si EL CONTRATISTA incurre en retraso injustificado en la ejecución de las prestaciones objeto del contrato, LA ENTIDAD le aplica automáticamente una penalidad por mora por cada día de atraso, de acuerdo a la siguiente fórmula: Penalidad Diaria = (0.10 x monto) / (F x plazo), donde F = 0.40.",
      "El retraso se justifica a través de la solicitud de ampliación de plazo debidamente aprobada. Adicionalmente, se considera justificado el retraso y no se aplica penalidad cuando EL CONTRATISTA acredite, de modo objetivamente sustentado, que el mayor tiempo transcurrido no le resulta imputable; en este caso la calificación no da lugar al pago de gastos generales ni costos directos (numeral 120.4 del artículo 120 del Reglamento).",
      "Las penalidades se deducen de los pagos a cuenta, pagos parciales o del pago final, según corresponda; o si fuera necesario, se cobra del monto resultante de la ejecución de la garantía de fiel cumplimiento. Cuando se llegue a cubrir el monto máximo de la penalidad (10% del monto vigente del contrato), LA ENTIDAD CONTRATANTE puede resolver el contrato por incumplimiento.",
    ]),
    ...clausula("CLÁUSULA DECIMOTERCERA: RESOLUCIÓN DEL CONTRATO", [
      "Cualquiera de las partes puede resolver el contrato, de conformidad con el numeral 68.1 del artículo 68 de la Ley General de Contrataciones Públicas. De encontrarse en alguno de los supuestos de resolución del contrato, LAS PARTES proceden de acuerdo con lo establecido en el artículo 122 del Reglamento de la Ley N° 32069, aprobado mediante Decreto Supremo N° 009-2025-EF.",
    ]),
    ...clausula("CLÁUSULA DECIMOCUARTA: RESPONSABILIDAD DE LAS PARTES", [
      "Cuando se resuelva el contrato por causas imputables a alguna de las partes, se debe resarcir los daños y perjuicios ocasionados, a través de la indemnización correspondiente. Ello no obsta la aplicación de las sanciones administrativas, penales y pecuniarias a que dicho incumplimiento diere lugar, en el caso que éstas correspondan. Lo señalado precedentemente no exime a ninguna de las partes del cumplimiento de las demás obligaciones previstas en el presente contrato.",
    ]),
    ...clausula("CLÁUSULA DECIMOQUINTA: ANTICORRUPCIÓN Y ANTISOBORNO", [
      "A la suscripción de este contrato, EL CONTRATISTA declara y garantiza no haber ofrecido, negociado, prometido o efectuado ningún pago o entrega de cualquier beneficio o incentivo ilegal, de manera directa o indirecta, a los evaluadores del proceso de contratación o cualquier servidor de la entidad contratante. Asimismo, EL CONTRATISTA se obliga a mantener una conducta proba e íntegra durante la vigencia del contrato, y después de culminado el mismo en caso existan controversias pendientes de resolver.",
      "EL CONTRATISTA se obliga a abstenerse de ofrecer, negociar, prometer o dar regalos, cortesías, invitaciones, donativos o cualquier beneficio o incentivo ilegal, directa o indirectamente, a funcionarios públicos, servidores públicos, locadores de servicios o proveedores de servicios del área usuaria, de la dependencia encargada de la contratación, actores del proceso de contratación y/o cualquier servidor de la entidad contratante, con la finalidad de obtener alguna ventaja indebida o beneficio ilícito, adoptando las medidas técnicas, organizativas y/o de personal necesarias para asegurar su cumplimiento; y se compromete a denunciar oportunamente ante las autoridades competentes los actos de corrupción de los cuales tuviera conocimiento durante la ejecución del contrato.",
      "Tratándose de una persona jurídica, lo anterior se extiende a sus accionistas, participacionistas, integrantes de los órganos de administración, apoderados, representantes legales, funcionarios, asesores o cualquier persona vinculada. El incumplimiento de estas obligaciones otorga a LA ENTIDAD CONTRATANTE el derecho de resolver total o parcialmente el contrato, sin perjuicio de las acciones civiles, penales y administrativas a que hubiera lugar.",
    ]),
    ...clausula("CLÁUSULA DECIMOSEXTA: MARCO LEGAL DEL CONTRATO", [
      "El marco legal comprende la Ley N° 32069, Ley General de Contrataciones Públicas, y su Reglamento aprobado por Decreto Supremo N° 009-2025-EF, las directivas que emita la Dirección General de Abastecimiento del Ministerio de Economía y Finanzas, así como el OECE, PERÚ COMPRAS y demás normativa especial que resulte aplicable.",
    ]),
    ...clausula("CLÁUSULA DECIMOSÉPTIMA: SOLUCIÓN DE CONTROVERSIAS", [
      "Las controversias que surjan entre las partes durante la ejecución del contrato se resuelven mediante arbitraje, según el acuerdo de las partes. Cualquiera de las partes tiene derecho a iniciar el arbitraje dentro del plazo de caducidad previsto en la Ley N° 32069 y su Reglamento. El laudo arbitral emitido es inapelable, definitivo y obligatorio para las partes desde el momento de su notificación (numeral 84.9 del artículo 84 de la Ley N° 32069).",
    ]),
    ...clausula("CLÁUSULA DECIMOCTAVA: CONVENIO ARBITRAL", [
      `Las partes acuerdan que todo litigio y controversia resultante de este contrato o relativo a éste, se resolverá mediante arbitraje de acuerdo con los artículos 332 y 333 del Reglamento de la Ley N° 32069. El arbitraje es organizado y administrado por ${texto(contrato.institucionArbitral, FALTA("institución arbitral elegida por el postor"))}, de conformidad con sus reglamentos y estatutos vigentes, a los cuales las partes se someten libremente.`,
    ]),
    ...clausula("CLÁUSULA DECIMONOVENA: FACULTAD DE ELEVAR A ESCRITURA PÚBLICA", [
      "Cualquiera de las partes podrá elevar el presente contrato a Escritura Pública corriendo con todos los gastos que demande esta formalidad.",
    ]),
    ...clausula("CLÁUSULA VIGÉSIMA: NOTIFICACIONES DURANTE LA EJECUCIÓN CONTRACTUAL", [
      `Las partes declaran el siguiente domicilio para efecto de las notificaciones que se realicen conforme a la Décimo Tercera Disposición Complementaria Transitoria del Reglamento de la Ley N° 32069: DOMICILIO DE LA ENTIDAD CONTRATANTE: ${texto(proceso.entidadDomicilio, FALTA("domicilio de la entidad"))}. DOMICILIO DEL CONTRATISTA: ${texto(postor.domicilio, FALTA("domicilio del contratista"))}.`,
      "La variación del domicilio aquí declarado de alguna de las partes debe ser comunicada a la otra parte, formalmente y por escrito, con una anticipación no menor de quince (15) días calendario.",
      `EL CONTRATISTA señala el siguiente correo electrónico para efectos de las notificaciones durante la ejecución del presente contrato que no se realicen a través del SEACE de la Pladicop: ${texto(postor.correo, FALTA("correo del contratista"))}. La variación del correo electrónico debe ser comunicada formalmente y por escrito con una anticipación no menor de cinco (5) días calendario.`,
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
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 400 },
                  children: [
                    new TextRun({ font: "Calibri", size: 22, text: "_____________________________" }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ font: "Calibri", size: 22, bold: true, text: "“LA ENTIDAD CONTRATANTE”" }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 400 },
                  children: [
                    new TextRun({ font: "Calibri", size: 22, text: "_____________________________" }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ font: "Calibri", size: 22, bold: true, text: "“EL CONTRATISTA”" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  const MARGIN_2CM = 1134;
  const document = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: MARGIN_2CM, bottom: MARGIN_2CM, left: MARGIN_2CM, right: MARGIN_2CM } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    font: "Calibri",
                    size: 18,
                    color: "555555",
                    children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

// ── Generación de PDF (versión simplificada con pdf-lib) ──

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

export async function buildContratoSiePdf(input: ContratoSieInput): Promise<Buffer> {
  const doc = await PDL.create();
  const page = doc.addPage([612, 792]); // US Letter
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesB = await doc.embedFont(StandardFonts.TimesRomanBold);
  const pw = page.getWidth();
  const ph = page.getHeight();
  const M = 50;
  let y = ph - M;

  function tb(text: string, size = 18, font = helvB) {
    page.drawText(text, { x: M, y, size, font });
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
  function drawTable(headers: string[], rows: string[][], colWidths: number[]) {
    const rh = 16; const fontSize = 8;
    const x0 = M;
    // header
    let cx = x0;
    for (let i = 0; i < headers.length; i++) {
      page.drawRectangle({ x: cx, y: y - rh, width: colWidths[i], height: rh, color: rgb(0.9, 0.9, 0.9), borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
      page.drawText(headers[i], { x: cx + 2, y: y - rh + 4, size: fontSize, font: helvB });
      cx += colWidths[i];
    }
    y -= rh;
    // rows
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

  const c = input.contrato;
  const p = input.proceso;
  const po = input.postor;

  // Título
  tb("CONTRATO DE SUBASTA INVERSA ELECTRÓNICA", 16);
  tb(`Nº ${input.numeroContrato || "[POR COMPLETAR]"}`, 12, helv);
  y -= 8;

  // Partes
  tb("PARTES CONTRATANTES", 11);
  drawTextBlock(`El presente contrato se celebra entre ${texto(p.entidadNombre, FALTA("entidad"))}, con RUC ${texto(p.entidadRuc, FALTA("RUC de la entidad"))}, con domicilio en ${texto(p.entidadDomicilio, FALTA("domicilio de la entidad"))}, representada por ${texto(p.entidadRepresentante ?? "", FALTA("representante de la entidad"))}${p.entidadRepresentanteCargo ? `, en su calidad de ${p.entidadRepresentanteCargo}` : ""}, a quien en adelante se denominará LA ENTIDAD CONTRATANTE; y, ${texto(po.razonSocial, FALTA("contratista"))}, con RUC ${texto(po.ruc, FALTA("RUC"))}, con domicilio en ${texto(po.domicilio, FALTA("domicilio"))}, representada por ${texto(po.representante, FALTA("representante"))}, a quien en adelante se denominará EL CONTRATISTA.`, 9);
  y -= 4;

  // Objeto
  tb("OBJETO", 11);
  drawTextBlock(`LA ENTIDAD CONTRATANTE contrata con EL CONTRATISTA la adquisición de "${texto(p.denominacion, FALTA("objeto de la contratación"))}", conforme a las Especificaciones Técnicas y disposiciones de las Bases y la documentación presentada por EL CONTRATISTA.`, 9);
  y -= 4;

  // Monto
  tb("MONTO DEL CONTRATO", 11);
  const montoLetras2 = c.monto ? numeroALetras(c.monto) : "";
  drawTextBlock(`El monto contractual asciende a ${texto(c.monto, FALTA("monto"))} (${montoLetras2}), incluidos los impuestos de ley.`, 9);
  y -= 4;

  // Forma de pago
  tb("FORMA DE PAGO", 11);
  drawTextBlock(`LA ENTIDAD CONTRATANTE pagará a EL CONTRATISTa el monto establecido en la cláusula anterior bajo la modalidad de ${texto(c.formaPago, FALTA("forma de pago"))}.`, 9);
  y -= 4;

  // Plazo / lugar
  tb("PLAZO Y LUGAR DE ENTREGA", 11);
  const ent = (c.entregas ?? [])[0];
  drawTextBlock(`EL CONTRATISTA se obliga a entregar los bienes en el plazo y lugar siguiente: Lugar: ${texto(ent?.lugarEntrega ?? "", FALTA("lugar de entrega"))}. Plazo: ${texto(ent?.plazoEntrega ?? "", FALTA("plazo de entrega"))} días ${ent?.tipoDias === "habil" ? "hábiles" : "calendario"}.`, 9);
  y -= 4;

  // Cronograma table
  if (c.cronograma.length > 0) {
    tb("CRONOGRAMA DE ENTREGA", 10);
    const maxEnt = Math.max(...c.cronograma.map((b) => b.nroEntrega ?? 1), 1);
    const multiEnt = maxEnt > 1;
    if (multiEnt) {
      for (let n = 1; n <= maxEnt; n++) {
        const grupo = c.cronograma.filter((b) => (b.nroEntrega ?? 1) === n);
        if (grupo.length === 0) continue;
        const e = (c.entregas ?? []).find((en) => en.nro === n);
        drawTextBlock(`Entrega ${n} de ${maxEnt}: plazo de ${texto(e?.plazoEntrega ?? "", FALTA("plazo"))} días ${e?.tipoDias === "habil" ? "hábiles" : "calendario"}. LUGAR DE ENTREGA: ${texto(e?.lugarEntrega ?? "", FALTA("lugar de entrega"))}.`, 8);
        drawTable(
          ["Paq.", "Descripción", "Marca", "Unid.", "Cant."],
          grupo.map((b) => [b.paquete, b.descripcion.substring(0, 25), b.marca ?? "", b.unidad, b.cantidad]),
          [30, 160, 60, 50, 50],
        );
        y -= 4;
      }
    } else {
      drawTable(
        ["Paq.", "Descripción", "Marca", "Unid.", "Cant."],
        c.cronograma.map((b) => [b.paquete, b.descripcion.substring(0, 25), b.marca ?? "", b.unidad, b.cantidad]),
        [30, 160, 60, 50, 50],
      );
    }
    y -= 6;
  }

  // Precios unitarios table
  if ((c.preciosUnitarios ?? []).length > 0) {
    tb("DETALLE DE PRECIOS UNITARIOS", 10);
    drawTable(
      ["Concepto", "Marca", "Unidad", "Cant.", "P. Unit.", "P. Total"],
      (c.preciosUnitarios ?? []).map((p) => [p.concepto.substring(0, 18), p.marca, p.unidad, p.cantidad, p.precioUnitario, p.precioTotal]),
      [80, 50, 40, 40, 60, 60],
    );
    y -= 4;
  }

  // Garantía
  if (c.garantiaAplica) {
    tb("GARANTÍA DE FIEL CUMPLIMIENTO", 10);
    drawTextBlock(texto(c.garantiaDetalle, `EL CONTRATISTA entrega garantía por el monto de ${texto(c.monto, FALTA("monto de garantía"))}.`), 9);
  }

  // Conformidad / vicios
  tb("CONFORMIDAD Y VICIOS OCULTOS", 10);
  drawTextBlock(`La recepción de los bienes estará a cargo de ${texto(c.recepcionArea, "Almacén de la entidad")}. La conformidad será emitida por ${texto(c.conformidadArea, "Área usuaria")} en un plazo de ${texto(c.plazoConformidadDias, "siete (7)")} días. El plazo de vicios ocultos es de ${texto(c.viciosOcultosAnios, "un (1)")} año(s).`, 9);
  y -= 4;

  // Arbitraje
  tb("SOLUCIÓN DE CONTROVERSIAS", 10);
  drawTextBlock(`Las controversias que surjan se resuelven mediante arbitraje institucional ante ${texto(c.institucionArbitral, FALTA("institución arbitral"))}.`, 9);
  y -= 4 * 3;

  // Signature area
  drawLine();
  tb("FIRMA ELECTRÓNICA", 11);
  drawTextBlock(`Suscrito en ${texto(c.ciudadFirma, FALTA("ciudad"))}, al ${fechaES(c.fechaFirma) || texto(c.fechaFirma, FALTA("fecha de firma"))}.`, 9);
  y -= 12;
  drawTextBlock("____________________________\nLA ENTIDAD CONTRATANTE", 9);
  y -= 10;
  drawTextBlock("____________________________\nEL CONTRATISTA", 9);

  return Buffer.from(await doc.save());
}

