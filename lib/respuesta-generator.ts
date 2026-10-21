import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

export type RespuestaInput = {
  entity: { name: string; ruc: string; address: string; executingUnit: string };
  nroOficio: string;
  destinatario: string;
  cargoDestinatario: string;
  asunto: string;
  cuerpo: string;
  // @deprecated baseLegal ya NO se incluye en el documento. Se mantiene
  // como opcional por compatibilidad; si viene, se ignora.
  baseLegal?: { referencia: string; texto: string }[];
  remitente: string;
  cargoRemitente: string;
  // Ciudad institucional del encabezado: "Challhuahuacho, 6 de julio de 2026".
  lugar?: string;
  // REF.: numero del documento anterior al que se responde (opcional).
  referencia?: string;
  // Tipo de documento (OFICIO, CARTA, ...): CARTA y OFICIO usan el modelo
  // oficial peruano (lugar y fecha arriba, Señor(a), ASUNTO/REF.).
  tipoDocumento?: string;
};

// El cuerpo llega como texto plano con saltos de linea: cada bloque separado
// por lineas en blanco es un parrafo justificado del documento.
function cuerpoParagraphs(cuerpo: string): Paragraph[] {
  return cuerpo
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ font: "Calibri", size: 22, text: line })],
          spacing: { after: 120 },
        }),
    );
}

export async function buildRespuestaDocx(input: RespuestaInput): Promise<Buffer> {
  const today = new Date().toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // "Lugar, fecha" (modelo oficial peruano) cuando hay ciudad configurada.
  const lugarFecha = input.lugar?.trim() ? `${input.lugar.trim()}, ${today}` : today;
  const tipo = (input.tipoDocumento ?? "").toUpperCase();
  const isCarta = tipo.includes("CARTA");
  const isOficio = tipo.includes("OFICIO");
  // CARTA y OFICIO siguen el modelo epistolar/protocolar: fecha arriba.
  const fechaArriba = isCarta || isOficio;

  const children: Paragraph[] = [];

  // ── Línea de referencia ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.entity.name.toUpperCase() }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: `RUC: ${input.entity.ruc}` }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: input.entity.address }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      border: {
        bottom: { color: "0d9488", size: 6, style: BorderStyle.SINGLE, space: 1 },
      },
      spacing: { after: 200 },
      text: "",
    }),
  );

  // ── Lugar y fecha (CARTA y OFICIO: arriba, alineada a la derecha) ──
  if (fechaArriba) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ font: "Calibri", size: 22, text: lugarFecha })],
        spacing: { after: 120 },
      }),
    );
  }

  // ── Número del documento ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.nroOficio }),
      ],
      spacing: { after: 40 },
    }),
  );

  // ── Destinatario ──
  // "Señor(a):" para carta y oficio simple; "Señor(es):" para el resto
  // (oficio multiple, memorandum, etc.).
  const labelDestinatario =
    isCarta || (isOficio && !tipo.includes("MULTIPLE")) ? "Señor(a):" : "Señor(es):";
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: labelDestinatario }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ bold: true, font: "Calibri", size: 22, text: input.destinatario }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 20, text: input.cargoDestinatario }),
      ],
      spacing: { after: 100 },
    }),
  );

  // ── Asunto (en la carta es opcional; en el oficio va en mayúsculas) ──
  const hayRef = Boolean(input.referencia?.trim());
  if (!isCarta || input.asunto.trim()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            bold: true,
            font: "Calibri",
            size: 22,
            text: isOficio ? "ASUNTO: " : "Asunto: ",
          }),
          new TextRun({ font: "Calibri", size: 22, text: input.asunto }),
        ],
        spacing: { after: hayRef ? 60 : fechaArriba ? 200 : 60 },
      }),
    );
  }

  // ── REF.: documento anterior al que se responde (opcional) ──
  if (hayRef) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ bold: true, font: "Calibri", size: 22, text: "REF.: " }),
          new TextRun({ font: "Calibri", size: 22, text: input.referencia?.trim() ?? "" }),
        ],
        spacing: { after: fechaArriba ? 200 : 60 },
      }),
    );
  }

  // ── Fecha (los demás tipos la llevan aquí; carta y oficio la ponen arriba) ──
  if (!fechaArriba) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ font: "Calibri", size: 22, text: `Fecha: ${lugarFecha}` }),
        ],
        spacing: { after: 200 },
      }),
    );
  }

  // ── Cuerpo (en la carta empieza con el saludo/vocativo que redacta la IA) ──
  children.push(...cuerpoParagraphs(input.cuerpo));

  // ── Despedida ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ font: "Calibri", size: 22, text: "Atentamente," }),
      ],
      spacing: { after: 400, before: 200 },
    }),
  );

  // ── Firma ──
  // El nombre y cargo del responsable NO se imprimen: tras "Atentamente,"
  // queda el espacio libre para la firma manuscrita y el sello.
  children.push(
    new Paragraph({
      children: [
        new TextRun({ color: "888888", font: "Calibri", italics: true, size: 18, text: "Documento generado por ACE IA Jurídica. Revise y valide antes de emitir." }),
      ],
      spacing: { before: 120 },
    }),
  );

  // Margen de 2 cm en los 4 lados (1 cm = 567 twips → 2 cm = 1134).
  const MARGIN_2CM = 1134;

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              bottom: MARGIN_2CM,
              left: MARGIN_2CM,
              right: MARGIN_2CM,
              top: MARGIN_2CM,
            },
          },
        },
        // Numeración "Página X de Y" en la esquina superior derecha.
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
