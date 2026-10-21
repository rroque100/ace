"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Check,
  Clipboard,
  CopyCheck,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Pin,
  Quote,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import {
  ANSWERABLE_DOCUMENT_TYPE_OPTIONS,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { SaveButton } from "./save-button";
import { processLabelFromOptions, useSettingsCatalog, withBlankProcessOption } from "./use-settings-catalog";

type ChatSource = {
  article: string | null;
  sectionTitle?: string | null;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  sourceEntity: string | null;
  processType: string | null;
  chunkIndex: number;
  pageEnd: number | null;
  pageStart: number | null;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  evidenceQuality: number;
  matchType: "semantica" | "lexical" | "hibrida";
  excerpt: string;
  topic: string | null;
  status: string | null;
  vigencia: string | null;
  year: number | null;
  citation: string;
};

type ChatAssessment = {
  coverage?: {
    bases: boolean;
    directiva: boolean;
    ley: boolean;
    opinion: boolean;
    reglamento: boolean;
  };
  evidenceQuality: number;
  evidenceWarnings?: string[];
  lexicalScore: number;
  queryUsed?: string;
  reason: string;
  scope?: "legal" | "off_topic" | "unknown";
  sufficient?: boolean;
  topScore: number;
  uniqueDocuments: number;
};

type Confidence = "alta" | "media" | "baja";

// Eventos NDJSON que emite POST /api/chat.
type StreamEvent =
  | { type: "meta"; sources: ChatSource[]; assessment: ChatAssessment; confidence: Confidence }
  | { type: "delta"; text: string }
  | {
      type: "done";
      sessionId: string | null;
      messageId: string | null;
      model: string;
      citationWarnings?: string[];
    }
  | { type: "error"; error: string };

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  assessment?: ChatAssessment;
  confidence?: Confidence;
  citationWarnings?: string[];
  mode?: string;
  note?: string;
  persistedId?: string | null;
  questionText?: string;
  sources?: ChatSource[];
  feedback?: "correct" | "incorrect";
  streaming?: boolean;
  error?: string;
};

const toneOptions = [
  { hint: "Cercano y didáctico: claro, con ejemplos y orientación práctica.", label: "Cercano", value: "didactico" },
  { hint: "Asesoría legal formal: preciso, sobrio y con terminología jurídica.", label: "Formal", value: "formal" },
  { hint: "Técnico-preciso: denso en reglas y datos, para especialistas.", label: "Técnico", value: "tecnico" },
] as const;

const lengthOptions = [
  { hint: "Muy breve: solo lo esencial, 1-2 párrafos.", label: "Concisa", value: "concisa" },
  { hint: "Equilibrada: directa + explicación útil.", label: "Media", value: "media" },
  { hint: "Desarrollo a fondo: contexto, condiciones y práctica.", label: "Detallada", value: "detallada" },
] as const;

const exampleQuestions = [
  "¿Cuáles son los requisitos para una compra por comparación de precios?",
  "¿Cómo revisar si están bien hechas las especificaciones técnicas de subasta inversa electrónica?",
  "¿Qué garantías y cláusulas obligatorias debe incluir un contrato?",
];

const followUpPrompts = [
  "Convierte la respuesta en checklist operativo.",
  "Amplía el fundamento legal con las mismas fuentes.",
  "Señala limitaciones y puntos que requieren revisión humana.",
];

function followUpsFor(message: ConversationMessage) {
  if (message.confidence === "baja") {
    return [
      "Indica qué fuente falta para responder con confianza.",
      "Formula una búsqueda para encontrar el artículo exacto.",
      "Señala qué documentos debo cargar o reindexar.",
    ];
  }

  return followUpPrompts;
}

const documentTypes = [{ label: "Todos", value: "" }, ...ANSWERABLE_DOCUMENT_TYPE_OPTIONS];

function groupSourcesByDocument(sources: ChatSource[]) {
  const grouped = new Map<string, { document: ChatSource; sources: ChatSource[] }>();

  for (const source of sources) {
    const existing = grouped.get(source.documentId);

    if (existing) {
      existing.sources.push(source);
    } else {
      grouped.set(source.documentId, { document: source, sources: [source] });
    }
  }

  return Array.from(grouped.values());
}

function confidenceClasses(confidence?: Confidence) {
  if (confidence === "alta") {
    return "confidencePill high";
  }

  if (confidence === "media") {
    return "confidencePill medium";
  }

  return "confidencePill low";
}

function confidenceMeaning(confidence?: Confidence) {
  if (confidence === "alta") {
    return "Alta: hay evidencia normativa suficiente, buena coincidencia con la pregunta y referencias trazables por página o artículo.";
  }

  if (confidence === "media") {
    return "Media: la respuesta está sustentada, pero requiere revisión porque la coincidencia o la cobertura normativa no es completa.";
  }

  return "Baja: no usar como conclusión jurídica; faltan fuentes suficientes, trazabilidad precisa o coincidencia fuerte con la pregunta.";
}

function answerUseLabel(confidence?: Confidence, sufficient?: boolean) {
  if (confidence === "alta" && sufficient !== false) {
    return {
      detail: "Apta como borrador sustentado; revisa las citas antes de usarla formalmente.",
      label: "Usable con revisión",
      tone: "ok",
    };
  }

  if (confidence === "media" && sufficient !== false) {
    return {
      detail: "Úsala como orientación; confirma artículo, página y vigencia.",
      label: "Requiere verificación",
      tone: "warn",
    };
  }

  return {
    detail: "No la uses como conclusión jurídica hasta completar fuentes normativas.",
    label: "No concluyente",
    tone: "bad",
  };
}

function documentPdfUrl(source: Pick<ChatSource, "documentId" | "pageStart">) {
  return `/api/documents/${source.documentId}${source.pageStart ? `#page=${source.pageStart}` : ""}`;
}

function buildSearchUrl(message: ConversationMessage, filters: Record<string, string>) {
  const params = new URLSearchParams();
  const query = message.questionText ?? message.content;

  if (query) {
    params.set("q", query);
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/busqueda?${params.toString()}`;
}

function sourcePrecisionLabel(source: Pick<ChatSource, "article" | "pageStart">) {
  if (source.article && source.pageStart) {
    return `Referencia precisa: artículo ${source.article}, página ${source.pageStart}`;
  }

  if (source.article) {
    return `Referencia por artículo ${source.article}`;
  }

  if (source.pageStart) {
    return `Referencia por página ${source.pageStart}`;
  }

  return "Referencia aproximada: página/artículo no identificado";
}

function buildMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Una cita abierta desde un párrafo: conserva el texto del párrafo para poder
// mostrar en el modal solo la porción de la fuente que respalda esa afirmación.
type SourceReference = { number: number; source: ChatSource; paragraphText: string };

// Palabras vacías + términos de dominio omnipresentes (no discriminan el párrafo).
const SNIPPET_STOPWORDS = new Set([
  "para", "como", "esta", "este", "estos", "estas", "entre", "cuando", "todo", "tambien",
  "segun", "debe", "deben", "puede", "pueden", "sera", "seran", "sus", "del", "los", "las",
  "una", "uno", "unos", "unas", "sobre", "porque", "donde", "cada", "ante", "desde", "hasta",
  "articulo", "articulos", "inciso", "numeral", "literal", "ley", "reglamento", "norma", "normas",
  "publica", "publicas", "publico", "publicos", "estado", "entidad", "entidades", "contratacion",
  "contrataciones", "presente", "respectiva", "respectivo", "correspondiente", "siguiente",
  "pagina", "documento", "fuente", "respuesta", "fragmento",
]);

function snippetTokens(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !SNIPPET_STOPWORDS.has(token));
}

function normalizeWord(word: string) {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/===\s*PAGINA\s*\d+\s*===/gi, " ")
    .split(/(?<=[.;:])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

// Encuentra dentro del fragmento de la fuente la ventana de 1-2 oraciones con
// mayor solape léxico con el párrafo de la respuesta.
function relevantSnippet(excerpt: string, paragraph: string) {
  const queryTokens = new Set(snippetTokens(paragraph));
  const sentences = splitIntoSentences(excerpt);

  if (queryTokens.size === 0 || sentences.length === 0) {
    return { snippet: excerpt.trim().slice(0, 420), matched: new Set<string>(), hits: 0 };
  }

  const perSentence = sentences.map((sentence) => {
    const matched = new Set<string>();
    for (const token of snippetTokens(sentence)) {
      if (queryTokens.has(token)) {
        matched.add(token);
      }
    }
    return { matched, hits: matched.size };
  });

  let best = { start: 0, end: 1, hits: -1, matched: new Set<string>() };
  for (let i = 0; i < sentences.length; i += 1) {
    const matched = new Set<string>();
    for (let j = i; j < Math.min(i + 2, sentences.length); j += 1) {
      for (const token of perSentence[j].matched) {
        matched.add(token);
      }
      if (matched.size > best.hits) {
        best = { start: i, end: j + 1, hits: matched.size, matched: new Set(matched) };
      }
    }
  }

  return {
    snippet: sentences.slice(best.start, best.end).join(" "),
    matched: best.matched,
    hits: best.hits,
  };
}

function HighlightedSnippet({ text, matched }: { text: string; matched: Set<string> }) {
  if (matched.size === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {text.split(/(\s+)/).map((part, index) =>
        matched.has(normalizeWord(part)) ? (
          <mark key={`${part}-${index}`}>{part}</mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function isTableRow(line: string) {
  return /^\|(.+)\|$/.test(line.trim());
}

function isTableSeparator(line: string) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderFormattedText(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|<u>.*?<\/u>)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("__") && token.endsWith("__")) {
      return <u key={`${token}-${index}`}>{token.slice(2, -2)}</u>;
    }

    if (token.startsWith("<u>") && token.endsWith("</u>")) {
      return <u key={`${token}-${index}`}>{token.slice(3, -4)}</u>;
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function renderInlineWithSources(
  text: string,
  sources: ChatSource[],
  onOpenSources: (references: SourceReference[]) => void,
) {
  // Texto del párrafo sin los marcadores [F#]: es lo que se compara contra la
  // fuente para extraer la porción relacionada en el modal.
  const paragraphText = text.replace(/\[F\d+\]/g, " ").replace(/\s+/g, " ").trim();
  const parts = text.split(/((?:\s*\[F\d+\])+)/g).filter((part) => part !== undefined && part !== "");
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const matches = Array.from(part.matchAll(/\[F(\d+)\]/g));

    if (matches.length > 0 && part.replace(/\s|\[F\d+\]/g, "") === "") {
      const validReferences: SourceReference[] = [];
      const missingNumbers: number[] = [];

      for (const match of matches) {
        const sourceNumber = Number(match[1]);
        const source = sources[sourceNumber - 1];

        if (source) {
          validReferences.push({ number: sourceNumber, source, paragraphText });
        } else {
          missingNumbers.push(sourceNumber);
        }
      }

      if (validReferences.length > 0) {
        nodes.push(
          <button
            aria-label={`Abrir fuente ${validReferences.map((reference) => reference.number).join(", ")}`}
            className="sourceRefButton"
            key={`ref-${index}`}
            onClick={() => onOpenSources(validReferences)}
            type="button"
          >
            {validReferences.map((reference) => reference.number).join(",")}
          </button>,
        );
      }

      // No descartar en silencio una cita fuera de rango: avisar visiblemente.
      for (const missingNumber of missingNumbers) {
        nodes.push(
          <span
            className="sourceRefMissing"
            key={`missing-${index}-${missingNumber}`}
            title="Fuente citada no encontrada entre las fuentes recuperadas"
          >
            F{missingNumber}?
          </span>,
        );
      }

      continue;
    }

    nodes.push(...renderFormattedText(part));
  }

  return nodes;
}

function SourceModalReference({ reference }: { reference: SourceReference }) {
  const { snippet, matched, hits } = relevantSnippet(
    reference.source.excerpt,
    reference.paragraphText,
  );
  const showFullExcerpt = snippet.trim() !== reference.source.excerpt.trim();

  return (
    <article className="sourceModalReference">
      <div className="sourceModalReferenceHeader">
        <strong>Fuente {reference.number}</strong>
        <span>{reference.source.documentTitle}</span>
      </div>
      <div className="sourceModalMeta">
        <span>{reference.source.documentType}</span>
        <span>{reference.source.sourceEntity ?? "Sin entidad"}</span>
        {processTypeLabel(reference.source.processType) ? (
          <span>{processTypeLabel(reference.source.processType)}</span>
        ) : null}
        {reference.source.sectionTitle ? <span>{reference.source.sectionTitle}</span> : null}
        <span>Calidad {reference.source.evidenceQuality.toFixed(2)}</span>
      </div>
      <div className="sourceExactBox">
        <strong>Ubicación verificada</strong>
        <span>{sourcePrecisionLabel(reference.source)}</span>
        <small>
          Fragmento {reference.source.chunkIndex + 1} · {reference.source.matchType} · semántico{" "}
          {reference.source.semanticScore.toFixed(3)} · literal{" "}
          {(reference.source.lexicalScore * 100).toFixed(0)}%
        </small>
      </div>
      <strong>{reference.source.citation}</strong>

      {hits > 0 ? (
        <div className="sourceQuote">
          <Quote size={17} />
          <div>
            <small className="sourceQuoteLabel">Relacionado con esta afirmación</small>
            <p>
              <HighlightedSnippet text={snippet} matched={matched} />
            </p>
          </div>
        </div>
      ) : (
        <div className="sourceQuote sourceQuoteWeak">
          <AlertTriangle size={16} />
          <p>
            Esta fuente no contiene texto directamente relacionado con esta afirmación. Revisa el
            fragmento completo o el PDF: puede ser una cita imprecisa del asistente.
          </p>
        </div>
      )}

      {showFullExcerpt ? (
        <details className="sourceFullExcerpt">
          <summary>Ver fragmento completo de la fuente</summary>
          <p>{reference.source.excerpt}</p>
        </details>
      ) : null}

      <a
        className="secondaryButton compactButton"
        href={documentPdfUrl(reference.source)}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink size={15} />
        {reference.source.pageStart
          ? `Abrir PDF en página ${reference.source.pageStart}`
          : "Abrir PDF"}
      </a>
    </article>
  );
}

function AnswerContent({
  content,
  onOpenSources,
  sources,
}: {
  content: string;
  onOpenSources: (references: SourceReference[]) => void;
  sources: ChatSource[];
}) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de tabla pipe: fila de cabecera + separador + filas.
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableCells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isTableSeparator(lines[j])) {
        rows.push(splitTableCells(lines[j]));
        j += 1;
      }

      nodes.push(
        <div className="answerTableWrap" key={`table-${i}`}>
          <table className="answerTable">
            <thead>
              <tr>
                {header.map((cell, k) => (
                  <th key={k}>{renderInlineWithSources(cell, sources, onOpenSources)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rk) => (
                <tr key={rk}>
                  {row.map((cell, k) => (
                    <td key={k}>{renderInlineWithSources(cell, sources, onOpenSources)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      i = j;
      continue;
    }

    const heading = line.match(/^\*\*(.+)\*\*$/);
    if (heading) {
      nodes.push(<h3 key={`h-${i}`}>{heading[1]}</h3>);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      nodes.push(
        <div className="answerBullet" key={`b-${i}`}>
          <span aria-hidden="true">•</span>
          <p>{renderInlineWithSources(line.replace(/^[-*]\s+/, ""), sources, onOpenSources)}</p>
        </div>,
      );
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const [, number = "", text = line] = line.match(/^(\d+)\.\s+(.+)$/) ?? [];
      nodes.push(
        <div className="answerNumbered" key={`n-${i}`}>
          <span>{number}</span>
          <p>{renderInlineWithSources(text, sources, onOpenSources)}</p>
        </div>,
      );
      i += 1;
      continue;
    }

    nodes.push(<p key={`p-${i}`}>{renderInlineWithSources(line, sources, onOpenSources)}</p>);
    i += 1;
  }

  return <div className="answerContent">{nodes}</div>;
}

function CoverageGrid({ coverage }: { coverage?: ChatAssessment["coverage"] }) {
  const items = [
    { label: "Ley", value: coverage?.ley, detail: "normativa" },
    { label: "Reglamento", value: coverage?.reglamento, detail: "normativa" },
    { label: "Directiva", value: coverage?.directiva, detail: "aplicable" },
    { label: "Opinión", value: coverage?.opinion, detail: "criterio no obligatorio" },
    { label: "Bases", value: coverage?.bases, detail: "solo esquema" },
  ];

  return (
    <div className="coverageGrid" aria-label="Cobertura de fuentes">
      {items.map((item) => (
        <span data-found={item.value ? "true" : "false"} key={item.label}>
          <strong>{item.label}</strong>
          {item.value ? "sí" : "no"}
          <small>{item.detail}</small>
        </span>
      ))}
    </div>
  );
}

function AnswerUseCard({
  assessment,
  confidence,
  filters,
  message,
}: {
  assessment?: ChatAssessment;
  confidence?: Confidence;
  filters: Record<string, string>;
  message: ConversationMessage;
}) {
  if (!assessment && !confidence) {
    return null;
  }

  const status = answerUseLabel(confidence, assessment?.sufficient);
  const interpretedQuery =
    assessment?.queryUsed &&
    message.questionText &&
    assessment.queryUsed !== message.questionText.trim().toLowerCase()
      ? assessment.queryUsed
      : "";

  return (
    <div className="answerUseCard" data-tone={status.tone}>
      <div>
        <strong>{status.label}</strong>
        <span>{status.detail}</span>
      </div>
      {assessment ? (
        <div className="answerUseMetrics">
          <span>{assessment.uniqueDocuments} doc.</span>
          <span>score {assessment.topScore.toFixed(3)}</span>
          <span>calidad {assessment.evidenceQuality.toFixed(2)}</span>
          <span>literal {(assessment.lexicalScore * 100).toFixed(0)}%</span>
        </div>
      ) : null}
      {interpretedQuery ? <small>Pregunta interpretada: {interpretedQuery}</small> : null}
      {assessment?.reason ? <small>{assessment.reason}</small> : null}
      <div className="answerUseActions">
        <Link className="secondaryButton compactButton" href={buildSearchUrl(message, filters)}>
          <Search size={14} />
          Revisar evidencia
        </Link>
        {status.tone === "bad" ? (
          <Link className="secondaryButton compactButton" href="/validar">
            <ShieldCheck size={14} />
            Verificar corpus
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// Evidencia de UN turno: cobertura, métricas, advertencias y fuentes con su
// fragmento. Vive dentro de cada mensaje del asistente (no en un panel global).
function MessageEvidence({
  message,
  onOpenSources,
}: {
  message: ConversationMessage;
  onOpenSources: (references: SourceReference[]) => void;
}) {
  const sources = message.sources ?? [];
  const assessment = message.assessment;

  if (sources.length === 0 && !assessment) {
    return null;
  }

  return (
    <details className="msgEvidence">
      <summary>
        <FileText size={14} />
        Ver fuentes y detalle
        <span className="msgEvidenceCount">{sources.length}</span>
      </summary>

      {assessment ? (
        <div className="msgEvidenceMeta">
          {message.confidence ? (
            <p className="confidenceMeaning">{confidenceMeaning(message.confidence)}</p>
          ) : null}
          <small>
            {assessment.uniqueDocuments} documento(s) · score {assessment.topScore.toFixed(3)} ·
            calidad {assessment.evidenceQuality.toFixed(2)} · literal{" "}
            {(assessment.lexicalScore * 100).toFixed(0)}%
          </small>
          <CoverageGrid coverage={assessment.coverage} />
          {assessment.evidenceWarnings?.length ? (
            <div className="warningList">
              <AlertTriangle size={15} />
              <span>{assessment.evidenceWarnings.join(" ")}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {groupSourcesByDocument(sources).map(({ document, sources: documentSources }, index) => (
        <article className="evidenceCard" key={document.documentId}>
          <span>Fuente {index + 1}</span>
          <strong>{document.documentTitle}</strong>
          <small>
            {document.documentType} · {document.sourceEntity ?? "Sin entidad"} ·{" "}
            {documentSources.length} fragmento(s)
          </small>
          {documentSources.map((source) => {
            const reference: SourceReference = {
              number: sources.indexOf(source) + 1,
              source,
              paragraphText: message.questionText ?? "",
            };
            return (
              <details key={source.chunkId}>
                <summary>
                  {source.citation || `Fragmento ${source.chunkIndex + 1}`} · calidad{" "}
                  {source.evidenceQuality.toFixed(2)}
                </summary>
                <strong className="precisionLine">{sourcePrecisionLabel(source)}</strong>
                <p>{source.excerpt}</p>
                <div className="evidenceCardActions">
                  <button
                    className="secondaryButton compactButton"
                    onClick={() => onOpenSources([reference])}
                    type="button"
                  >
                    <Quote size={14} />
                    Ver relacionado
                  </button>
                  <a className="sourceLink" href={documentPdfUrl(source)} rel="noreferrer" target="_blank">
                    <ExternalLink size={14} />
                    {source.pageStart ? `Página ${source.pageStart}` : "Abrir PDF"}
                  </a>
                </div>
              </details>
            );
          })}
        </article>
      ))}
    </details>
  );
}

export function LegalChat() {
  const searchParams = useSearchParams();
  const { processTypes: configuredProcessTypes } = useSettingsCatalog();
  const processTypes = withBlankProcessOption(configuredProcessTypes);
  const initialQuestion = searchParams.get("pregunta") ?? "";
  const initialDocumentTypeParam = searchParams.get("documentType") ?? "";
  const initialDocumentType = documentTypes.some((item) => item.value === initialDocumentTypeParam)
    ? initialDocumentTypeParam
    : "";
  const initialDocumentId = searchParams.get("documentId") ?? "";
  const initialArticle = searchParams.get("article") ?? "";
  const initialProcessType = searchParams.get("processType") ?? "";
  const initialSourceEntity = searchParams.get("sourceEntity") ?? "";
  const initialStatus = searchParams.get("status") ?? "";
  const initialTopic = searchParams.get("topic") ?? "";
  const initialVigencia = searchParams.get("vigencia") ?? "";
  const initialYear = searchParams.get("year") ?? "";

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState(initialQuestion);
  const [tone, setTone] = useState("formal");
  const [length, setLength] = useState("media");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReferences, setSelectedReferences] = useState<SourceReference[] | null>(null);

  const [documentType, setDocumentType] = useState(initialDocumentType);
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [article, setArticle] = useState(initialArticle);
  const [processType, setProcessType] = useState(initialProcessType);
  const [sourceEntity, setSourceEntity] = useState(initialSourceEntity);
  const [topic, setTopic] = useState(initialTopic);
  const [vigencia, setVigencia] = useState(initialVigencia);
  const [year, setYear] = useState(initialYear);
  // status no es un filtro editable (campo interno); solo para deep-links por URL.
  const [status] = useState(initialStatus);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasConversation = messages.length > 0;
  const canSubmit = question.trim().length >= 5 && !isStreaming;

  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [
    documentType
      ? {
          key: "documentType",
          label: `Tipo: ${documentTypes.find((d) => d.value === documentType)?.label ?? documentType}`,
          clear: () => setDocumentType(""),
        }
      : null,
    documentId ? { key: "documentId", label: "Documento exacto", clear: () => setDocumentId("") } : null,
    article ? { key: "article", label: `Articulo: ${article}`, clear: () => setArticle("") } : null,
    processType
      ? {
          key: "processType",
          label: `Proceso: ${processLabelFromOptions(configuredProcessTypes, processType) ?? processTypeLabel(processType) ?? processType}`,
          clear: () => setProcessType(""),
        }
      : null,
    sourceEntity ? { key: "sourceEntity", label: `Entidad: ${sourceEntity}`, clear: () => setSourceEntity("") } : null,
    topic ? { key: "topic", label: `Tema: ${topic}`, clear: () => setTopic("") } : null,
    vigencia ? { key: "vigencia", label: `Vigencia: ${vigencia}`, clear: () => setVigencia("") } : null,
    year ? { key: "year", label: `Año: ${year}`, clear: () => setYear("") } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const currentFilterValues = { article, documentId, documentType, processType, sourceEntity, topic, vigencia, year };

  // Mantiene a la vista el último mensaje mientras llega el streaming.
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function updateMessage(id: string, patch: (message: ConversationMessage) => ConversationMessage) {
    setMessages((current) => current.map((message) => (message.id === id ? patch(message) : message)));
  }

  function handleEvent(assistantId: string, event: StreamEvent) {
    if (event.type === "meta") {
      updateMessage(assistantId, (message) => ({
        ...message,
        sources: event.sources,
        assessment: event.assessment,
        confidence: event.confidence,
      }));
      return;
    }

    if (event.type === "delta") {
      updateMessage(assistantId, (message) => ({ ...message, content: message.content + event.text }));
      return;
    }

    if (event.type === "done") {
      updateMessage(assistantId, (message) => ({
        ...message,
        streaming: false,
        persistedId: event.messageId,
        model: event.model,
        citationWarnings: event.citationWarnings ?? [],
      }));
      setSessionId((current) => event.sessionId ?? current);
      return;
    }

    updateMessage(assistantId, (message) => ({ ...message, streaming: false, error: event.error }));
  }

  async function submitQuestion(event?: React.FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();

    const normalizedQuestion = (override ?? question).trim();
    if (normalizedQuestion.length < 5) {
      setError("Escribe una pregunta más específica.");
      return;
    }
    if (isStreaming) {
      return;
    }

    const userMessage: ConversationMessage = {
      content: normalizedQuestion,
      id: buildMessageId(),
      role: "user",
    };
    const assistantId = buildMessageId();
    const assistantMessage: ConversationMessage = {
      content: "",
      id: assistantId,
      mode: `${tone}/${length}`,
      questionText: normalizedQuestion,
      role: "assistant",
      streaming: true,
    };

    setError("");
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion("");
    setIsStreaming(true);
    if (composerRef.current) {
      composerRef.current.style.height = "auto";
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          filters: { article, documentId, documentType, processType, sourceEntity, status, topic, vigencia, year },
          tone,
          length,
          question: normalizedQuestion,
          sessionId: sessionId ?? undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !response.body || !contentType.includes("ndjson")) {
        const payload = await response.json().catch(() => ({}));
        updateMessage(assistantId, (message) => ({
          ...message,
          streaming: false,
          error: (payload as { error?: string }).error ?? "No se pudo responder la consulta.",
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            try {
              handleEvent(assistantId, JSON.parse(line) as StreamEvent);
            } catch {
              // Línea incompleta o ruido: se ignora.
            }
          }
          newlineIndex = buffer.indexOf("\n");
        }
      }

      const rest = buffer.trim();
      if (rest) {
        try {
          handleEvent(assistantId, JSON.parse(rest) as StreamEvent);
        } catch {
          // Ignorar resto no parseable.
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        updateMessage(assistantId, (message) => ({
          ...message,
          streaming: false,
          content: message.content || "_Consulta detenida._",
        }));
      } else {
        updateMessage(assistantId, (message) => ({
          ...message,
          streaming: false,
          error: "No se pudo conectar con el servidor.",
        }));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function retry(message: ConversationMessage) {
    setMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index <= 0) {
        return current.filter((item) => item.id !== message.id);
      }
      // Quita el turno fallido (asistente) y su pregunta para reenviarlo limpio.
      return current.filter((_, position) => position !== index && position !== index - 1);
    });
    void submitQuestion(undefined, message.questionText);
  }

  function resetChat() {
    abortRef.current?.abort();
    setMessages([]);
    setQuestion("");
    setSessionId(null);
    setError("");
    setCopiedId("");
  }

  function clearFilters() {
    setDocumentType("");
    setProcessType("");
    setSourceEntity("");
    setTopic("");
    setVigencia("");
    setYear("");
  }

  async function copyMessage(message: ConversationMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
  }

  async function copyMessageWithSources(message: ConversationMessage) {
    const sourceLines = (message.sources ?? [])
      .map(
        (source, index) =>
          `[F${index + 1}] ${source.citation} · ${source.documentTitle}${
            source.article ? ` · articulo ${source.article}` : ""
          }${source.pageStart ? ` · pagina ${source.pageStart}` : ""}`,
      )
      .join("\n");
    const text = [
      message.questionText ? `Pregunta:\n${message.questionText}` : "",
      "Respuesta:",
      message.content,
      sourceLines ? `Fuentes:\n${sourceLines}` : "Fuentes: sin fuentes recuperadas",
    ]
      .filter(Boolean)
      .join("\n\n");

    await navigator.clipboard.writeText(text);
    setCopiedId(`${message.id}-sources`);
  }

  function exportMessage(message: ConversationMessage) {
    if (!message.persistedId) {
      setError("La respuesta aún no está lista para exportar.");
      return;
    }
    window.location.href = `/api/chat/messages/${message.persistedId}/export`;
  }

  async function updateAssistantMessage(
    message: ConversationMessage,
    action: "mark_correct" | "mark_incorrect" | "save_note",
    note?: string,
  ) {
    if (!message.persistedId) {
      setError("La respuesta aún no tiene identificador persistido.");
      return;
    }

    try {
      const response = await fetch(`/api/chat/messages/${message.persistedId}`, {
        body: JSON.stringify({ action, note }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "No se pudo guardar la acción.");
        return;
      }

      updateMessage(message.id, (item) =>
        action === "save_note"
          ? { ...item, note: note ?? "" }
          : { ...item, feedback: action === "mark_correct" ? "correct" : "incorrect" },
      );
      setError("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  function buildAutomaticNote(message: ConversationMessage) {
    const sourceLines = (message.sources ?? [])
      .slice(0, 6)
      .map((source, index) => `${index + 1}. ${source.citation}`)
      .join("\n");

    return [
      `Pregunta: ${message.questionText ?? "No registrada"}`,
      "",
      "Respuesta:",
      message.content,
      "",
      sourceLines ? `Fuentes:\n${sourceLines}` : "Fuentes: sin fuentes recuperadas",
    ].join("\n");
  }

  function autoGrow(target: HTMLTextAreaElement) {
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 168)}px`;
  }

  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  return (
    <div className="legalTool chatRedesign">
      <header className="chatHeader">
        <div className="chatHeaderTitle">
          <div className="legalToolIcon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="eyebrow">Consulta legal</p>
            <h2>Chat jurídico</h2>
            <p>Respuestas redactadas solo cuando hay fuentes suficientes, con cita verificable.</p>
          </div>
        </div>
        <button className="secondaryButton compactButton" onClick={resetChat} type="button">
          <RotateCcw size={16} />
          Nueva consulta
        </button>
      </header>

      <div className="chatContextBar">
        <div className="styleSelectors">
          <span className="styleSelectorsTitle" title="Cómo quieres que te responda (opcional)">
            Estilo de respuesta
          </span>
          {/* Ajustes de la respuesta, no pestañas: no cambian de panel, cambian
              cómo responde el modelo. */}
          <div className="modeSelector" role="group" aria-label="Tono de respuesta">
            <span className="styleSelectorLabel">Tono</span>
            {toneOptions.map((item) => (
              <button
                aria-pressed={tone === item.value}
                key={item.value}
                onClick={() => setTone(item.value)}
                title={item.hint}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="modeSelector" role="group" aria-label="Longitud de respuesta">
            <span className="styleSelectorLabel">Longitud</span>
            {lengthOptions.map((item) => (
              <button
                aria-pressed={length === item.value}
                key={item.value}
                onClick={() => setLength(item.value)}
                title={item.hint}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filterArea">
          {activeFilters.map((filter) => (
            <button className="filterChip" key={filter.key} onClick={filter.clear} type="button">
              {filter.label}
              <X size={13} />
            </button>
          ))}
          <button
            aria-expanded={showFilters}
            className="filterToggleButton"
            onClick={() => setShowFilters((current) => !current)}
            type="button"
          >
            <SlidersHorizontal size={15} />
            Filtros
          </button>

          {showFilters ? (
            <div className="filterPopover">
              <div className="filterPopoverGrid">
                <label>
                  <span>Tipo</span>
                  <select onChange={(event) => setDocumentType(event.target.value)} value={documentType}>
                    {documentTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tipo de proceso</span>
                  <select onChange={(event) => setProcessType(event.target.value)} value={processType}>
                    {processTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Entidad</span>
                  <input onChange={(event) => setSourceEntity(event.target.value)} placeholder="OECE" value={sourceEntity} />
                </label>
                <label>
                  <span>Tema</span>
                  <input onChange={(event) => setTopic(event.target.value)} placeholder="impedimentos" value={topic} />
                </label>
                <label>
                  <span>Vigencia</span>
                  <input onChange={(event) => setVigencia(event.target.value)} placeholder="vigente" value={vigencia} />
                </label>
                <label>
                  <span>Año</span>
                  <input inputMode="numeric" onChange={(event) => setYear(event.target.value)} placeholder="2024" value={year} />
                </label>
              </div>
              <div className="filterPopoverActions">
                <button className="secondaryButton compactButton" onClick={clearFilters} type="button">
                  <RotateCcw size={14} />
                  Limpiar
                </button>
                <button className="primaryButton compactButton" onClick={() => setShowFilters(false)} type="button">
                  Aplicar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="chatConversation">
        {!hasConversation ? (
          <div className="chatEmptyRedesign">
            <div className="chatEmptyIntro">
              <div className="chatEmptyIcon">
                <Bot size={28} />
              </div>
              <strong>¿Qué necesitas consultar?</strong>
              <span>
                Pregunta con tus propias palabras sobre contrataciones públicas. Te respondo con base en
                las leyes, reglamentos, directivas y opiniones cargadas, y te muestro de dónde sale cada dato.
              </span>
            </div>

            <div className="chatHowItWorks">
              <div>
                <span className="howStepNum">1</span>
                <div>
                  <strong>Escribe tu pregunta</strong>
                  <small>En lenguaje normal, no hace falta saber de leyes.</small>
                </div>
              </div>
              <div>
                <span className="howStepNum">2</span>
                <div>
                  <strong>Busco en los documentos</strong>
                  <small>Reviso las normas y opiniones cargadas.</small>
                </div>
              </div>
              <div>
                <span className="howStepNum">3</span>
                <div>
                  <strong>Te respondo con fuentes</strong>
                  <small>Cada dato lleva su cita; tócala para verla.</small>
                </div>
              </div>
            </div>

            <div className="chatEmptyExamples">
              <p>Prueba con una de estas:</p>
              <div className="exampleCards">
                {exampleQuestions.map((item) => (
                  <button key={item} onClick={() => setQuestion(item)} type="button">
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div className={`msgRow ${message.role}`} key={message.id}>
            <div className="msgAvatar">{message.role === "user" ? <User size={16} /> : <Bot size={16} />}</div>
            <div className="msgBubble">
              {message.role === "assistant" ? (
                <>
                  <div className="msgBubbleTop">
                    <strong>Respuesta</strong>
                    {message.confidence ? (
                      <span className={confidenceClasses(message.confidence)} title={confidenceMeaning(message.confidence)}>
                        Confianza {message.confidence}
                      </span>
                    ) : null}
                  </div>

                  {!message.error ? (
                    <AnswerUseCard
                      assessment={message.assessment}
                      confidence={message.confidence}
                      filters={currentFilterValues}
                      message={message}
                    />
                  ) : null}

                  {message.streaming && !message.content ? (
                    <span className="loadingInline">
                      <LoaderCircle size={16} />
                      Buscando fuentes y redactando…
                    </span>
                  ) : (
                    <div className="msgBubbleBody">
                      <AnswerContent
                        content={message.content}
                        onOpenSources={(references) => setSelectedReferences(references)}
                        sources={message.sources ?? []}
                      />
                      {message.streaming ? <span className="streamCursor" aria-hidden="true" /> : null}
                    </div>
                  )}

                  {!message.streaming && message.citationWarnings?.length ? (
                    <div className="msgCitationWarning">
                      <AlertTriangle size={15} />
                      <div>
                        <strong>Verificación de citas</strong>
                        <span>
                          Algunos datos citados no se encontraron en el fragmento citado; confírmalos
                          en el texto original antes de usarlos:
                        </span>
                        <ul>
                          {message.citationWarnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {message.error ? (
                    <div className="msgError">
                      <AlertTriangle size={15} />
                      <span>{message.error}</span>
                      {message.questionText ? (
                        <button className="secondaryButton compactButton" onClick={() => retry(message)} type="button">
                          <RotateCcw size={14} />
                          Reintentar
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {!message.streaming && !message.error && message.sources?.length ? (
                    <div className="msgSourceChips">
                      {groupSourcesByDocument(message.sources).map(({ document, sources: docSources }) => (
                        <span className="sourceChip" key={document.documentId} title={document.documentTitle}>
                          <FileText size={13} />
                          {document.documentTitle}
                          <em>{docSources.length}</em>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {!message.streaming && !message.error ? (
                    <MessageEvidence message={message} onOpenSources={(references) => setSelectedReferences(references)} />
                  ) : null}

                  {!message.streaming && !message.error && message.content ? (
                    <div className="responseActions">
                      <small className="responseActionsHint">Acciones sobre esta respuesta</small>
                      <button
                        className="responseActionButton"
                        onClick={() => void updateAssistantMessage(message, "save_note", buildAutomaticNote(message))}
                        title="Guarda pregunta, respuesta y fuentes como nota automatica"
                        type="button"
                      >
                        <Pin size={15} />
                        {message.note ? "Nota guardada" : "Nota rápida"}
                      </button>
                      <button
                        className="responseActionButton compactAction"
                        onClick={() => void copyMessage(message)}
                        title="Copia solo el texto de la respuesta"
                        type="button"
                      >
                        {copiedId === message.id ? <Check size={16} /> : <Clipboard size={16} />}
                        {copiedId === message.id ? "Copiado" : "Copiar"}
                      </button>
                      <button
                        className="responseActionButton compactAction"
                        onClick={() => void copyMessageWithSources(message)}
                        title="Copia la respuesta junto con las citas recuperadas"
                        type="button"
                      >
                        {copiedId === `${message.id}-sources` ? <Check size={16} /> : <CopyCheck size={16} />}
                        {copiedId === `${message.id}-sources` ? "Copiado" : "Copiar con fuentes"}
                      </button>
                      <button
                        aria-pressed={message.feedback === "correct"}
                        className="responseActionButton compactAction"
                        onClick={() => void updateAssistantMessage(message, "mark_correct")}
                        title="Marcar respuesta correcta"
                        type="button"
                      >
                        <ThumbsUp size={16} />
                        Correcta
                      </button>
                      <button
                        aria-pressed={message.feedback === "incorrect"}
                        className="responseActionButton compactAction"
                        onClick={() => void updateAssistantMessage(message, "mark_incorrect")}
                        title="Marcar respuesta incorrecta"
                        type="button"
                      >
                        <ThumbsDown size={16} />
                        Incorrecta
                      </button>
                      <button
                        className="responseActionButton compactAction"
                        onClick={() => exportMessage(message)}
                        title="Exportar la respuesta con pregunta, confianza y fuentes a Word"
                        type="button"
                      >
                        <Download size={16} />
                        Exportar Word
                      </button>
                      <SaveButton
                        itemType="mensaje"
                        messageId={message.persistedId ?? undefined}
                        title={message.content.slice(0, 120)}
                        label="Guardar en carpeta"
                      />
                    </div>
                  ) : null}

                  {!message.streaming && !message.error && message.id === lastAssistantId ? (
                    <div className="followChips">
                      {followUpsFor(message).map((prompt) => (
                        <button disabled={isStreaming} key={prompt} onClick={() => void submitQuestion(undefined, prompt)} type="button">
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {error ? <p className="formMessage errorText">{error}</p> : null}
        <div ref={timelineEndRef} aria-hidden="true" />
      </div>

      <form className="chatComposerBar" onSubmit={submitQuestion}>
        <textarea
          aria-label="Pregunta jurídica"
          onChange={(event) => {
            setQuestion(event.target.value);
            autoGrow(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSubmit) {
                void submitQuestion();
              }
            }
          }}
          placeholder="Escribe tu consulta… (Enter envía · Shift+Enter salto de línea)"
          ref={composerRef}
          rows={1}
          value={question}
        />
        {isStreaming ? (
          <button className="secondaryButton stopButton" onClick={stopStreaming} type="button">
            <Square size={16} />
            Detener
          </button>
        ) : (
          <button className="primaryButton sendButton" disabled={!canSubmit} type="submit">
            <Send size={18} />
            Consultar
          </button>
        )}
      </form>

      <Dialog.Root open={Boolean(selectedReferences)} onOpenChange={(open) => !open && setSelectedReferences(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="sourceModal">
            <Dialog.Title>
              {selectedReferences && selectedReferences.length > 1
                ? `Fuentes ${selectedReferences.map((reference) => reference.number).join(", ")}`
                : `Fuente ${selectedReferences?.[0]?.number ?? ""}`}
            </Dialog.Title>
            <Dialog.Description>Verificación documental de la afirmación seleccionada.</Dialog.Description>
            {selectedReferences ? (
              <div className="sourceModalBody">
                {selectedReferences.map((reference) => (
                  <SourceModalReference key={`${reference.number}-${reference.source.chunkId}`} reference={reference} />
                ))}
                <div className="dialogActions">
                  <Dialog.Close className="primaryButton" type="button">
                    Entendido
                  </Dialog.Close>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
