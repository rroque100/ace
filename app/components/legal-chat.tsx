"use client";

import { materialWarnings } from "@/lib/chat-signals";
import { chatAnswerSections, reviewSummary, reviewApplicability, reviewTechnicalNotes, consultedFragments } from "@/lib/chat-review-presentation";
import type { EvidenceReview } from "@/lib/chat-evidence-audit";
import { CaseAttachments } from "./case-attachments";
import { ExtendedLegalFilterControls, LegalChatRecent } from "./legal-workspace-tools";
import { extendedLegalFiltersSchema, extendedFiltersFromParams, type ExtendedLegalFilters } from "@/lib/legal-workspace-filters";
import type { LegalResponseTelemetry } from "@/lib/legal-telemetry";
import { LegalCenterNav } from "./legal-center-nav";
import { LegalValidityBadge } from "./legal-validity-badge";
import { legalCenterHref } from "@/lib/legal-center";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { emptyCaseContext, readCaseContext, type CaseContext } from "@/lib/chat-case-context";
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

const chatWideQuery = "(min-width: 1101px)";
function subscribeChatViewport(callback: () => void) {
  const query = window.matchMedia(chatWideQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function readChatWideViewport() { return window.matchMedia(chatWideQuery).matches; }
function readChatServerViewport() { return false; }

type ChatSource = {
  version?: string | null;
  numeral?: string | null;
  requestedOriginal?: boolean;
  referenceRelation?: "original" | "cites_requested" | "related";
  pageCount?: number | null;
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
  evidenceReview?: EvidenceReview;
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
  | { type: "meta"; sources: ChatSource[]; assessment: ChatAssessment; confidence: Confidence; caseDocuments?: CaseDocumentReference[] }
  | { type: "delta"; text: string }
  | { type: "progress"; stage: "drafting" | "checking" }
  | {
      type: "done";
      sessionId: string | null;
      messageId: string | null;
      model: string;
      citationWarnings?: string[];
      assessment?: ChatAssessment;
      confidence?: Confidence;
      telemetry?: LegalResponseTelemetry;
    }
  | { type: "error"; error: string };

type CaseDocumentReference = { id:string; name:string; sessionId:string; partial:boolean };
type ConversationMessage = {
  progress?: "drafting" | "checking";
  caseDocuments?: CaseDocumentReference[];
  telemetry?: LegalResponseTelemetry;
  caseContext?: CaseContext;
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

function confidenceMeaning(confidence?: Confidence) {
  if (confidence === "alta") {
    return "Alta relevancia documental: hay coincidencias y referencias trazables. No confirma por sí sola la vigencia, la aplicabilidad ni la exactitud jurídica.";
  }

  if (confidence === "media") {
    return "Media: la respuesta está sustentada, pero requiere revisión porque la coincidencia o la cobertura normativa no es completa.";
  }

  return "Baja: no usar como conclusión jurídica; faltan fuentes suficientes, trazabilidad precisa o coincidencia fuerte con la pregunta.";
}


function documentPdfUrl(source: Pick<ChatSource, "documentId" | "pageStart">) {
  return `/api/documents/${source.documentId}${source.pageStart ? `#page=${source.pageStart}` : ""}`;
}

function buildSearchUrl(message: ConversationMessage, filters: Record<string, string>) {
  const params = new URLSearchParams();
  if (message.persistedId) return `/busqueda?messageId=${encodeURIComponent(message.persistedId)}`;

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

      </div>
      <div className="sourceExactBox">
        <strong>{reference.source.pageCount ? "Ubicación con rango comprobado" : "Ubicación registrada"}</strong>
        {reference.source.requestedOriginal !== undefined ? <span>{reference.source.requestedOriginal ? "Original solicitado identificado" : reference.source.referenceRelation === "cites_requested" ? "Menciona al documento solicitado; evidencia indirecta" : "Material relacionado; no sustituye al original solicitado"}</span> : null}
        <span>{sourcePrecisionLabel(reference.source)}</span>
        <small>La ubicación del fragmento no acredita por sí sola vigencia ni aplicabilidad jurídica.</small>
        <details className="chatTechnicalDetails"><summary>Detalles de coincidencia</summary><small>
          Fragmento {reference.source.chunkIndex + 1} · {reference.source.matchType} · semántico{" "}
          {reference.source.semanticScore.toFixed(3)} · literal{" "}
          {(reference.source.lexicalScore * 100).toFixed(0)}%
        </small></details>
      </div>
      <strong>{reference.source.citation}</strong>
      <p>Numeral: {reference.source.numeral ?? "no registrado"} · Versión: {reference.source.version ?? "no registrada"}</p>
      <LegalValidityBadge value={reference.source.vigencia} status={reference.source.status} />

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

      <div className="sourceActions">
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
      <Link className="secondaryButton compactButton" href={legalCenterHref("normas", { documentId: reference.source.documentId, documentType: reference.source.documentType, article: reference.source.article })}>Ver en Normativa</Link>
      <Link className="secondaryButton compactButton" href={legalCenterHref("busqueda", { documentId: reference.source.documentId, documentType: reference.source.documentType })}>Buscar en este documento</Link>
      </div>
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

function ReviewedAnswerContent({ content, review, sources, onOpenSources }: {
  content: string; review?: EvidenceReview; sources: ChatSource[];
  onOpenSources: (references: SourceReference[]) => void;
}) {
  const sections = chatAnswerSections(content, review);
  return <>
    <AnswerContent content={sections.main} sources={sources} onOpenSources={onOpenSources} />
    {sections.detail ? <details className="chatTechnicalDetails"><summary>Ver fundamento y fuentes</summary>
      <AnswerContent content={sections.detail} sources={sources} onOpenSources={onOpenSources} />
    </details> : null}
  </>;
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

  const review = assessment?.evidenceReview;
  const status = review ? {
    tone: review.presentation ? "neutral" : "warn", label: review.presentation ? reviewSummary(review, message.content) : "Respuesta anterior sin reevaluar",
    detail: "La aplicación al caso sigue pendiente de confirmar.",
  } : { tone: "warn", label: "Respuesta anterior sin reevaluar", detail: "Puedes volver a consultar para revisarla." };
  const signalWarnings = review?.presentation ? [] : materialWarnings(assessment?.evidenceWarnings);
  const technicalNotes = review?.presentation ? reviewTechnicalNotes(review, materialWarnings(assessment?.evidenceWarnings)) : [];
  const interpretedQuery =
    assessment?.queryUsed &&
    message.questionText &&
    assessment.queryUsed !== message.questionText.trim().toLowerCase()
      ? assessment.queryUsed
      : "";

  return (
    <div className={`answerUseCard${review?.presentation ? " reviewSummaryCard" : ""}`} data-tone={status.tone}>
      <div>
        <strong>{status.label}</strong>
        {!review?.presentation ? <span>{status.detail}</span> : null}
      </div>
      {review?.presentation ? <p className="reviewApplicability">{reviewApplicability(review)}</p> : null}
      {signalWarnings.length ? <ul className="answerUseWarnings" aria-label="Qué falta en esta respuesta">{signalWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      {!review?.presentation ? <p className="chatPlainEvidence">Comprueba la versión de las normas y su aplicación temporal al caso.</p> : null}
      {review && (review.claims.length > 0 || technicalNotes.length > 0 || Boolean(assessment)) ? <details className="chatTechnicalDetails">
        <summary>Qué comprobó ACE</summary>
        <p>Revisión automática de afirmaciones; no sustituye la revisión de un especialista.</p>
        {technicalNotes.length ? <ul>{technicalNotes.map(note => <li key={note}>{note}</li>)}</ul> : null}
        <ol>{review.claims.map(claim => <li key={claim.id}>
          <strong>{claim.status === "supported" ? "Respaldada" : claim.status === "contradicted" ? "Contradicha" : "Respaldo insuficiente"}</strong>: {claim.reason}
          {claim.evidence?.map((item, index) => {
            const source = message.sources?.[item.source - 1];
            return source ? <blockquote key={index}>{item.quote}<br />
              <a href={`/api/documents/${encodeURIComponent(source.documentId)}${source.pageStart ? `#page=${source.pageStart}` : ""}`} target="_blank" rel="noreferrer">Abrir documento citado</a>
            </blockquote> : null;
          })}
        </li>)}</ol>
        {assessment && review.presentation ? <div>
          <p><strong>Sobre la búsqueda</strong></p>
          <p>{assessment.uniqueDocuments} documento(s) · relevancia {assessment.topScore.toFixed(3)} · calidad de extracción {assessment.evidenceQuality.toFixed(2)} · coincidencia literal {(assessment.lexicalScore * 100).toFixed(0)}%</p>
          {interpretedQuery ? <p>Consulta utilizada: {interpretedQuery}</p> : null}
          <small>Estas medidas no indican exactitud jurídica.</small>
        </div> : null}
      </details> : null}
      {assessment && !review?.presentation ? <details className="chatTechnicalDetails"><summary>Detalles de la búsqueda</summary>
        <p>{assessment.uniqueDocuments} documento(s) · relevancia {assessment.topScore.toFixed(3)} · calidad de extracción {assessment.evidenceQuality.toFixed(2)} · coincidencia literal {(assessment.lexicalScore * 100).toFixed(0)}%</p>
        {interpretedQuery ? <p>Consulta utilizada: {interpretedQuery}</p> : null}
        {assessment.reason ? <p>{assessment.reason}</p> : null}
        <small>Estas medidas no indican exactitud jurídica.</small>
      </details> : null}
      <div className="answerUseActions">
        <Link className="secondaryButton compactButton" href={buildSearchUrl(message, filters)}>
          <Search size={14} />
          Buscar más información
        </Link>
        {status.tone === "bad" ? (
          <Link className="secondaryButton compactButton" href="/validar">
            <ShieldCheck size={14} />
            Revisar documentos disponibles
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
        Normas consultadas
        <span className="msgEvidenceCount">{consultedFragments(sources.length)}</span>
      </summary>

      {assessment ? (
        <details className="msgEvidenceMeta"><summary>Cómo se seleccionaron estas normas</summary>
          {message.confidence ? (
            <p className="confidenceMeaning">{confidenceMeaning(message.confidence)}</p>
          ) : null}
          <small>
            {assessment.uniqueDocuments} documento(s) · score {assessment.topScore.toFixed(3)} ·
            calidad {assessment.evidenceQuality.toFixed(2)} · literal{" "}
            {(assessment.lexicalScore * 100).toFixed(0)}%
          </small>
          <CoverageGrid coverage={assessment.coverage} />
          {!assessment.evidenceReview?.presentation && assessment.evidenceWarnings?.length ? (
            <div className="warningList">
              <AlertTriangle size={15} />
              <span>{assessment.evidenceWarnings.join(" ")}</span>
            </div>
          ) : null}
        </details>
      ) : null}

      {groupSourcesByDocument(sources).map(({ document, sources: documentSources }, index) => (
        <article className="evidenceCard" key={document.documentId}>
          <span>Fuente {index + 1}</span>
          <strong>{document.documentTitle}</strong>
          <small>
            {document.documentType} · {document.sourceEntity ?? "Sin entidad"} ·{" "}
            {consultedFragments(documentSources.length)}
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
                  {source.citation || `Fragmento ${source.chunkIndex + 1}`}
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
  // Una instancia por conversación evita arrastrar contexto y peticiones a otra sesión.
  return <LegalChatSession key={searchParams.get("sessionId") ?? "new"} />;
}

function LegalChatSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");
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
  const [extendedFilters, setExtendedFilters] = useState<ExtendedLegalFilters>(() => extendedFiltersFromParams(searchParams));
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [caseContext, setCaseContext] = useState<CaseContext>({ ...emptyCaseContext });
  const [loadingSession, setLoadingSession] = useState(Boolean(requestedSessionId));
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
  const [documentIds, setDocumentIds] = useState<string[]>([]);
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
  const canSubmit = question.trim().length >= 5 && !isStreaming && !loadingSession && !attachmentsBusy;

  useEffect(() => {
    if (!requestedSessionId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/chat/sessions/${encodeURIComponent(requestedSessionId)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir la conversación");
        if (controller.signal.aborted) return;
        const restored = payload.messages as Array<{
          id: string; role: ConversationMessage["role"]; content: string; sources: ChatSource[];
          model: string; metadata: Record<string, unknown>;
        }>;
        const latestUser = [...restored].reverse().find((message) => message.role === "user");
        setAttachmentIds(Array.isArray(latestUser?.metadata?.attachmentIds) ? latestUser.metadata.attachmentIds as string[] : []);
        if (!restored.length && typeof payload.session.metadata?.prefill === "string") setQuestion(payload.session.metadata.prefill);
        setCaseContext(readCaseContext(latestUser?.metadata?.caseContext ?? payload.session.metadata?.caseContext));
        const restoredFilters = (latestUser?.metadata?.filters ?? payload.session.metadata?.filters ?? {}) as Record<string, unknown>;
        setExtendedFilters(extendedLegalFiltersSchema.parse(restoredFilters));
        const textFilter = (key: string) => typeof restoredFilters[key] === "string" ? restoredFilters[key] as string : "";
        setDocumentType(textFilter("documentType"));
        setDocumentId(textFilter("documentId"));
        setDocumentIds(Array.isArray(restoredFilters.documentIds) ? restoredFilters.documentIds.filter((id): id is string=>typeof id === "string") : []);
        setArticle(textFilter("article"));
        setProcessType(textFilter("processType"));
        setSourceEntity(textFilter("sourceEntity"));
        setTopic(textFilter("topic"));
        setVigencia(textFilter("vigencia"));
        setYear(restoredFilters.year ? String(restoredFilters.year) : "");
        setSessionId(payload.session.id);
        setMessages(restored.filter((message) => message.role === "user" || message.role === "assistant").map((message) => ({
          id: message.id, persistedId: message.id, role: message.role, content: message.content,
          sources: message.sources ?? [], model: message.model,
          caseDocuments: message.metadata?.caseDocuments as CaseDocumentReference[] | undefined,
          caseContext: readCaseContext(message.metadata?.caseContext),
          assessment: message.metadata?.assessment as ChatAssessment | undefined,
          confidence: message.metadata?.confidence as Confidence | undefined,
          questionText: message.metadata?.question as string | undefined,
          feedback: message.metadata?.feedback as ConversationMessage["feedback"],
          note: message.metadata?.note as string | undefined,
          telemetry: message.metadata?.telemetry as LegalResponseTelemetry | undefined,
        })));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo abrir la conversación");
      } finally {
        if (!controller.signal.aborted) setLoadingSession(false);
      }
    })();
    return () => controller.abort();
  }, [requestedSessionId]);

  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [
    documentType
      ? {
          key: "documentType",
          label: `Tipo: ${documentTypes.find((d) => d.value === documentType)?.label ?? documentType}`,
          clear: () => setDocumentType(""),
        }
      : null,
    documentIds.length ? { key: "documentIds", label: `Solo ${documentIds.length} documentos seleccionados`, clear: () => setDocumentIds([]) } : null,
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
    if (isStreaming) timelineEndRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "end" });
  }, [messages, isStreaming]);

  function updateMessage(id: string, patch: (message: ConversationMessage) => ConversationMessage) {
    setMessages((current) => current.map((message) => (message.id === id ? patch(message) : message)));
  }

  function handleEvent(assistantId: string, event: StreamEvent) {
    if (event.type === "meta") {
      updateMessage(assistantId, (message) => ({
        ...message,
        sources: event.sources,
        caseDocuments: event.caseDocuments,
        assessment: event.assessment,
        confidence: event.confidence,
      }));
      return;
    }

    if (event.type === "progress") {
      updateMessage(assistantId, message => ({ ...message, progress: event.stage }));
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
        assessment: event.assessment ?? message.assessment,
        confidence: event.confidence ?? message.confidence,
        telemetry: event.telemetry,
        citationWarnings: event.citationWarnings ?? [],
      }));
      setSessionId((current) => event.sessionId ?? current);
      return;
    }

    updateMessage(assistantId, (message) => ({ ...message, streaming: false, error: event.error }));
  }

  async function submitQuestion(event?: React.FormEvent<HTMLFormElement>, override?: string, retryContext?: CaseContext) {
    event?.preventDefault();

    const normalizedQuestion = (override ?? question).trim();
    if (normalizedQuestion.length < 5) {
      setError("Escribe una pregunta más específica.");
      return;
    }
    if (isStreaming || loadingSession || attachmentsBusy) {
      return;
    }

    const userMessage: ConversationMessage = {
      caseContext: { ...(retryContext ?? caseContext) },
      content: normalizedQuestion,
      id: buildMessageId(),
      role: "user",
    };
    const assistantId = buildMessageId();
    const assistantMessage: ConversationMessage = {
      caseContext: userMessage.caseContext,
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
          caseContext: userMessage.caseContext,
          attachmentIds,
          filters: { ...extendedFilters, article, documentId, documentIds: documentIds.length ? documentIds : undefined, documentType, processType, sourceEntity, status, topic, vigencia, year },
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
    void submitQuestion(undefined, message.questionText, message.caseContext);
  }

  function resetChat() {
    abortRef.current?.abort();
    setMessages([]);
    setQuestion("");
    setCaseContext({ ...emptyCaseContext }); setAttachmentIds([]); setExtendedFilters({});
    setLoadingSession(false);
    if (requestedSessionId) router.replace("/chat");
    setSessionId(null);
    setError("");
    setCopiedId("");
  }

  function clearFilters() {
    setExtendedFilters({});
    setDocumentId(""); setDocumentIds([]);
    setArticle("");
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

  const wideChat = useSyncExternalStore(subscribeChatViewport, readChatWideViewport, readChatServerViewport);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  const conversation = (
<div className="chatConversation">
        {!hasConversation ? (
          <div className="chatEmptyRedesign">
            <div className="chatEmptyIntro">
              <div className="chatEmptyIcon">
                <Bot size={28} />
              </div>
              <strong>¿Qué necesitas resolver?</strong>
              <span>
                Cuéntame tu duda sobre contrataciones públicas. Puedes empezar con una pregunta o adjuntar un documento de tu caso.
              </span>
            </div>

            <div className="chatEmptyExamples">
              <p>¿No sabes cómo empezar?</p>
              <div className="exampleCards">
                {exampleQuestions.map((item) => (
                  <button key={item} onClick={() => { setQuestion(item); composerRef.current?.focus(); }} type="button">
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
                    <span className="chatAiLabel">Asistente de ACE</span>
                  </div>

                  {message.streaming && !message.content ? (
                    <span className="loadingInline" role="status" aria-live="polite">
                      <LoaderCircle size={16} />
                      {message.progress === "checking" ? "Comprobando afirmaciones y citas…" : message.progress === "drafting" ? "Preparando una respuesta con las fuentes…" : "Buscando fuentes…"}
                    </span>
                  ) : (
                    <div className="msgBubbleBody">
                      <ReviewedAnswerContent
                        content={message.content}
                        review={message.assessment?.evidenceReview}
                        onOpenSources={(references) => setSelectedReferences(references)}
                        sources={message.sources ?? []}
                      />
                      {message.streaming ? <span className="streamCursor" aria-hidden="true" /> : null}
                    </div>
                  )}

                  {!message.error && !message.streaming ? (
                    <AnswerUseCard
                      assessment={message.assessment}
                      confidence={message.confidence}
                      filters={currentFilterValues}
                      message={message}
                    />
                  ) : null}

                  {!message.streaming && !message.assessment?.evidenceReview?.presentation && message.citationWarnings?.length ? (
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
                        <button type="button" className="sourceChip" key={document.documentId} title={`Revisar ${document.documentTitle}`} onClick={() => setSelectedReferences(docSources.map(source => ({ number: (message.sources ?? []).indexOf(source) + 1, source, paragraphText: message.questionText ?? "" })))}>
                          <FileText size={13} />
                          {document.documentTitle}
                          <em>{consultedFragments(docSources.length)}</em>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.caseDocuments?.length ? <section className="legalWorkspacePanel" aria-label="Originales de los documentos del caso"><strong>Documentos de tu caso</strong><ul className="legalWorkspaceHistory">{message.caseDocuments.map((document,index)=><li key={document.id}><a href={`/api/chat/attachments/${document.id}?sessionId=${document.sessionId}`} target="_blank" rel="noreferrer">[C{index+1}] {document.name}</a><small>{document.partial?"Lectura parcial · revisar":"Texto extraído · revisar"}</small></li>)}</ul></section> : null}
                  {!message.streaming && !message.error ? (
                    <MessageEvidence message={message} onOpenSources={(references) => setSelectedReferences(references)} />
                  ) : null}

                  {!message.streaming && message.telemetry ? <details className="legalWorkspacePanel"><summary>Detalles de esta respuesta</summary><p>Proveedor: {message.telemetry.provider} · Modelo: {message.telemetry.model}</p><p>Recuperación: {(message.telemetry.retrievalMs/1000).toFixed(1)} s · Respuesta: {(message.telemetry.totalMs/1000).toFixed(1)} s · {message.telemetry.officialSources} fuentes oficiales · {message.telemetry.caseDocuments} documentos del caso</p><small>{message.telemetry.promptVersion} · Coste no disponible. Estos datos no miden exactitud jurídica.</small></details> : null}
                  {!message.streaming && !message.error && message.content ? (
                    <div className="responseActions">
                      <small className="responseActionsHint">Acciones sobre esta respuesta</small>
                      <button
                        className="responseActionButton compactAction"
                        onClick={() => void copyMessage(message)}
                        title="Copia solo el texto de la respuesta"
                        type="button"
                      >
                        {copiedId === message.id ? <Check size={16} /> : <Clipboard size={16} />}
                        {copiedId === message.id ? "Copiado" : "Copiar"}
                      </button>
                      <details className="chatMoreActions"><summary>Más acciones</summary><div className="chatMoreActionsBody">
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
                      </div></details>
                      <SaveButton
                        itemType="mensaje"
                        messageId={message.persistedId ?? undefined}
                        title={message.content.slice(0, 120)}
                        label="Guardar"
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
                <>
                  <p>{message.content}</p>
                  {message.caseContext && Object.values(message.caseContext).some(Boolean) ? (
                    <details className="chatTurnContext">
                      <summary>Contexto utilizado</summary>
                      <p>Régimen: {message.caseContext.regime || "No indicado"}</p>
                      <p>Objeto: {message.caseContext.object || "No indicado"}</p>
                      <p>Fechas: {message.caseContext.dates || "No indicadas"}</p>
                      <p>Hechos: {message.caseContext.facts || "No indicados"}</p>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}

        {error ? <p className="formMessage errorText">{error}</p> : null}
        <div ref={timelineEndRef} aria-hidden="true" />
      </div>
  );

  return (
    <div className="legalTool chatRedesign chatAccessible">
      <LegalCenterNav active="chat" filters={{ ...currentFilterValues, ...extendedFilters }} />
      <div className="chatUtilityRow"><LegalChatRecent /><span>Tu historial y los archivos del caso son privados.</span></div>
      <div className="chatReadingLayout"><div className="chatMainColumn">
      <header className="chatHeader">
        <div className="chatHeaderTitle">
          <div className="legalToolIcon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="eyebrow">Consulta legal</p>
            <h2>Conversemos sobre tu consulta</h2>
            <p>Escribe tu duda. Revisa la respuesta y las normas que la sustentan.</p>
          </div>
        </div>
        <button className="secondaryButton compactButton" disabled={loadingSession || isStreaming} onClick={resetChat} type="button">
          <RotateCcw size={16} />
          Nueva consulta
        </button>
      </header>

      <div className="chatContextBar">
        <details className="chatStyleDisclosure"><summary>Personalizar respuesta</summary><div className="styleSelectors">
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

        </details><div className="filterArea">
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
            Afinar búsqueda{activeFilters.length ? ` · ${activeFilters.length}` : ""}
          </button>

          {showFilters ? (
            <div className="filterPopover">
              <p>Opcional. Limita los documentos que se consultarán; puedes preguntar sin completar estos campos.</p>
              <ExtendedLegalFilterControls value={extendedFilters} onChange={value => { setExtendedFilters(value); if(value.documentTypes?.length) setDocumentType(""); if(value.years?.length) setYear(""); }} />
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

      {hasConversation ? conversation : null}

      <div className="chatComposeTools">
      <CaseAttachments sessionId={sessionId} onSession={setSessionId} onBusy={setAttachmentsBusy} selected={attachmentIds} onChange={setAttachmentIds} disabled={isStreaming || loadingSession} />
      <section className="chatCaseContext" aria-label="Contexto del caso">
        <details>
          <summary>Añadir datos del caso · opcional</summary>
          <p>Indica lo que conoces. Si aún no sabes el régimen o las fechas, puedes dejar esos campos vacíos.</p>
          <fieldset disabled={isStreaming || loadingSession}>
            <label>Régimen aplicable
              <input maxLength={200} placeholder="Indica el régimen o escribe No determinado" value={caseContext.regime}
                onChange={(event) => setCaseContext((current) => ({ ...current, regime: event.target.value }))} />
            </label>
            <label>Objeto contractual
              <input maxLength={400} placeholder="Bienes, servicios, obra o consultoría; describe qué se contrata" value={caseContext.object ?? ""}
                onChange={event => setCaseContext(current => ({ ...current, object: event.target.value }))} />
            </label>
            <label>Fechas relevantes
              <textarea rows={2} maxLength={1000} placeholder="Fecha de convocatoria, contrato u otros hitos del caso" value={caseContext.dates}
                onChange={(event) => setCaseContext((current) => ({ ...current, dates: event.target.value }))} />
            </label>
            <label>Hechos del caso
              <textarea rows={3} maxLength={6000} placeholder="Describe qué ocurrió y qué necesitas resolver. Evita datos personales innecesarios." value={caseContext.facts}
                onChange={(event) => setCaseContext((current) => ({ ...current, facts: event.target.value }))} />
            </label>
          </fieldset>
        </details>
        <p className="chatEvidenceRule">Solo fuentes disponibles · citas de documento y página · información faltante explícita.</p>
        {loadingSession ? <p role="status">Recuperando conversación…</p> : null}
      </section>
      </div>
      <form className="chatComposerBar" onSubmit={submitQuestion}>
        <label className="chatQuestionLabel" htmlFor="legal-chat-question">¿Qué necesitas resolver?</label>
        <textarea
          id="legal-chat-question"
          aria-describedby="chat-question-help"
          onChange={(event) => {
            setQuestion(event.target.value);
            autoGrow(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSubmit) {
                void submitQuestion();
              }
            }
          }}
          placeholder="Por ejemplo: ¿qué documentos necesito revisar para este caso?"
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
            Enviar consulta
          </button>
        )}
        <small id="chat-question-help" className="chatQuestionHelp">Enter para enviar · Mayús + Enter para otra línea. Comprueba las normas antes de tomar una decisión.</small>
      </form>
      {!hasConversation ? conversation : null}
      </div>
      <aside className="chatNormsRail" aria-label="Normas de la última respuesta">
        <details open={wideChat || undefined}><summary><FileText size={18} /> Normas de la respuesta</summary>
          <p>Abre una norma para comprobar el fragmento y acceder al PDF.</p>
          {(() => { const latest = [...messages].reverse().find(item => item.role === "assistant" && !item.streaming); const sources = latest?.sources ?? []; return sources.length ? groupSourcesByDocument(sources).map(({document, sources: related}) => <button type="button" className="chatNormCard" key={document.documentId} onClick={() => setSelectedReferences(related.map(source => ({number:sources.indexOf(source)+1,source,paragraphText:latest?.questionText ?? ""})))}><FileText size={18} /><span><strong>{document.documentTitle}</strong><small>{consultedFragments(related.length)} · Revisar norma</small></span></button>) : <div className="chatNormsEmpty"><ShieldCheck size={26} /><strong>Aquí podrás comprobar las normas</strong><span>Después de consultar, verás los documentos encontrados. Si no hay evidencia suficiente, ACE debe indicarlo.</span></div>; })()}
          <p className="chatRailNote">Los archivos que adjuntas son documentos del caso; no acreditan una regla jurídica.</p>
        </details>
      </aside></div>

      <Dialog.Root open={Boolean(selectedReferences)} onOpenChange={(open) => !open && setSelectedReferences(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="sourceModal chatSourceSheet">
            <Dialog.Title>
              {selectedReferences && selectedReferences.length > 1
                ? `Fuentes ${selectedReferences.map((reference) => reference.number).join(", ")}`
                : `Fuente ${selectedReferences?.[0]?.number ?? ""}`}
            </Dialog.Title>
            <Dialog.Description>Revisa el texto original, su ubicación y el PDF antes de usar esta información.</Dialog.Description>
            <Dialog.Close className="chatSourceClose" aria-label="Cerrar normas y volver al chat"><X size={20} /></Dialog.Close>
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
