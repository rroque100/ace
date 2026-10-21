import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { processTypeLabel } from "./legal-taxonomy";

export type ContractInput = {
  entity: string;
  entityRuc?: string | null;
  entityAddress?: string | null;
  object: string;
  processType?: string | null;
  /** Nombre legible del proceso (resuelto desde el catalogo de Configuracion). */
  processTypeLabel?: string | null;
  amount?: string | null;
  contractorName?: string | null;
  contractorRuc?: string | null;
  durationDays?: number | null;
  place?: string | null;
};

export type ClauseReference = { article: string; title: string; excerpt: string };

// Clausulas obligatorias del articulo 60 de la Ley 32069, con redaccion base.
const mandatoryClauses = [
  {
    title: "GARANTÍAS",
    text: "El contratista garantiza el fiel cumplimiento de sus obligaciones mediante los mecanismos previstos en el artículo 61 de la Ley 32069 (fideicomiso, carta fianza financiera, contrato de seguro o retención de pago), incondicionales, solidarios, irrevocables y de realización automática.",
  },
  {
    title: "CLÁUSULA ANTICORRUPCIÓN Y ANTISOBORNO",
    text: "Las partes se obligan a conducirse con integridad, absteniéndose de ofrecer, dar o recibir cualquier beneficio indebido. El incumplimiento de esta cláusula faculta a la entidad a resolver el contrato y a iniciar las acciones legales correspondientes.",
  },
  {
    title: "SOLUCIÓN DE CONTROVERSIAS",
    text: "Las controversias que surjan durante la ejecución del contrato se resuelven mediante conciliación y/o arbitraje, conforme a la Ley 32069 y su reglamento, dentro de los plazos de caducidad previstos.",
  },
  {
    title: "RESOLUCIÓN DE CONTRATO POR INCUMPLIMIENTO",
    text: "La entidad contratante podrá resolver el contrato ante el incumplimiento de las obligaciones esenciales del contratista, previo requerimiento para su cumplimiento dentro del plazo otorgado.",
  },
  {
    title: "GESTIÓN DE RIESGOS",
    text: "Las partes identifican, asignan y administran los riesgos previsibles del contrato conforme a la normativa de contrataciones públicas y a la matriz de riesgos del proceso.",
  },
];

function heading(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, text });
}

function body(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

const ordinals = ["PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA"];

export async function buildContractDocx(
  input: ContractInput,
  references: ClauseReference[] = [],
): Promise<Buffer> {
  const today = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
  // Preferimos el label resuelto desde el catalogo; si no llega, intentamos la
  // taxonomia fija y, como ultimo recurso, el codigo crudo.
  const process =
    input.processTypeLabel?.trim() ||
    (input.processType ? processTypeLabel(input.processType) ?? input.processType : null) ||
    "contratación pública";

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      text: `CONTRATO DE ${process.toUpperCase()}`,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ italics: true, text: input.object })],
      spacing: { after: 240 },
    }),
    body(
      `Conste por el presente documento el contrato que celebran, de una parte, ${input.entity}${input.entityRuc ? `, con RUC ${input.entityRuc}` : ""}${input.entityAddress ? `, con domicilio en ${input.entityAddress}` : ""} (en adelante, LA ENTIDAD), y de la otra, ${input.contractorName ?? "[CONTRATISTA]"}${input.contractorRuc ? `, RUC ${input.contractorRuc}` : ""} (en adelante, EL CONTRATISTA), en los términos y condiciones siguientes, al amparo de la Ley 32069, Ley General de Contrataciones Públicas, y su reglamento.`,
    ),
  ];

  let ordinalIndex = 0;
  const clause = (title: string, text: string) => {
    const label = `CLÁUSULA ${ordinals[ordinalIndex] ?? `N° ${ordinalIndex + 1}`}: ${title}`;
    ordinalIndex += 1;
    children.push(heading(label), body(text));
  };

  clause("OBJETO", `EL CONTRATISTA se obliga a ejecutar la prestación correspondiente a: ${input.object}.`);
  clause(
    "MONTO",
    `El monto del contrato asciende a ${input.amount ?? "[MONTO]"}, que LA ENTIDAD pagará conforme a las condiciones del proceso de ${process}.`,
  );
  clause(
    "PLAZO",
    `El plazo de ejecución es de ${input.durationDays ? `${input.durationDays} días` : "[PLAZO]"} calendario, contados desde el día siguiente de la suscripción del presente contrato${input.place ? `, en ${input.place}` : ""}.`,
  );

  for (const item of mandatoryClauses) {
    clause(item.title, `${item.text} (Artículo 60 de la Ley 32069 — cláusula obligatoria).`);
  }

  if (references.length > 0) {
    children.push(heading("REFERENCIAS NORMATIVAS DEL CORPUS"));
    for (const reference of references) {
      children.push(
        new Paragraph({
          children: [new TextRun({ bold: true, text: `Artículo ${reference.article} — ${reference.title}: ` }), new TextRun(reference.excerpt.slice(0, 600))],
          spacing: { after: 100 },
        }),
      );
    }
  }

  children.push(
    new Paragraph({ spacing: { before: 240 }, text: `Suscrito en señal de conformidad. Fecha: ${today}.` }),
    new Paragraph({
      children: [
        new TextRun({
          color: "888888",
          italics: true,
          text: "Borrador generado automáticamente por ACE IA Jurídica como apoyo. No constituye asesoría legal vinculante; revíselo y ajústelo antes de su uso.",
        }),
      ],
      spacing: { before: 240 },
    }),
  );

  const document = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(document));
}
