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
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { searchLegalSources } from "./legal-chat";
import { objectTypeLabel, processDocKindLabel, processTypeLabel } from "./legal-taxonomy";
import { evaluateProcurementRules } from "./procurement-rules";
import type { ProcurementProcess } from "./processes";
import { draftKinds, type DraftKind } from "./draft-kinds";

export { draftKinds, type DraftKind };

export type ProcessDocumentWithText = {
  id: string;
  kind: string;
  bidder_name: string | null;
  title: string;
  extracted_text: string | null;
  status: string;
};

export type EvaluationMatrixRow = {
  requisito: string;
  exigidoEnBases: string;
  presentadoPorPostor: string;
  resultado: "cumple" | "no_cumple" | "subsanable" | "riesgo";
  observacion: string;
};

export type ProcessRiskItem = {
  riesgo: string;
  nivel: "alto" | "medio" | "bajo";
  sustento: string;
  accionRecomendada: string;
};

export type ProcessEvaluationResult = {
  bidderName: string | null;
  matrix: EvaluationMatrixRow[];
  model: string;
  observations: string[];
  result: "cumple" | "no_cumple" | "subsanable" | "riesgo";
};

export type ProcessRiskResult = {
  items: ProcessRiskItem[];
  model: string;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return {};
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function textOf(document: ProcessDocumentWithText) {
  return document.extracted_text?.trim() ?? "";
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}\n...[texto truncado]` : text;
}

function baseDocuments(documents: ProcessDocumentWithText[]) {
  return documents.filter((document) =>
    ["bases", "bases_integradas", "requerimiento", "tdr", "ee_tt"].includes(document.kind),
  );
}

function offerDocuments(documents: ProcessDocumentWithText[], bidderName?: string | null) {
  const offers = documents.filter((document) => document.kind === "oferta");
  if (!bidderName) {
    return offers;
  }
  const normalizedBidder = normalize(bidderName);
  return offers.filter((document) => normalize(document.bidder_name ?? "").includes(normalizedBidder));
}

function buildDocumentContext(documents: ProcessDocumentWithText[], maxPerDoc = 2400) {
  return documents
    .filter((document) => textOf(document).length > 0)
    .map(
      (document) =>
        `### ${processDocKindLabel(document.kind)}: ${document.title}${
          document.bidder_name ? `\nPostor: ${document.bidder_name}` : ""
        }\n${truncate(textOf(document), maxPerDoc)}`,
    )
    .join("\n\n");
}

function fallbackEvaluation(input: {
  bases: ProcessDocumentWithText[];
  bidderName: string | null;
  offers: ProcessDocumentWithText[];
}): ProcessEvaluationResult {
  const offerText = normalize(input.offers.map(textOf).join("\n"));
  const rows: EvaluationMatrixRow[] = [
    {
      requisito: "Oferta cargada y legible",
      exigidoEnBases: "El expediente debe contar con oferta del postor para evaluar admisión y calificación.",
      presentadoPorPostor: input.offers.length > 0 ? `${input.offers.length} documento(s) de oferta.` : "No hay oferta cargada.",
      resultado: input.offers.length > 0 ? "cumple" : "no_cumple",
      observacion: input.offers.length > 0 ? "La oferta tiene texto extraído." : "Carga la oferta del postor antes de evaluar.",
    },
    {
      requisito: "Declaraciones/anexos",
      exigidoEnBases: "Las bases suelen exigir anexos y declaraciones obligatorias.",
      presentadoPorPostor: offerText.includes("anexo") || offerText.includes("declaracion") ? "Se detectan anexos/declaraciones." : "No se detectan anexos/declaraciones.",
      resultado: offerText.includes("anexo") || offerText.includes("declaracion") ? "riesgo" : "subsanable",
      observacion: "Validación automática preliminar; revisar anexos específicos de las bases.",
    },
    {
      requisito: "Monto ofertado",
      exigidoEnBases: "La oferta económica debe respetar las reglas del procedimiento y cuantía.",
      presentadoPorPostor: offerText.includes("s/") || offerText.includes("soles") ? "Se detecta referencia a monto." : "No se detecta monto.",
      resultado: offerText.includes("s/") || offerText.includes("soles") ? "riesgo" : "subsanable",
      observacion: "Revisar manualmente importe, moneda, IGV y límites aplicables.",
    },
  ];
  const result = rows.some((row) => row.resultado === "no_cumple")
    ? "no_cumple"
    : rows.some((row) => row.resultado === "subsanable")
      ? "subsanable"
      : "riesgo";

  return {
    bidderName: input.bidderName,
    matrix: rows,
    model: "fallback-evaluation",
    observations: [
      input.bases.length === 0
        ? "No se cargaron bases/requerimiento/TDR para contrastar la oferta."
        : "La matriz fue generada con reglas heurísticas por falta de respuesta IA.",
    ],
    result,
  };
}

function normalizeEvaluationResult(value: unknown): ProcessEvaluationResult["result"] {
  return value === "cumple" || value === "no_cumple" || value === "subsanable" || value === "riesgo"
    ? value
    : "riesgo";
}

function normalizeMatrix(value: unknown): EvaluationMatrixRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      return {
        requisito: typeof row.requisito === "string" ? row.requisito : "Requisito no identificado",
        exigidoEnBases: typeof row.exigidoEnBases === "string" ? row.exigidoEnBases : "",
        presentadoPorPostor: typeof row.presentadoPorPostor === "string" ? row.presentadoPorPostor : "",
        resultado: normalizeEvaluationResult(row.resultado),
        observacion: typeof row.observacion === "string" ? row.observacion : "",
      };
    })
    .filter((row): row is EvaluationMatrixRow => Boolean(row));
}

export async function evaluateOfferForProcess(input: {
  bidderName?: string | null;
  documents: ProcessDocumentWithText[];
  process: ProcurementProcess;
}): Promise<ProcessEvaluationResult> {
  const bases = baseDocuments(input.documents);
  const offers = offerDocuments(input.documents, input.bidderName);
  const bidderName = input.bidderName ?? offers[0]?.bidder_name ?? null;

  if (offers.length === 0) {
    return fallbackEvaluation({ bases, bidderName, offers });
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres Evaluation Agent para contrataciones publicas peruanas. Compara bases/requerimientos contra oferta de postor. No inventes requisitos. Si falta texto o documento, marca riesgo/subsanable. Devuelve solo JSON valido.",
          role: "system",
        },
        {
          content: `Expediente:
Nomenclatura: ${input.process.nomenclature}
Objeto: ${objectTypeLabel(input.process.object_type)}
Procedimiento: ${input.process.procedure_type ? processTypeLabel(input.process.procedure_type) ?? input.process.procedure_type : "no indicado"}
Monto: ${input.process.amount ?? "no indicado"}
Entidad: ${input.process.entity ?? "no indicada"}

BASES / REQUERIMIENTO:
${buildDocumentContext(bases, 3000) || "No se cargaron bases/requerimiento/TDR."}

OFERTA DEL POSTOR ${bidderName ?? "sin nombre"}:
${buildDocumentContext(offers, 4500)}

Devuelve JSON:
{
  "result": "cumple|no_cumple|subsanable|riesgo",
  "observations": ["observacion general"],
  "matrix": [
    {
      "requisito": "nombre del requisito",
      "exigidoEnBases": "texto o resumen de exigencia",
      "presentadoPorPostor": "texto o resumen presentado",
      "resultado": "cumple|no_cumple|subsanable|riesgo",
      "observacion": "accion o sustento"
    }
  ]
}
Incluye requisitos de admision, calificacion, experiencia, plazo, monto, anexos, fichas tecnicas/equipamiento/persona clave si aparecen.`,
          role: "user",
        },
      ],
      max_output_tokens: 1800,
      model: legalAnswerModel,
      temperature: 0.1,
    });
    const parsed = parseJsonObject(response.output_text);
    const matrix = normalizeMatrix(parsed.matrix);

    if (matrix.length === 0) {
      return fallbackEvaluation({ bases, bidderName, offers });
    }

    return {
      bidderName,
      matrix,
      model: legalAnswerModel,
      observations: stringArray(parsed.observations),
      result: normalizeEvaluationResult(parsed.result),
    };
  } catch {
    return fallbackEvaluation({ bases, bidderName, offers });
  }
}

function fallbackRisks(input: {
  documents: ProcessDocumentWithText[];
  process: ProcurementProcess;
}): ProcessRiskResult {
  const docs = input.documents;
  const hasBases = docs.some((document) => ["bases", "bases_integradas"].includes(document.kind));
  const hasOffer = docs.some((document) => document.kind === "oferta");
  const rules = evaluateProcurementRules({
    amount: input.process.amount ?? "",
    objectType: input.process.object_type as "bienes" | "servicios" | "obras" | "consultoria",
    procedureType: input.process.procedure_type ?? "",
  });
  const items: ProcessRiskItem[] = [];

  if (!hasBases) {
    items.push({
      accionRecomendada: "Cargar bases o requerimiento antes de evaluar oferta o emitir acta.",
      nivel: "alto",
      riesgo: "Expediente sin bases/requerimiento",
      sustento: "No se encontró documento de bases, bases integradas o requerimiento en el expediente.",
    });
  }

  if (!hasOffer) {
    items.push({
      accionRecomendada: "Cargar oferta(s) de postor y repetir evaluación.",
      nivel: "medio",
      riesgo: "No hay oferta de postor",
      sustento: "La matriz de evaluación no puede completarse sin oferta legible.",
    });
  }

  for (const finding of rules.findings.filter((finding) => finding.status !== "cumple")) {
    items.push({
      accionRecomendada: finding.action,
      nivel: finding.level === "bloqueante" || finding.level === "alto" ? "alto" : finding.level === "medio" ? "medio" : "bajo",
      riesgo: finding.message,
      sustento: finding.code,
    });
  }

  return {
    items:
      items.length > 0
        ? items
        : [
            {
              accionRecomendada: "Mantener revisión humana de bases, oferta y normativa aplicable.",
              nivel: "bajo",
              riesgo: "Sin riesgo automático crítico",
              sustento: "No se detectaron alertas heurísticas principales.",
            },
          ],
    model: "fallback-risk-detection",
  };
}

function normalizeRisks(value: unknown): ProcessRiskItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const nivel = row.nivel === "alto" || row.nivel === "medio" || row.nivel === "bajo" ? row.nivel : "medio";
      return {
        accionRecomendada: typeof row.accionRecomendada === "string" ? row.accionRecomendada : "",
        nivel,
        riesgo: typeof row.riesgo === "string" ? row.riesgo : "Riesgo no identificado",
        sustento: typeof row.sustento === "string" ? row.sustento : "",
      };
    })
    .filter((item): item is ProcessRiskItem => Boolean(item));
}

export async function detectRisksForProcess(input: {
  documents: ProcessDocumentWithText[];
  process: ProcurementProcess;
}): Promise<ProcessRiskResult> {
  const fallback = fallbackRisks(input);
  const documentContext = buildDocumentContext(input.documents, 2800);

  if (!documentContext) {
    return fallback;
  }

  const legal = await searchLegalSources({
    filters: { processType: input.process.procedure_type ?? "" },
    query: `${input.process.nomenclature} ${input.process.summary ?? ""} riesgos nulidad direccionamiento competencia procedimiento`,
    topK: 6,
  }).catch(() => null);

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres Risk Detection Agent para contrataciones publicas peruanas. Detecta riesgos de nulidad, direccionamiento, restriccion de competencia, desierto, control, procedimiento, documentacion falsa e incumplimiento. Devuelve solo JSON valido.",
          role: "system",
        },
        {
          content: `Expediente:
${input.process.nomenclature}
Objeto: ${objectTypeLabel(input.process.object_type)}
Procedimiento: ${input.process.procedure_type ? processTypeLabel(input.process.procedure_type) ?? input.process.procedure_type : "no indicado"}
Monto: ${input.process.amount ?? "no indicado"}

Documentos del expediente:
${documentContext}

Alertas del motor de reglas:
${fallback.items.map((item) => `- ${item.riesgo}: ${item.sustento}`).join("\n")}

Normas recuperadas:
${(legal?.sources ?? [])
  .slice(0, 5)
  .map((source, index) => `[F${index + 1}] ${source.citation}\n${source.excerpt.slice(0, 500)}`)
  .join("\n\n")}

Devuelve JSON:
{
  "items": [
    {
      "riesgo": "descripcion breve",
      "nivel": "alto|medio|bajo",
      "sustento": "hecho del expediente y/o fuente [F#]",
      "accionRecomendada": "accion concreta"
    }
  ]
}`,
          role: "user",
        },
      ],
      max_output_tokens: 1400,
      model: legalAnswerModel,
      temperature: 0.1,
    });
    const parsed = parseJsonObject(response.output_text);
    const items = normalizeRisks(parsed.items);
    return items.length > 0 ? { items, model: legalAnswerModel } : fallback;
  } catch {
    return fallback;
  }
}

function paragraph(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

// Márgenes normales: 2.5 cm superior/inferior, 3 cm izquierda/derecha.
const MARGENES = { top: 1418, bottom: 1418, left: 1701, right: 1701 };

/**
 * Pie de página con la trazabilidad de quién generó el documento —no una
 * firma, así que no va en el cuerpo que se imprime—: alineado a la izquierda,
 * a 8 pt.
 */
function footerElaboradoPor(elaboradoPor: string | null | undefined) {
  if (!elaboradoPor) return undefined;
  return {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ size: 16, text: `Elaborado por: ${elaboradoPor}` })],
        }),
      ],
    }),
  };
}

function heading(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 }, text });
}

function cell(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ bold, text })] })],
    width: { size: 20, type: WidthType.PERCENTAGE },
  });
}

function labelOfDraft(kind: DraftKind) {
  return draftKinds.find((item) => item.value === kind)?.label ?? "Documento administrativo";
}

function indexCell(text: string, bold = false, size = 25) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ bold, text })] })],
    width: { size, type: WidthType.PERCENTAGE },
  });
}

async function buildExpedienteUnicoDocx(
  process: ProcurementProcess,
  documents: DraftDocumentRow[],
  processType: string,
  today: string,
  elaboradoPor?: string | null,
): Promise<Buffer> {
  const fecha = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const children: Array<Paragraph | Table> = [
    new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, text: "EXPEDIENTE ELECTRÓNICO ÚNICO" }),
    paragraph(`Expediente: ${process.nomenclature}`),
    paragraph(`Entidad: ${process.entity ?? "[Entidad]"}`),
    paragraph(`Objeto: ${objectTypeLabel(process.object_type)} - ${processType}`),
    paragraph(`Fecha de cierre/archivo: ${today}`),
    heading("Índice de actuaciones"),
  ];

  if (documents.length === 0) {
    children.push(paragraph("El expediente no registra documentos cargados."));
  } else {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [indexCell("N.°", true, 8), indexCell("Actuación", true, 27), indexCell("Documento", true, 45), indexCell("Fecha", true, 20)],
          }),
          ...documents.map(
            (document, index) =>
              new TableRow({
                children: [
                  indexCell(String(index + 1), false, 8),
                  indexCell(processDocKindLabel(document.kind), false, 27),
                  indexCell(`${document.title}${document.bidder_name ? ` (${document.bidder_name})` : ""}`, false, 45),
                  indexCell(fecha(document.created_at), false, 20),
                ],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
  }

  children.push(
    paragraph(`Total de actuaciones: ${documents.length}.`),
    paragraph("Se deja constancia del cierre y archivo del expediente electrónico único conforme a la Ley N.° 32069 y su Reglamento."),
    paragraph("Firma / responsable del archivo: ______________________________"),
  );

  const document = new Document({
    sections: [{ children, footers: footerElaboradoPor(elaboradoPor), properties: { page: { margin: MARGENES } } }],
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export type DraftDocumentRow = {
  kind: string;
  title: string;
  bidder_name?: string | null;
  created_at?: string | null;
};

export async function buildAdministrativeDraftDocx(input: {
  draftKind: DraftKind;
  evaluation?: ProcessEvaluationResult | null;
  process: ProcurementProcess;
  risks?: ProcessRiskResult | null;
  documents?: DraftDocumentRow[];
  /** Nombre completo del usuario en sesión que generó el borrador. */
  elaboradoPor?: string | null;
}): Promise<Buffer> {
  const processType = input.process.procedure_type
    ? processTypeLabel(input.process.procedure_type) ?? input.process.procedure_type
    : "procedimiento no especificado";
  const title = labelOfDraft(input.draftKind).toUpperCase();
  const today = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });

  // Módulo 9: el "expediente electrónico único" es un índice/carátula que lista
  // todas las actuaciones cargadas, no el documento administrativo de plantilla.
  if (input.draftKind === "expediente_unico") {
    return buildExpedienteUnicoDocx(input.process, input.documents ?? [], processType, today, input.elaboradoPor);
  }
  const sources = await searchLegalSources({
    filters: { processType: input.process.procedure_type ?? "" },
    query: `${input.process.nomenclature} ${processType} ${labelOfDraft(input.draftKind)} contrataciones publicas`,
    topK: 5,
  }).catch(() => ({ sources: [] }));

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      text: title,
    }),
    paragraph(`Expediente: ${input.process.nomenclature}`),
    paragraph(`Entidad: ${input.process.entity ?? "[Entidad]"}`),
    paragraph(`Objeto: ${objectTypeLabel(input.process.object_type)} - ${processType}`),
    paragraph(`Monto referencial/estimado: ${input.process.amount != null ? `S/ ${input.process.amount.toLocaleString("es-PE")}` : "[Monto]"}`),
    heading("I. Antecedentes"),
    paragraph(
      `Con fecha ${today}, se emite el presente documento en el marco del expediente ${input.process.nomenclature}. ${input.process.summary ?? ""}`.trim(),
    ),
    heading("II. Base legal"),
  ];

  if (sources.sources.length > 0) {
    for (const [index, source] of sources.sources.entries()) {
      children.push(paragraph(`[F${index + 1}] ${source.citation}. ${source.documentTitle}.`));
    }
  } else {
    children.push(paragraph("Ley N.° 32069, su Reglamento y normativa aplicable cargada en el corpus institucional."));
  }

  children.push(heading("III. Análisis"));

  if (input.evaluation?.matrix.length) {
    children.push(paragraph(`Resultado de evaluación: ${input.evaluation.result}. Postor: ${input.evaluation.bidderName ?? "no identificado"}.`));
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [cell("Requisito", true), cell("Exigido", true), cell("Presentado", true), cell("Resultado", true), cell("Observación", true)],
          }),
          ...input.evaluation.matrix.slice(0, 12).map(
            (row) =>
              new TableRow({
                children: [
                  cell(row.requisito),
                  cell(row.exigidoEnBases),
                  cell(row.presentadoPorPostor),
                  cell(row.resultado),
                  cell(row.observacion),
                ],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
  } else {
    children.push(paragraph("No se adjunta matriz de evaluación automática. Completar análisis del expediente antes de aprobar."));
  }

  if (input.risks?.items.length) {
    children.push(heading("IV. Riesgos identificados"));
    for (const risk of input.risks.items) {
      children.push(paragraph(`${risk.nivel.toUpperCase()} - ${risk.riesgo}. Sustento: ${risk.sustento}. Acción: ${risk.accionRecomendada}`));
    }
  }

  children.push(
    heading("V. Conclusiones"),
    paragraph("La presente versión es un borrador de apoyo generado automáticamente y debe ser revisada por el área competente antes de su emisión."),
    heading("VI. Recomendaciones"),
    paragraph("Verificar vigencia normativa, consistencia de documentos del expediente, firmas, anexos y sustento presupuestal antes de usar el documento."),
    paragraph("Firma / área emisora: ______________________________"),
  );

  const document = new Document({
    sections: [
      { children, footers: footerElaboradoPor(input.elaboradoPor), properties: { page: { margin: MARGENES } } },
    ],
  });
  return Buffer.from(await Packer.toBuffer(document));
}
