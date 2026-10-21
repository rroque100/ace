import { loadServerPdfJs } from "./pdf-server";
import pdfParse from "pdf-parse/lib/pdf-parse";
import { createHash } from "crypto";
import { getOpenAIClient, legalAnswerModel, pdfOcrModel } from "./openai-server";
import { type DocumentRecord, supabaseRest } from "./supabase-server";
import { deleteRecords, getPineconeConfig, upsertTextRecords, verifyDocumentIndexedInPinecone } from "./pinecone";
import { scopeProcessType } from "./documents";
import { repairLigatures } from "./text-normalization";
import {
  type RefType,
  detectCitations,
  extractArticleMentions,
  normalizeNormNumber,
} from "./legal-citations";
import {
  inferProcedureType,
  procedureAliases,
  procedureAnchors,
  procedureLabel,
} from "./procedure-catalog";

type ChunkInsert = {
  document_id: string;
  chunk_index: number;
  content: string;
  page_end: number | null;
  page_start: number | null;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};

const chunkSize = 2600;
const chunkOverlap = 350;
const chunkInsertBatchSize = 100;
const indexingPipelineVersion = "legal-page-aware-v2";
const minExtractedTextLength = 120;
const analysisTextLimit = 16000;
const unusableOcrPatterns = [
  "no puedo procesar",
  "no puedo extraer",
  "no puedo transcribir",
  "puedo ayudarte con un resumen",
  "i can't process",
  "i cannot process",
];

// Tokens consumidos por el OCR de OpenAI (solo presente cuando hubo OCR de
// imagen). `fromCache` = se reutilizó un OCR previo (0 tokens nuevos gastados,
// pero se reporta el coste original para la contabilidad por expediente).
export type OcrUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
  fromCache?: boolean;
};

export type ExtractedPdfText = {
  extractionMethod: "pdf-text" | "openai-ocr";
  ocrPartial: boolean;
  pageCount: number;
  pages: Array<{ pageNumber: number; text: string }>;
  text: string;
  usage?: OcrUsage;
};

export type TextChunk = {
  article: string | null;
  content: string;
  end: number;
  index: number;
  pageEnd: number | null;
  pageStart: number | null;
  sectionTitle: string | null;
  start: number;
};

type ProcessingJobRecord = {
  id: string;
};

type AiDocumentInsights = {
  amends?: string | null;
  confidence?: "alta" | "media" | "baja";
  documentType?: string;
  keyPoints?: string[];
  number?: string | null;
  practicalImpact?: string;
  relatedArticles?: string[];
  sourceEntity?: string | null;
  status?: string | null;
  summary?: string;
  topic?: string | null;
  vigencia?: string | null;
  year?: number | null;
};

type StructuredLegalMetadata = {
  articles: string[];
  dispositions: string[];
  issuer: string | null;
  numerals: string[];
  processType: string | null;
  relations: Array<{ relationType: "modifica" | "deroga" | "reglamenta" | "complementa" | "remite"; text: string }>;
  validitySignals: string[];
};

function normalizeText(text: string) {
  return repairLigatures(
    text
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function detectArticle(text: string) {
  const match = text.match(/\b(?:art[ií]culo|art\.?)\s+([0-9]+[A-Za-z-]*)/i);
  return match?.[1] ?? null;
}

function normalizeComparable(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSectionTitle(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 18);
  const heading = lines.find((line) =>
    /^(titulo|capitulo|subcapitulo|seccion|disposicion|anexo)\b/i.test(line),
  );

  return heading?.slice(0, 180) ?? null;
}

// Token de numero de norma: soporta "32069", "009-2025-EF" y el formato de
// opiniones/directivas/resoluciones con prefijo de letra y anio ("D026-2025/DTN",
// "000027-2025-DTN", "0001-2026-EF/54.01").
const normNumberToken = "[A-Za-z]?[0-9]{1,6}(?:-[0-9]{4})?(?:[-/][A-Za-z0-9.][A-Za-z0-9/.-]*)?";

const documentTypeKeyword: Record<string, string> = {
  ley: "ley",
  reglamento: "decreto\\s+supremo|reglamento",
  directiva: "directiva",
  opinion: "opini[oó]n",
  resolucion: "resoluci[oó]n",
};

function detectDocumentNumber(title: string, text: string, documentType?: string) {
  const source = `${title}\n${text.slice(0, 6000)}`;

  // 1) Patron del PROPIO tipo del documento primero, para no capturar una norma
  //    de otro tipo referenciada en el cuerpo (p. ej. una Ley citada dentro de
  //    una Opinion). El titulo va al inicio del source, asi que su numero gana.
  const keyword = documentType ? documentTypeKeyword[documentType] : undefined;
  if (keyword) {
    const specific = source.match(
      new RegExp(`\\b(?:${keyword})\\s*[-]?\\s*(?:n(?:\\.|°|º|ro)?\\s*)?(${normNumberToken})`, "i"),
    );
    if (specific?.[1]) {
      return specific[1].replace(/[.,;:]+$/, "");
    }
  }

  // 2) Fallback generico (cualquier tipo de norma).
  const match = source.match(
    new RegExp(
      `\\b(?:ley|decreto\\s+supremo|directiva|opini[oó]n|resoluci[oó]n)\\s*[-]?\\s*(?:n(?:\\.|°|º|ro)?\\s*)?(${normNumberToken})`,
      "i",
    ),
  );

  return match?.[1] ? match[1].replace(/[.,;:]+$/, "") : null;
}

function uniqueLimited(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function extractRegexMatches(text: string, pattern: RegExp, groupIndex = 0, limit = 30) {
  return uniqueLimited(
    Array.from(text.matchAll(pattern))
      .map((match) => match[groupIndex] ?? match[0])
      .filter(Boolean),
    limit,
  );
}

function detectIssuer(text: string) {
  const header = text.slice(0, 6000);
  const candidates = [
    /(?:ministerio|organismo|oece|osce|per[uú])[^.\n]{0,120}/i,
    /(?:decreto\s+supremo|directiva|resoluci[oó]n)[^.\n]{0,160}(?:ministerio|oece|osce|mef)[^.\n]{0,80}/i,
  ];

  for (const pattern of candidates) {
    const match = header.match(pattern);
    if (match?.[0]) {
      return normalizeText(match[0]).slice(0, 180);
    }
  }

  return null;
}

function extractStructuredLegalMetadata(text: string): StructuredLegalMetadata {
  const articles = extractRegexMatches(text, /\b(?:art[ií]culo|art\.?)\s+([0-9]+[A-Za-z-]*)/gi, 1, 80);
  const numerals = extractRegexMatches(text, /\b([0-9]{1,3}(?:\.[0-9]{1,3}){1,4})\b/g, 1, 80);
  const dispositions = extractRegexMatches(
    text,
    /\b(?:disposici[oó]n\s+(?:complementaria\s+)?(?:final|transitoria|modificatoria)|anexo|cap[ií]tulo|t[ií]tulo)\s+[^.\n]{0,160}/gi,
    0,
    40,
  );
  const validitySignals = extractRegexMatches(
    text,
    /\b(?:vigente|derogad[ao]s?|modificad[ao]s?|dej[ao]\s+sin\s+efecto|entr[ao]\s+en\s+vigencia|modifica(?:se)?|deroga(?:se)?)\b[^.\n]{0,180}/gi,
    0,
    40,
  );
  const relationPatterns: Array<[StructuredLegalMetadata["relations"][number]["relationType"], RegExp]> = [
    ["modifica", /\bmodifica(?:se)?\b[^.\n]{0,220}/gi],
    ["deroga", /\bderoga(?:se)?\b[^.\n]{0,220}/gi],
    ["reglamenta", /\breglamenta\b[^.\n]{0,220}/gi],
    ["complementa", /\bcomplementa\b[^.\n]{0,220}/gi],
    ["remite", /\b(?:remite|conforme\s+al|de\s+acuerdo\s+con)\b[^.\n]{0,220}/gi],
  ];
  const relations = relationPatterns.flatMap(([relationType, pattern]) =>
    extractRegexMatches(text, pattern, 0, 12).map((match) => ({
      relationType,
      text: normalizeText(match).slice(0, 260),
    })),
  );

  return {
    articles,
    dispositions,
    issuer: detectIssuer(text),
    numerals,
    processType: inferProcessTypeFromText(text.slice(0, 25000)),
    relations: uniqueLimited(relations.map((relation) => `${relation.relationType}|${relation.text}`), 50).map(
      (value) => {
        const [relationType, ...rest] = value.split("|");
        return {
          relationType: relationType as StructuredLegalMetadata["relations"][number]["relationType"],
          text: rest.join("|"),
        };
      },
    ),
    validitySignals,
  };
}

function inferProcessTypeFromText(text: string) {
  return inferProcedureType(text);
}

function processAliases(processType?: string | null) {
  return procedureAliases(processType);
}

function processAnchors(processType?: string | null) {
  return procedureAnchors(processType);
}

function sourceRole(documentType: string) {
  return documentType === "bases_integradas" ? "operativo" : "normativo";
}

function hierarchyRank(documentType: string) {
  const ranks: Record<string, number> = {
    ley: 4,
    reglamento: 3,
    directiva: 2,
    opinion: 1,
    resolucion: 1,
    bases_integradas: 0,
  };

  return ranks[documentType] ?? 0;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getInsightString(insights: AiDocumentInsights, key: keyof AiDocumentInsights) {
  const value = insights[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDocumentType(value: unknown) {
  const allowed = new Set([
    "ley",
    "reglamento",
    "opinion",
    "directiva",
    "bases_integradas",
    "resolucion",
    "contrato",
    "expediente",
    "otros",
  ]);

  return typeof value === "string" && allowed.has(value) ? value : undefined;
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return {};
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

async function analyzeDocumentWithAi(text: string): Promise<AiDocumentInsights> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Analiza este documento juridico para una biblioteca de contrataciones publicas.

Devuelve solo JSON valido, sin markdown, con estas claves:
{
  "documentType": "ley|reglamento|opinion|directiva|bases_integradas|resolucion|contrato|expediente|otros",
  "sourceEntity": "entidad emisora o null",
  "number": "numero de norma/documento o null",
  "year": 2026,
  "topic": "tema principal",
  "vigencia": "vigente|derogado|modificado|desconocida",
  "status": "vigente|derogado|modificado|desconocido",
  "summary": "resumen ejecutivo de 5 a 8 lineas",
  "keyPoints": ["punto clave"],
  "relatedArticles": ["articulo o numeral"],
  "practicalImpact": "impacto practico para el usuario",
  "amends": "si el documento modifica o deroga otra norma/articulos, indicalo brevemente (ej: 'modifica el articulo X del Reglamento DS 009-2025-EF'); si no, null",
  "confidence": "alta|media|baja"
}

Texto:
${text.slice(0, analysisTextLimit)}`,
          role: "user",
        },
      ],
      max_output_tokens: 1400,
      model: legalAnswerModel,
      temperature: 0,
    });
    const parsed = parseJsonObject(response.output_text);

    return {
      amends: typeof parsed.amends === "string" && parsed.amends.trim() ? parsed.amends.trim() : null,
      confidence:
        parsed.confidence === "alta" || parsed.confidence === "media" || parsed.confidence === "baja"
          ? parsed.confidence
          : "baja",
      documentType: normalizeDocumentType(parsed.documentType),
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.filter((item): item is string => typeof item === "string")
        : [],
      number: typeof parsed.number === "string" ? parsed.number : null,
      practicalImpact: typeof parsed.practicalImpact === "string" ? parsed.practicalImpact : undefined,
      relatedArticles: Array.isArray(parsed.relatedArticles)
        ? parsed.relatedArticles.filter((item): item is string => typeof item === "string")
        : [],
      sourceEntity: typeof parsed.sourceEntity === "string" ? parsed.sourceEntity : null,
      status: typeof parsed.status === "string" ? parsed.status : null,
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      topic: typeof parsed.topic === "string" ? parsed.topic : null,
      vigencia: typeof parsed.vigencia === "string" ? parsed.vigencia : null,
      year: typeof parsed.year === "number" && Number.isFinite(parsed.year) ? parsed.year : null,
    };
  } catch {
    return {
      confidence: "baja",
    };
  }
}

function getMaxChunksPerDocument() {
  const configured = process.env.PDF_MAX_CHUNKS_PER_DOCUMENT;

  if (!configured) {
    return null;
  }

  const value = Number.parseInt(configured, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function chunkPages(pages: Array<{ pageNumber: number; text: string }>) {
  const chunks: TextChunk[] = [];
  const maxChunksPerDocument = getMaxChunksPerDocument();
  let buffer = "";
  let bufferStart = 0;
  let bufferPageStart: number | null = null;
  let lastArticle: string | null = null;
  let lastSectionTitle: string | null = null;

  function pushChunk(content: string, start: number, end: number, pageStart: number | null, pageEnd: number | null) {
    const rawChunk = content.trim();

    if (rawChunk.length <= 80) {
      return;
    }

    const article = detectArticle(rawChunk) ?? lastArticle;
    const sectionTitle = detectSectionTitle(rawChunk) ?? lastSectionTitle;

    if (article) {
      lastArticle = article;
    }

    if (sectionTitle) {
      lastSectionTitle = sectionTitle;
    }

    chunks.push({
      article,
      content: rawChunk,
      end,
      index: chunks.length,
      pageEnd,
      pageStart,
      sectionTitle,
      start,
    });
  }

  for (const page of pages) {
    if (maxChunksPerDocument && chunks.length >= maxChunksPerDocument) {
      throw new Error(
        `El PDF requiere mas de ${maxChunksPerDocument} fragmentos para indexarse completo. Aumenta PDF_MAX_CHUNKS_PER_DOCUMENT o quita ese limite.`,
      );
    }

    const pageText = page.text.trim();

    if (!pageText) {
      continue;
    }

    if (!buffer) {
      bufferStart = page.pageNumber;
      bufferPageStart = page.pageNumber;
    }

    buffer = `${buffer}${buffer ? "\n\n" : ""}=== PAGINA ${page.pageNumber} ===\n${pageText}`;

    while (buffer.length >= chunkSize) {
      const splitAt = Math.max(
        buffer.lastIndexOf("\n\n", chunkSize),
        buffer.lastIndexOf(". ", chunkSize),
        chunkSize,
      );
      const chunkContent = buffer.slice(0, splitAt);
      pushChunk(chunkContent, bufferStart, page.pageNumber, bufferPageStart, page.pageNumber);
      buffer = buffer.slice(Math.max(0, splitAt - chunkOverlap)).trim();
      bufferStart = page.pageNumber;
      bufferPageStart = page.pageNumber;
    }
  }

  if (buffer.trim()) {
    const lastPage = pages.at(-1)?.pageNumber ?? null;
    pushChunk(buffer, bufferStart, lastPage ?? bufferStart, bufferPageStart, lastPage);
  }

  return chunks;
}

type ArticleSegment = {
  articleNumber: string;
  content: string;
  ordinal: number;
  pageEnd: number | null;
  pageStart: number | null;
  sectionTitle: string | null;
  title: string;
};

// Cabecera de articulo: "Articulo N" seguido de un delimitador de titulo
// (`.`, `-`, `º`, `°`, `)`). pdf-parse une el texto con espacios y pierde los
// saltos de linea, asi que no se puede anclar a inicio de linea; el delimitador
// posterior distingue una cabecera real de una referencia inline ("articulo 5
// de la ley"). El filtro monotonico adicional descarta referencias hacia atras.
const articleHeadingPattern = /\bart[ií]culo\s+(\d+[a-z-]*)\s*[.)\-º°]/gi;
const maxArticleContentLength = 24000;
// Salto maximo permitido entre numeros de articulo consecutivos para tratar una
// cabecera como real (y no como referencia interna a un articulo lejano).
const maxArticleForwardGap = 5;

// Segmenta el texto integro de la norma en articulos. Reusa la idea de
// `chunkPages` (concatena paginas, mapea offsets a paginas) y detecta cabeceras
// "Articulo N". Heuristica anti-falsos-positivos: solo abre un articulo nuevo si
// el numero es mayor al ultimo (o es un "bis": mismo numero con sufijo de
// letra), descartando referencias internas como "segun el articulo 5". Si la
// norma no tiene cabeceras de articulo (bases, contratos, resoluciones) devuelve
// una lista vacia.
function segmentArticlesFromPages(pages: Array<{ pageNumber: number; text: string }>): ArticleSegment[] {
  let tagged = "";
  const pageMarks: Array<{ offset: number; page: number }> = [];

  for (const page of pages) {
    const pageText = page.text.trim();

    if (!pageText) {
      continue;
    }

    pageMarks.push({ offset: tagged.length, page: page.pageNumber });
    tagged += `${tagged ? "\n" : ""}${pageText}\n`;
  }

  if (!tagged.trim()) {
    return [];
  }

  const heads: Array<{ index: number; number: string }> = [];
  let lastNumber = 0;
  articleHeadingPattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = articleHeadingPattern.exec(tagged)) !== null) {
    const raw = match[1];
    const baseNumber = Number.parseInt(raw, 10);

    if (!Number.isFinite(baseNumber)) {
      continue;
    }

    const hasLetterSuffix = /[a-z]/i.test(raw);

    // Solo abre un articulo nuevo si el numero CONTINUA la secuencia con un salto
    // pequeño (tolera algun encabezado perdido por la extraccion), o es un "bis".
    // Un salto grande hacia adelante (p. ej. estar en el art. 36 y ver "articulo
    // 157") es una REFERENCIA interna, no un encabezado: si se aceptara, subiria
    // lastNumber y descartaria todos los articulos reales intermedios.
    const isNextInSequence = baseNumber > lastNumber && baseNumber <= lastNumber + maxArticleForwardGap;
    const isBis = baseNumber === lastNumber && hasLetterSuffix;

    if (isNextInSequence || isBis) {
      const wordIndex = tagged.toLowerCase().indexOf("art", match.index);
      heads.push({ index: wordIndex >= 0 ? wordIndex : match.index, number: raw });
      lastNumber = baseNumber;
    }
  }

  if (heads.length === 0) {
    return [];
  }

  const pageAt = (offset: number) => {
    let page = pageMarks[0]?.page ?? 1;

    for (const mark of pageMarks) {
      if (mark.offset <= offset) {
        page = mark.page;
      } else {
        break;
      }
    }

    return page;
  };

  const articles: ArticleSegment[] = [];

  for (let index = 0; index < heads.length; index += 1) {
    const start = heads[index].index;
    const end = index + 1 < heads.length ? heads[index + 1].index : tagged.length;
    const content = normalizeText(tagged.slice(start, end)).slice(0, maxArticleContentLength);

    if (content.length < 30) {
      continue;
    }

    articles.push({
      articleNumber: heads[index].number,
      content,
      ordinal: articles.length,
      pageEnd: pageAt(Math.max(start, end - 1)),
      pageStart: pageAt(start),
      sectionTitle: detectSectionTitle(content),
      title: content.split("\n")[0].slice(0, 160),
    });
  }

  return articles;
}

// Chunking POR ARTICULO: usa los segmentos de articulo como unidad de fragmento
// (en vez de cortes por tamaño). Cada articulo coherente -> un embedding, con su
// numero/pagina exactos => mejor precision de recuperacion y citas limpias. Los
// articulos muy largos se sub-dividen en partes <= chunkSize conservando el
// numero de articulo y la seccion. Solo para normas con estructura de articulos;
// el resto (bases, resoluciones, contratos) sigue usando chunkPages.
function chunkByArticles(segments: ArticleSegment[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  const maxChunksPerDocument = getMaxChunksPerDocument();

  function push(content: string, segment: ArticleSegment) {
    const rawChunk = content.trim();
    if (rawChunk.length <= 80) {
      return;
    }
    if (maxChunksPerDocument && chunks.length >= maxChunksPerDocument) {
      throw new Error(
        `El PDF requiere mas de ${maxChunksPerDocument} fragmentos para indexarse completo. Aumenta PDF_MAX_CHUNKS_PER_DOCUMENT o quita ese limite.`,
      );
    }
    chunks.push({
      article: segment.articleNumber,
      content: rawChunk,
      end: 0,
      index: chunks.length,
      pageEnd: segment.pageEnd,
      pageStart: segment.pageStart,
      sectionTitle: segment.sectionTitle,
      start: 0,
    });
  }

  for (const segment of segments) {
    const content = segment.content.trim();

    // Articulo corto/medio: un solo fragmento.
    if (content.length <= Math.floor(chunkSize * 1.3)) {
      push(content, segment);
      continue;
    }

    // Articulo largo: sub-dividir por frontera de oracion, conservando el articulo.
    let offset = 0;
    while (offset < content.length) {
      const window = content.slice(offset, offset + chunkSize);
      let cut = window.length;
      if (offset + chunkSize < content.length) {
        const sentence = window.lastIndexOf(". ");
        const newline = window.lastIndexOf("\n");
        cut = Math.max(sentence, newline, Math.floor(chunkSize * 0.6));
      }
      push(content.slice(offset, offset + cut), segment);
      offset += Math.max(cut, Math.floor(chunkSize * 0.6));
    }
  }

  return chunks;
}

function buildEmbeddingText(input: {
  article: string | null;
  content: string;
  documentNumber?: string | null;
  documentType: string;
  pageEnd: number | null;
  pageStart: number | null;
  processType?: string | null;
  sectionTitle: string | null;
  sourceEntity?: string | null;
  title: string;
  topic?: string | null;
  vigencia?: string | null;
  year?: number | null;
}) {
  const processType = input.processType ? procedureLabel(input.processType) || input.processType : null;
  const header = [
    `Documento: ${input.title}`,
    `Tipo documental: ${input.documentType}`,
    input.documentNumber ? `Numero: ${input.documentNumber}` : null,
    input.sourceEntity ? `Entidad emisora: ${input.sourceEntity}` : null,
    input.year ? `Anio: ${input.year}` : null,
    input.vigencia ? `Vigencia: ${input.vigencia}` : null,
    input.topic ? `Tema: ${input.topic}` : null,
    processType ? `Tipo de proceso: ${processType}` : null,
    processType ? `Alias del proceso: ${processAliases(input.processType).join(", ")}` : null,
    processType ? `Anclas juridicas: ${processAnchors(input.processType).join("; ")}` : null,
    input.article ? `Articulo: ${input.article}` : null,
    input.sectionTitle ? `Seccion: ${input.sectionTitle}` : null,
    input.pageStart
      ? input.pageEnd && input.pageEnd !== input.pageStart
        ? `Paginas: ${input.pageStart}-${input.pageEnd}`
        : `Pagina: ${input.pageStart}`
      : null,
  ].filter(Boolean);

  return `${header.join("\n")}\n\nTexto juridico:\n${input.content}`;
}

function getOcrMaxPages() {
  const value = Number.parseInt(process.env.OPENAI_OCR_MAX_PAGES ?? "25", 10);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

function isOpenAiPdfOcrEnabled() {
  return process.env.OPENAI_PDF_OCR_ENABLED === "true";
}

function isUsableExtractedText(text: string) {
  const normalized = text.toLowerCase();
  return (
    text.length >= minExtractedTextLength &&
    !unusableOcrPatterns.some((pattern) => normalized.includes(pattern))
  );
}

// Devuelve los bytes del File en un Buffer con memoria PROPIA (copiada). Es
// imprescindible: `Buffer.from(arrayBuffer)` comparte memoria con el ArrayBuffer
// del File, y el pdf.js v1.10.100 que trae pdf-parse muta/transfiere ese buffer
// in situ durante el parseo, corrompiendolo de forma no determinista ("Invalid
// PDF structure" / "bad XRef entry" intermitentes). `Buffer.from(Uint8Array)`
// copia a un buffer del pool de Node, igual que readFileSync, y es estable.
async function readFileBytes(file: File) {
  return Buffer.from(new Uint8Array(await file.arrayBuffer()));
}

// Assets de pdfjs-dist (wasm/, standard_fonts/, cmaps/). pdf.js v5+ decodifica
// JBIG2 y JPX —las compresiones tipicas de PDFs ESCANEADOS— con modulos WASM;
// sin `wasmUrl` esas imagenes fallan ("JBig2Error: JBig2 failed to initialize")
// y las paginas se rasterizan EN BLANCO, con lo que el OCR no ve texto alguno.
// pdf.js exige que las rutas terminen en "/"; en Node las lee via fs.
async function getPdfjsAssetOptions(): Promise<Record<string, unknown>> {
  try {
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const nodeRequire = createRequire(import.meta.url);
    const distRoot = path.dirname(nodeRequire.resolve("pdfjs-dist/package.json"));
    const dir = (name: string) => `${path.join(distRoot, name)}/`;
    return {
      cMapPacked: true,
      cMapUrl: dir("cmaps"),
      iccUrl: dir("iccs"),
      standardFontDataUrl: dir("standard_fonts"),
      wasmUrl: dir("wasm"),
    };
  } catch (err) {
    console.warn(
      `[pdf] No se pudo resolver pdfjs-dist para wasmUrl (JBIG2/JPX pueden fallar): ${err instanceof Error ? err.message : err}`,
    );
    return {};
  }
}

// Rasteriza las primeras `maxPages` paginas del PDF a PNG (base64). Se usa para
// el OCR de escaneados: pasar el PDF como `input_file` hace que el modelo lo trate
// como "documento" y RECHACE transcribir escaneados ("no puedo extraer texto de
// documentos escaneados"); en cambio una imagen fuerza el OCR de vision real.
// pdfjs-dist (build legacy, sin worker) + @napi-rs/canvas corren en el runtime
// nodejs (ver serverExternalPackages en next.config.ts).
async function rasterizePdfPages(
  buffer: Buffer,
  maxPages: number,
  startPage = 1,
): Promise<{ pageNumber: number; base64: string }[]> {
  const pdfjs = await loadServerPdfJs();
  const { createCanvas } = await import("@napi-rs/canvas");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    ...(await getPdfjsAssetOptions()),
  });
  const doc = await loadingTask.promise;

  try {
    const count = Math.min(doc.numPages, startPage + maxPages - 1);
    const images: { pageNumber: number; base64: string }[] = [];
    for (let pageNumber = startPage; pageNumber <= count; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      // scale 3.0 ≈ 300dpi. Antes 2.0 (~200dpi): verificado con un escaneo
      // real de baja calidad que a 200dpi el OCR de visión leía bien una
      // corrida y solo fragmentos sueltos ("V°B°", "p", "FIRMA") en la
      // siguiente — misma imagen, mismo modelo, resultado inconsistente. A
      // 300dpi, dos corridas seguidas del mismo archivo salieron limpias
      // (23771 y 23154 caracteres). Imagen más grande = más tokens/costo por
      // página, pero un OCR que falla a medias es peor: deja campos vacíos
      // sin aviso y obliga a reintentar a ciegas.
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      images.push({ base64: canvas.toBuffer("image/png").toString("base64"), pageNumber });
      page.cleanup();
    }
    return images;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

// Instruccion de SISTEMA que fija el rol de "motor OCR". Es lo que evita que el
// modelo RECHACE transcribir documentos escaneados (sin esto, gpt-4o se niega de
// forma intermitente: "Lo siento, no puedo ayudar con eso"). Verificado: con esta
// instruccion el OCR de imagenes es estable (4/4 corridas, sin rechazos).
const ocrSystemInstruction =
  "Eres un motor de OCR (reconocimiento óptico de caracteres). Tu ÚNICA función es transcribir, carácter por carácter, el texto visible en la imagen que recibes. Son documentos administrativos de acceso público (resoluciones, oficios, ordenanzas, informes). SIEMPRE transcribes el texto tal como aparece, conservando títulos, números de documento (incluido 'N°'), artículos, numerales, fechas y nombres; nunca te niegas, nunca resumes y nunca agregas comentarios. Devuelves solo el texto transcrito.";

// Un rechazo del modelo es un texto corto que empieza con una disculpa/negativa.
const ocrRefusalPatterns = ["lo siento", "no puedo", "i'm sorry", "i can't", "i cannot"];
function looksLikeOcrRefusal(text: string) {
  const normalized = text.toLowerCase();
  return text.length < 100 && ocrRefusalPatterns.some((pattern) => normalized.includes(pattern));
}

// Umbral de "esta página salió mal" para reintentar, aparte del rechazo
// explícito. Verificado en vivo: una lectura de un INFORME de 3 páginas densas
// (varios párrafos, base legal, tabla) dio 7000+ caracteres en corridas buenas
// y solo 418 en una mala — sin que el modelo se disculpara ni rechazara nada,
// solo transcribió mucho menos de lo que había. Una página realmente casi en
// blanco (solo firma) también puede caer bajo este umbral y reintentar de
// más: es aceptable, el costo de un reintento de más es mínimo comparado con
// perder la mayoría del contenido en silencio.
const ocrSuspiciouslyShortLength = 150;
function looksLikeOcrFailure(text: string) {
  return looksLikeOcrRefusal(text) || text.length < ocrSuspiciouslyShortLength;
}

// OCR de una pagina ya rasterizada (imagen). Devuelve el texto transcrito.
// Reintenta si el modelo devuelve un rechazo O si transcribe sospechosamente
// poco (looksLikeOcrFailure) — la visión no es 100% determinista y una misma
// imagen puede leerse bien una vez y a medias otra; tras agotar reintentos
// devuelve lo último que haya salido, salvo que sea un rechazo puro, que se
// descarta para no envenenar el texto con la disculpa del modelo.
async function ocrPageImage(
  base64: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const openai = getOpenAIClient();
  const maxAttempts = 3;
  let lastText = "";
  // Los tokens se acumulan en TODOS los intentos (todos se facturan).
  let inputTokens = 0;
  let outputTokens = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await openai.responses.create({
      instructions: ocrSystemInstruction,
      input: [
        {
          content: [
            {
              detail: "high",
              image_url: `data:image/png;base64,${base64}`,
              type: "input_image",
            },
            {
              text: "Transcribe todo el texto visible en esta imagen tal como aparece.",
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: 4000,
      model: pdfOcrModel,
      temperature: 0,
    }, { timeout: 45_000, maxRetries: 0 });
    inputTokens += response.usage?.input_tokens ?? 0;
    outputTokens += response.usage?.output_tokens ?? 0;
    const attemptText = normalizeText(response.output_text ?? "");
    // Se conserva el intento MÁS LARGO visto hasta ahora (no siempre el
    // último): un reintento que sale igual de corto no debe pisar uno previo
    // que sí trajo algo de contenido.
    if (attemptText.length > lastText.length) lastText = attemptText;
    if (!looksLikeOcrFailure(attemptText)) {
      return { text: attemptText, inputTokens, outputTokens };
    }
  }
  return { text: looksLikeOcrRefusal(lastText) ? "" : lastText, inputTokens, outputTokens };
}

async function extractPdfTextWithOpenAI(file: File, pageCount: number, pageLimit?: number): Promise<ExtractedPdfText> {
  const maxPages = Math.min(getOcrMaxPages(), pageLimit ?? Infinity);
  const buffer = await readFileBytes(file);
  const images = await rasterizePdfPages(buffer, maxPages);

  if (images.length === 0) {
    return { extractionMethod: "openai-ocr", ocrPartial: false, pageCount, pages: [], text: "" };
  }

  // OCR por pagina con concurrencia acotada (mas fiable que una sola llamada con N
  // imagenes, que truncaria la salida en documentos largos).
  const concurrency = 3;
  const pages: Array<{ pageNumber: number; text: string }> = new Array(images.length);
  let inputTokens = 0;
  let outputTokens = 0;
  for (let start = 0; start < images.length; start += concurrency) {
    const batch = images.slice(start, start + concurrency);
    const results = await Promise.all(
      batch.map(async (image, offset) => ({
        index: start + offset,
        ocr: await ocrPageImage(image.base64),
        pageNumber: image.pageNumber,
      })),
    );
    for (const result of results) {
      pages[result.index] = { pageNumber: result.pageNumber, text: result.ocr.text };
      inputTokens += result.ocr.inputTokens;
      outputTokens += result.ocr.outputTokens;
    }
  }

  const text = normalizeText(
    pages.map((page) => `=== PAGINA ${page.pageNumber} ===\n${page.text}`).join("\n\n"),
  );

  return {
    extractionMethod: "openai-ocr",
    ocrPartial: Boolean(pageCount && pageCount > images.length),
    pageCount,
    pages,
    text,
    usage: { inputTokens, model: pdfOcrModel, outputTokens },
  };
}

// `forceOcr`: si el PDF no tiene texto seleccionable, recurre al OCR de OpenAI
// aunque OPENAI_PDF_OCR_ENABLED no esté activo. Pensado para la biblioteca de
// EXPEDIENTES ARCHIVADOS, donde lo habitual es subir documentos escaneados (sin
// capa de texto) y el OCR es el camino normal, no una excepción experimental.
export async function extractPdfText(
  file: File,
  options: { forceOcr?: boolean; ocrMaxPages?: number } = {},
): Promise<ExtractedPdfText> {
  const buffer = await readFileBytes(file);
  const pageTexts: Array<{ pageNumber: number; text: string }> = [];
  let pageNumber = 0;
  const pdf = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      pageNumber += 1;
      const textContent = await pageData.getTextContent({
        disableCombineTextItems: false,
        normalizeWhitespace: false,
      });
      const text = normalizeText(
        textContent.items
          .map((item: { str?: string }) => item.str ?? "")
          .join(" "),
      );
      pageTexts.push({
        pageNumber,
        text,
      });
      return text;
    },
  });
  const text = normalizeText(pdf.text);

  if (text.length >= minExtractedTextLength) {
    return {
      extractionMethod: "pdf-text",
      ocrPartial: false,
      pageCount: pdf.numpages,
      pages:
        pageTexts.length > 0
          ? pageTexts
          : [
              {
                pageNumber: 1,
                text,
              },
            ],
      text,
    };
  }

  if (!options.forceOcr && !isOpenAiPdfOcrEnabled()) {
    throw new Error(
      "El PDF no tiene texto seleccionable. Convierte el archivo con OCR o sube una version con texto antes de indexarlo.",
    );
  }

  return extractPdfTextWithOpenAI(file, pdf.numpages, options.ocrMaxPages);
}

// Extrae solo el texto plano de un PDF (para analisis sin indexar). Reusa el
// extractor con el fix de buffer y el OCR opcional.
export async function extractPdfPlainText(
  file: File,
  options: { forceOcr?: boolean; ocrMaxPages?: number } = {},
): Promise<{ pageCount: number; text: string }> {
  const extracted = await extractPdfText(file, options);
  return { pageCount: extracted.pageCount, text: extracted.text };
}

// Igual que extractPdfPlainText pero con MARCADORES DE PÁGINA ("=== PÁGINA N ===")
// intercalados, para que la revisión de EETT/TDR pueda citar en qué PÁGINA está
// cada apartado. Funciona tanto con texto seleccionable como con OCR.
export async function extractPdfPagedText(
  file: File,
  options: { forceOcr?: boolean; ocrMaxPages?: number } = {},
): Promise<{ pageCount: number; text: string }> {
  const extracted = await extractPdfText(file, options);
  const text =
    extracted.pages.length > 0
      ? extracted.pages.map((p) => `=== PÁGINA ${p.pageNumber} ===\n${p.text}`).join("\n\n")
      : extracted.text;
  return { pageCount: extracted.pageCount, text };
}

async function createProcessingJob(documentId: string) {
  try {
    const [job] = await supabaseRest<ProcessingJobRecord[]>("processing_jobs", {
      body: JSON.stringify({
        document_id: documentId,
        job_type: "index_document",
        metadata: {},
        started_at: new Date().toISOString(),
        status: "processing",
      }),
      method: "POST",
    });

    return job.id;
  } catch {
    return null;
  }
}

async function updateProcessingJob(
  jobId: string | null,
  input: { errorMessage?: string; metadata?: Record<string, unknown>; status: "completed" | "error" },
) {
  if (!jobId) {
    return;
  }

  await supabaseRest(`processing_jobs?id=eq.${jobId}`, {
    body: JSON.stringify({
      completed_at: new Date().toISOString(),
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      status: input.status,
    }),
    method: "PATCH",
  }).catch(() => undefined);
}

async function insertChunksInBatches(chunkRows: ChunkInsert[]) {
  const insertedChunks: Array<ChunkInsert & { id: string; pinecone_vector_id: string }> = [];

  for (let index = 0; index < chunkRows.length; index += chunkInsertBatchSize) {
    const batch = chunkRows.slice(index, index + chunkInsertBatchSize);
    const inserted = await supabaseRest<Array<ChunkInsert & { id: string; pinecone_vector_id: string }>>(
      "document_chunks",
      {
        body: JSON.stringify(batch),
        method: "POST",
      },
    );

    insertedChunks.push(...inserted);
  }

  return insertedChunks;
}

type InsertedArticle = { id: string; article_number: string; content: string };

const refTypeToDocumentType: Record<RefType, string | null> = {
  ley: "ley",
  reglamento: "reglamento",
  decreto: "reglamento",
  directiva: "directiva",
  opinion: "opinion",
  interno: null,
};

function classifyNormRelation(rawText: string): string {
  const text = normalizeComparable(rawText);

  if (text.includes("modifica")) return "modifica";
  if (text.includes("deroga") || text.includes("deja sin efecto")) return "deroga";
  if (text.includes("reglamenta")) return "reglamenta";
  if (text.includes("complementa")) return "complementa";
  if (text.includes("conforme") || text.includes("de acuerdo") || text.includes("remite")) return "remite";

  return "concordancia";
}

// Detecta referencias cruzadas en los articulos, las resuelve contra el corpus
// indexado (norma/articulo destino) y las persiste en norma_concordancias. Las
// referencias a normas no indexadas quedan como externas (resolved=false).
async function persistConcordancias(documentId: string, articles: InsertedArticle[]) {
  await supabaseRest(`norma_concordancias?source_document_id=eq.${documentId}`, {
    method: "DELETE",
  }).catch(() => undefined);

  if (articles.length === 0) {
    return;
  }

  const corpus = await supabaseRest<
    Array<{ id: string; document_type: string; metadata: Record<string, unknown> }>
  >("documents?status=eq.indexed&select=id,document_type,metadata").catch(() => []);

  const docByNumber = new Map<string, string>();
  const docByType = new Map<string, string>();
  for (const doc of corpus) {
    const number =
      getMetadataString(doc.metadata, "documentNumber") ?? getMetadataString(doc.metadata, "number");
    if (number) {
      docByNumber.set(normalizeNormNumber(number), doc.id);
    }
    if (!docByType.has(doc.document_type)) {
      docByType.set(doc.document_type, doc.id);
    }
  }

  const thisDocArticles = new Map<string, string>();
  for (const article of articles) {
    thisDocArticles.set(article.article_number, article.id);
  }

  type ConcordanciaRow = {
    raw_text: string;
    relation_type: string;
    ref_article_number: string | null;
    ref_document_number: string | null;
    ref_type: RefType;
    resolved: boolean;
    source_article_id: string;
    source_article_number: string;
    source_document_id: string;
    target_article_id: string | null;
    target_document_id: string | null;
  };

  const rows: ConcordanciaRow[] = [];
  const targetArticleLookups = new Set<string>();

  for (const article of articles) {
    for (const citation of detectCitations(article.content)) {
      let targetDocId: string | undefined;

      if (citation.refDocumentNumber) {
        targetDocId = docByNumber.get(normalizeNormNumber(citation.refDocumentNumber));
      }

      if (!targetDocId) {
        const mappedType = refTypeToDocumentType[citation.refType];
        targetDocId = mappedType ? docByType.get(mappedType) : undefined;
      }

      if (targetDocId && citation.refArticleNumber) {
        targetArticleLookups.add(`${targetDocId}|${citation.refArticleNumber}`);
      }

      rows.push({
        raw_text: citation.rawText,
        relation_type: classifyNormRelation(citation.rawText),
        ref_article_number: citation.refArticleNumber,
        ref_document_number: citation.refDocumentNumber,
        ref_type: citation.refType,
        resolved: Boolean(targetDocId),
        source_article_id: article.id,
        source_article_number: article.article_number,
        source_document_id: documentId,
        target_article_id: null,
        target_document_id: targetDocId ?? null,
      });
    }

    for (const number of extractArticleMentions(article.content)) {
      if (number === article.article_number) {
        continue;
      }

      const targetArticleId = thisDocArticles.get(number);

      if (!targetArticleId) {
        continue;
      }

      rows.push({
        raw_text: `articulo ${number}`,
        relation_type: "concordancia",
        ref_article_number: number,
        ref_document_number: null,
        ref_type: "interno",
        resolved: true,
        source_article_id: article.id,
        source_article_number: article.article_number,
        source_document_id: documentId,
        target_article_id: targetArticleId,
        target_document_id: documentId,
      });
    }
  }

  if (targetArticleLookups.size > 0) {
    const docIds = Array.from(new Set(Array.from(targetArticleLookups).map((key) => key.split("|")[0])));
    const targetArticles = await supabaseRest<
      Array<{ id: string; document_id: string; article_number: string }>
    >(
      `norma_articulos?document_id=in.(${docIds.map((id) => `"${id}"`).join(",")})&select=id,document_id,article_number`,
    ).catch(() => []);
    const articleIdByKey = new Map<string, string>();
    for (const target of targetArticles) {
      articleIdByKey.set(`${target.document_id}|${target.article_number}`, target.id);
    }
    for (const row of rows) {
      if (row.ref_type !== "interno" && row.target_document_id && row.ref_article_number) {
        row.target_article_id =
          articleIdByKey.get(`${row.target_document_id}|${row.ref_article_number}`) ?? null;
      }
    }
  }

  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = `${row.source_article_id}|${row.ref_type}|${row.ref_document_number ?? ""}|${row.ref_article_number ?? ""}|${row.target_document_id ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  for (let index = 0; index < deduped.length; index += chunkInsertBatchSize) {
    await supabaseRest("norma_concordancias", {
      body: JSON.stringify(deduped.slice(index, index + chunkInsertBatchSize)),
      method: "POST",
    }).catch(() => undefined);
  }
}

export async function processPdfForSearch(document: DocumentRecord, file: File) {
  const jobId = await createProcessingJob(document.id);
  let insertedVectorIds: string[] = [];

  await supabaseRest(`documents?id=eq.${document.id}`, {
    body: JSON.stringify({
      error_message: null,
      status: "processing",
    }),
    method: "PATCH",
  });

  try {
    const extracted = await extractPdfText(file);
    const text = extracted.text;

    if (!isUsableExtractedText(text)) {
      throw new Error(
        extracted.extractionMethod === "openai-ocr"
          ? "El OCR experimental no devolvio texto juridico util. Convierte el PDF con OCR antes de subirlo."
          : "No se pudo extraer texto suficiente del PDF. El archivo parece escaneado o no legible.",
      );
    }

    const articleSegments = segmentArticlesFromPages(extracted.pages);
    // Chunking por articulo SOLO si la estructura de articulos cubre la mayor
    // parte del texto (leyes, reglamentos, directivas). Si los "articulos" son
    // pocos y cubren poco (p. ej. Bases con 3 numerales en 59 paginas), se usa el
    // corte por tamaño para no perder contenido.
    const articleCoverage = articleSegments.reduce((sum, segment) => sum + segment.content.length, 0);
    const useArticleChunks =
      articleSegments.length >= 3 && text.length > 0 && articleCoverage >= text.length * 0.5;
    const chunks = useArticleChunks ? chunkByArticles(articleSegments) : chunkPages(extracted.pages);
    const structured = extractStructuredLegalMetadata(text);
    const insights = await analyzeDocumentWithAi(text);
    const userDocumentType = document.document_type;
    const documentType =
      userDocumentType && userDocumentType !== "otros"
        ? userDocumentType
        : normalizeDocumentType(insights.documentType) ?? userDocumentType;
    const sourceEntity = document.source_entity ?? insights.sourceEntity ?? structured.issuer ?? null;
    const contentHash = hashText(text);
    const pineconeConfig = getPineconeConfig();
    const detectedNumber = detectDocumentNumber(document.title, text, documentType);
    // En opiniones la IA suele capturar una norma referenciada (p. ej. "Ley
    // 27269") en vez del numero de la propia opinion; por eso aqui la deteccion
    // deterministica (que lee el numero del titulo/encabezado) tiene prioridad.
    const documentNumber =
      documentType === "opinion"
        ? detectedNumber ??
          getInsightString(insights, "number") ??
          getMetadataString(document.metadata, "number")
        : getInsightString(insights, "number") ??
          getMetadataString(document.metadata, "number") ??
          detectedNumber;
    // scopeProcessType garantiza que Ley/Reglamento queden en "todos" y las
    // Opiniones en general, sin que la inferencia de IA pueda sobrescribirlo.
    const processType = scopeProcessType(
      documentType,
      document.process_type ??
        getMetadataString(document.metadata, "processType") ??
        getMetadataString(document.metadata, "process_type") ??
        inferProcessTypeFromText(`${document.title}\n${text.slice(0, 12000)}`) ??
        structured.processType ??
        null,
    );
    const enrichedMetadata = {
      ...document.metadata,
      ai: {
        classificationConfidence: insights.confidence ?? "baja",
        suggestedDocumentType: insights.documentType ?? null,
        suggestedSourceEntity: insights.sourceEntity ?? null,
      },
      // El cambio declarado por el usuario al subir tiene prioridad sobre la IA.
      amends: getMetadataString(document.metadata, "amends") ?? insights.amends ?? null,
      articleCount: articleSegments.length,
      detectedArticles: structured.articles,
      detectedDispositions: structured.dispositions,
      detectedIssuer: structured.issuer,
      detectedNumerals: structured.numerals,
      detectedRelations: structured.relations,
      detectedValiditySignals: structured.validitySignals,
      documentNumber,
      chunkCount: chunks.length,
      chunkInsertBatchSize,
      contentHash,
      extractionMethod: extracted.extractionMethod,
      embeddingTextStrategy: "legal-context-header-plus-page-chunk",
      hierarchyRank: hierarchyRank(documentType),
      // OCR parcial (PDF escaneado con mas paginas que el tope OPENAI_OCR_MAX_PAGES)
      // dejaba indexedTextComplete=true: el documento entraba al corpus RAG como si
      // estuviera completo cuando solo se habian indexado las primeras paginas. El
      // flag debe reflejar si el texto indexado cubre todo el documento.
      indexedTextComplete: !extracted.ocrPartial,
      indexingPipelineVersion,
      maxChunksPerDocument: getMaxChunksPerDocument() ?? "unlimited",
      number: documentNumber,
      ocrMaxPages: getOcrMaxPages(),
      ocrPartial: extracted.ocrPartial,
      pageCount: extracted.pageCount,
      practicalImpact: insights.practicalImpact ?? getMetadataString(document.metadata, "practicalImpact"),
      processAliases: processAliases(processType),
      processAnchors: processAnchors(processType),
      processType,
      relatedArticles: insights.relatedArticles ?? [],
      structuredExtractionVersion: "legal-structure-v1",
      sourceRole: sourceRole(documentType),
      status: insights.status ?? getMetadataString(document.metadata, "status"),
      summary: insights.summary ?? getMetadataString(document.metadata, "summary"),
      textLength: text.length,
      topic: insights.topic ?? getMetadataString(document.metadata, "topic"),
      vigencia: insights.vigencia ?? getMetadataString(document.metadata, "vigencia"),
      year: insights.year ?? getMetadataNumber(document.metadata, "year"),
    };

    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const chunkRows: ChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      document_id: document.id,
      metadata: {
        article: chunk.article,
        documentNumber,
        documentType,
        extractionMethod: extracted.extractionMethod,
        hierarchyRank: hierarchyRank(documentType),
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
        ocrPartial: extracted.ocrPartial,
        pageCount: extracted.pageCount,
        processAliases: processAliases(processType),
        processAnchors: processAnchors(processType),
        processType,
        sectionTitle: chunk.sectionTitle,
        sourceRole: sourceRole(documentType),
      },
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
      pinecone_vector_id: `${document.id}::${chunk.index}`,
    }));

    const insertedChunks = await insertChunksInBatches(chunkRows);

    // Capa estructurada por articulo (navegacion tipo vLex). Es independiente de
    // Pinecone: solo vive en Postgres para lectura/navegacion estructurada.
    await supabaseRest(`norma_articulos?document_id=eq.${document.id}`, {
      method: "DELETE",
    }).catch(() => undefined);

    const insertedArticles: InsertedArticle[] = [];

    if (articleSegments.length > 0) {
      const articleRows = articleSegments.map((article) => ({
        article_label: article.title,
        article_number: article.articleNumber,
        content: article.content,
        document_id: document.id,
        document_number: documentNumber,
        document_type: documentType,
        hierarchy_rank: hierarchyRank(documentType),
        metadata: { extractionMethod: extracted.extractionMethod },
        ordinal: article.ordinal,
        page_end: article.pageEnd,
        page_start: article.pageStart,
        process_type: processType,
        section_title: article.sectionTitle,
        status: getMetadataString(enrichedMetadata, "status") ?? document.status,
        vigencia: getMetadataString(enrichedMetadata, "vigencia"),
        year: getMetadataNumber(enrichedMetadata, "year"),
      }));

      for (let index = 0; index < articleRows.length; index += chunkInsertBatchSize) {
        const inserted = await supabaseRest<InsertedArticle[]>("norma_articulos", {
          body: JSON.stringify(articleRows.slice(index, index + chunkInsertBatchSize)),
          method: "POST",
        });
        insertedArticles.push(...inserted);
      }
    }

    // Citador/concordancias: detecta y enlaza referencias cruzadas entre normas.
    await persistConcordancias(document.id, insertedArticles).catch(() => undefined);

    const pineconeRecords = insertedChunks.map((chunk) => ({
      _id: chunk.pinecone_vector_id,
      article:
        typeof chunk.metadata.article === "string" && chunk.metadata.article
          ? chunk.metadata.article
          : undefined,
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      document_id: document.id,
      document_type: documentType,
      page_end: chunk.page_end ?? undefined,
      page_start: chunk.page_start ?? undefined,
      source_entity: sourceEntity ?? undefined,
      source_role: sourceRole(documentType),
      status: getMetadataString(enrichedMetadata, "status") ?? document.status,
      text: buildEmbeddingText({
        article:
          typeof chunk.metadata.article === "string" && chunk.metadata.article
            ? chunk.metadata.article
            : null,
        content: chunk.content,
        documentNumber,
        documentType,
        pageEnd: chunk.page_end,
        pageStart: chunk.page_start,
        processType,
        sectionTitle:
          typeof chunk.metadata.sectionTitle === "string"
            ? chunk.metadata.sectionTitle
            : null,
        sourceEntity,
        title: document.title,
        topic: getMetadataString(enrichedMetadata, "topic"),
        vigencia: getMetadataString(enrichedMetadata, "vigencia"),
        year: getMetadataNumber(enrichedMetadata, "year"),
      }),
      title: document.title,
      process_type: processType ?? undefined,
      section_title:
        typeof chunk.metadata.sectionTitle === "string"
          ? chunk.metadata.sectionTitle
          : undefined,
      hierarchy_rank: hierarchyRank(documentType),
      document_number: documentNumber ?? undefined,
      topic: getMetadataString(enrichedMetadata, "topic"),
      vigencia: getMetadataString(enrichedMetadata, "vigencia"),
      year: getMetadataNumber(enrichedMetadata, "year"),
    }));
    insertedVectorIds = pineconeRecords.map((record) => record._id);

    const pineconeUpsert = await upsertTextRecords(pineconeRecords);
    const pineconeVerification = await verifyDocumentIndexedInPinecone({
      documentId: document.id,
      expectedMinRecords: pineconeRecords.length,
      query: [
        document.title,
        documentNumber,
        documentType,
        processType ? procedureLabel(processType) || processType : null,
        getMetadataString(enrichedMetadata, "topic"),
      ]
        .filter(Boolean)
        .join(" "),
    });

    if (insights.summary) {
      await supabaseRest(`document_summaries?document_id=eq.${document.id}&summary_type=eq.executive`, {
        method: "DELETE",
      }).catch(() => undefined);
      await supabaseRest("document_summaries", {
        body: JSON.stringify({
          content: insights.summary,
          document_id: document.id,
          metadata: {
            keyPoints: insights.keyPoints ?? [],
            practicalImpact: insights.practicalImpact ?? null,
            relatedArticles: insights.relatedArticles ?? [],
            topic: insights.topic ?? null,
          },
          model: legalAnswerModel,
          summary_type: "executive",
        }),
        method: "POST",
      }).catch(() => undefined);
    }

    const [updated] = await supabaseRest<DocumentRecord[]>(`documents?id=eq.${document.id}`, {
      body: JSON.stringify({
        document_type: documentType,
        metadata: {
          ...enrichedMetadata,
          pinecone: {
            batches: pineconeUpsert?.batches ?? null,
            namespace: pineconeConfig.namespace,
            recordCount: pineconeRecords.length,
            upserted: pineconeUpsert?.upserted ?? pineconeRecords.length,
            verification: pineconeVerification,
          },
        },
        process_type: processType,
        source_entity: sourceEntity,
        status: "indexed",
      }),
      method: "PATCH",
    });
    // Boletin de novedades (Fase 4): emite eventos del feed al indexar.
    await supabaseRest(`boletin_eventos?document_id=eq.${document.id}`, { method: "DELETE" }).catch(
      () => undefined,
    );
    const boletinBase = {
      document_id: document.id,
      document_type: documentType,
      process_type: processType,
      source_entity: sourceEntity,
      summary: getMetadataString(enrichedMetadata, "summary")?.slice(0, 400) ?? null,
      title: document.title,
      topic: getMetadataString(enrichedMetadata, "topic") ?? null,
    };
    const boletinEvents: Array<Record<string, unknown>> = [
      { ...boletinBase, event_type: "documento_nuevo" },
    ];
    const amends = getMetadataString(enrichedMetadata, "amends");
    if (amends) {
      boletinEvents.push({ ...boletinBase, event_type: "modificatoria", summary: amends.slice(0, 400) });
    }
    const vigencia = (getMetadataString(enrichedMetadata, "vigencia") ?? "").toLowerCase();
    if (vigencia.includes("derog") || vigencia.includes("modific")) {
      boletinEvents.push({ ...boletinBase, event_type: "vigencia", summary: `Vigencia: ${vigencia}` });
    }
    await supabaseRest("boletin_eventos", {
      body: JSON.stringify(boletinEvents),
      method: "POST",
    }).catch(() => undefined);

    await updateProcessingJob(jobId, {
      metadata: {
        chunkCount: chunks.length,
        chunkInsertBatchSize,
        contentHash,
        extractionMethod: extracted.extractionMethod,
        indexedTextComplete: !extracted.ocrPartial,
        indexingPipelineVersion,
        pageCount: extracted.pageCount,
        pinecone: {
          batches: pineconeUpsert?.batches ?? null,
          namespace: pineconeConfig.namespace,
          recordCount: pineconeRecords.length,
          upserted: pineconeUpsert?.upserted ?? pineconeRecords.length,
          verification: pineconeVerification,
        },
        textLength: text.length,
      },
      status: "completed",
    });

    return {
      chunkCount: chunks.length,
      document: updated,
      pageCount: extracted.pageCount,
      textLength: text.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error procesando PDF";

    await deleteRecords(insertedVectorIds).catch(() => undefined);
    await supabaseRest(`document_chunks?document_id=eq.${document.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
    await supabaseRest(`norma_articulos?document_id=eq.${document.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
    await supabaseRest(`norma_concordancias?source_document_id=eq.${document.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
    await supabaseRest(`document_summaries?document_id=eq.${document.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
    await supabaseRest(`documents?id=eq.${document.id}`, {
      body: JSON.stringify({
        error_message: errorMessage,
        status: "error",
      }),
      method: "PATCH",
    });
    await updateProcessingJob(jobId, {
      errorMessage,
      status: "error",
    });

    throw error;
  }
}

/** One resumable OCR block; page numbers refer to the original PDF. */
export async function extractPdfOcrBlock(file: File, startPage: number): Promise<ExtractedPdfText> {
  const buffer = await readFileBytes(file);
  const info = await pdfParse(Buffer.from(buffer));
  const images = await rasterizePdfPages(buffer, 3, startPage);
  const outputs = await Promise.all(images.map(async (image) => ({ ...await ocrPageImage(image.base64), pageNumber: image.pageNumber })));
  const pages = outputs.map(({ pageNumber, text }) => ({ pageNumber, text }));
  return { extractionMethod: "openai-ocr", pageCount: info.numpages, ocrPartial: startPage + pages.length - 1 < info.numpages, pages,
    text: pages.map(p => `=== PAGINA ${p.pageNumber} ===\n${p.text}`).join("\n\n"),
    usage: { model: pdfOcrModel, inputTokens: outputs.reduce((sum, p) => sum + p.inputTokens, 0), outputTokens: outputs.reduce((sum, p) => sum + p.outputTokens, 0) } };
}
