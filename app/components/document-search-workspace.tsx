"use client";

import Link from "next/link";
import { legalCenterHref } from "@/lib/legal-center";
import { lexicalTopic } from "@/lib/search-discovery";
import { SearchDiscovery } from "./search-discovery";
import { VoiceSearch } from "./voice-search";
import { SearchAssistant } from "./search-assistant";
import { readableSearchPreview } from "@/lib/search-assistant";
import { documentSearchRequestSchema } from "@/lib/document-search";
import { readSearchSession, searchSessionKey, sameSearchInput } from "@/lib/document-search-session";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileSearch,
  FileText,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { LegalCenterNav } from "./legal-center-nav";
import {
  ExtendedLegalFilterControls,
  LegalSearchHistory,
} from "./legal-workspace-tools";
import { SaveButton } from "./save-button";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { extendedFiltersFromParams } from "@/lib/legal-workspace-filters";
import {
  documentSearchFiltersSchema,
  literalMatchParts, allWordsMatchParts,
  searchObjects,
  searchSubjects,
  searchTopics,
  type DocumentSearchFilters,
  type DocumentSearchInput,
  type DocumentSearchResponse,
  type DocumentSearchResult,
  type SearchClassification,
} from "@/lib/document-search";

type CatalogueEntry = {
  title: string; documentNumber?: string | null;
  documentId: string;
  dates?: { published: string | null; updated: string | null; imported: string | null; version: string | null };
  documentType: string;
  regime?: string;
  year: number | null;
  entity: string | null;
  processType: string | null;
  classification: SearchClassification;
};
type HistoryEntry = {
  query: string;
  filters: Record<string, unknown>;
  searchMode?: "literal" | "all_words" | "semantic";
  sort?: DocumentSearchInput["sort"];
  pageSize?: 5 | 10 | 20;
};
function filterDisplayValue(key:string,value:unknown):string {
  if(Array.isArray(value)) return value.map(item=>filterDisplayValue(key==="documentTypes"?"documentType":key==="years"?"year":key,item)).join(", ");
  if(key==="documentType") return documentTypeLabel(String(value));
  if(key==="processType") return processTypeLabel(String(value)) || String(value);
  if(key==="object") return searchObjects.find(item=>item.value===value)?.label ?? String(value);
  if(key==="subject") return searchSubjects.find(item=>item.value===value)?.label ?? String(value);
  if(key==="guidedTopic") return searchTopics.find(item=>item.value===value)?.label ?? String(value);
  if(typeof value==="boolean") return value?"Incluido":"No incluido";
  return String(value);
}
const initialFilters = (params: { get: (key: string) => string | null }) =>
  documentSearchFiltersSchema.parse({
    ...extendedFiltersFromParams(params),
    ...Object.fromEntries(
      [
        "publishedFrom",
        "publishedTo",
        "documentId",
        "documentType",
        "article",
        "sourceEntity",
        "processType",
        "year",
        "topic",
        "vigencia",
        "status",
      ].map((key) => [key, params.get(key) ?? undefined]),
    ),
  });
function Excerpt({
  text,
  query,
  literal, words = false,
}: {
  text: string;
  query: string;
  literal: boolean; words?: boolean;
}) {
  text = readableSearchPreview(text);
  const parts = literal
    ? literalMatchParts(text, query)
    : words ? allWordsMatchParts(text, query) : [{ text, match: false }];
  const first = parts.findIndex((p) => p.match);
  // Keep the first match in view, while preserving original text and React escaping.
  const before =
    first > 0
      ? parts
          .slice(0, first)
          .map((p) => p.text)
          .join("")
      : "";
  const start = Math.max(0, before.length - 180);
  const window = text.slice(start, start + 420);
  return (
    <p className="documentMatchText">
      {start > 0 ? "… " : ""}
      {(literal
        ? literalMatchParts(window, query)
        : words ? allWordsMatchParts(window, query) : [{ text: window, match: false }]
      ).map((part, i) =>
        part.match ? (
          <mark key={i}>{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
      {start + 420 < text.length ? " …" : ""}
    </p>
  );
}
function DocumentCard({
  document,
  query,
  mode,
  article,
  onChat,
  busy, selected, onSelect, selectionFull,
}: {
  document: DocumentSearchResult;
  query: string;
  mode: DocumentSearchInput["mode"];
  article?: string;
  onChat: () => void;
  busy: boolean;
  selected: boolean; onSelect: () => void; selectionFull: boolean;
}) {
  const [matches, setMatches] = useState(document.matches);
  const [noMoreMatches,setNoMoreMatches]=useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function more() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/search/documents/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.documentId,
          query,
          offset: matches.length,
          article,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      const newMatches=(data.matches as typeof matches).filter(item=>!matches.some(current=>current.chunkId===item.chunkId));
      if(!newMatches.length) {setNoMoreMatches(true);setError("No se recuperaron más pasajes en esta consulta. Puedes revisar el documento completo en el PDF.");}
      setMatches(current=>[...current,...newMatches]);
    } catch {
      setError(
        "No se pudieron cargar más coincidencias. Reintenta o abre el PDF.",
      );
    } finally {
      setLoading(false);
    }
  }
  const firstPage = matches[0]?.pageStart;
  const objects = searchObjects
    .filter((item) => document.classification.objects.includes(item.value))
    .map((item) => item.label);
  const subjects = searchSubjects
    .filter((item) => document.classification.subjects.includes(item.value))
    .map((item) => item.label);
  return (
    <article className="documentResult">
      <label className="documentSelect"><input type="checkbox" checked={selected} disabled={!selected && selectionFull} onChange={onSelect} /> Seleccionar para consultar con IA · hasta 8</label>
      <div className="documentResultMeta">
        <span>{documentTypeLabel(document.documentType)}</span>
        <span>{document.sourceEntity || "Entidad sin registrar"}</span>
        <span>
          {document.publication
            ? document.publication.length === 4
              ? `Año registrado: ${document.publication}`
              : `Publicación: ${document.publication}`
            : "Fecha sin registrar"}
        </span>
      </div>
      <h3>
        <FileText size={20} aria-hidden="true" />
        {document.title}
      </h3>
      {document.dates?.updated ? <small>Texto actualizado: {document.dates.updated} · </small> : null}
      {document.dates?.imported ? <small>Incorporado: {document.dates.imported}</small> : null}
      {document.dates?.version ? <small className="documentVersion">Versión: {document.dates.version}</small> : null}
      {document.versionNote ? <p className="documentSearchHint">{document.versionNote}</p> : null}
      {document.relatedVersions?.length ? <details className="documentVersions"><summary>Otras versiones ({document.relatedVersions.length})</summary>{document.relatedVersions.map(version => <Link key={version.documentId} href={legalCenterHref("normas",{documentId:version.documentId,documentType:document.documentType})}>{version.title}</Link>)}<small>La versión más reciente no confirma su aplicación al caso.</small></details> : null}
      <div className="documentResultTags">
        <span
          className={`legalValidity ${document.validity.state === "current" ? "neutral" : document.validity.tone}`}
          title="Estado registrado; no confirma aplicabilidad al caso."
        >
          {document.validity.state === "current" ? "Registro: vigente · verificar revisión" : document.validity.label}
        </span>
        {objects.length || subjects.length ? (
          <span>
            {[...objects, ...subjects].join(" · ")}
            {document.classification.origin === "suggested"
              ? " · clasificación orientativa"
              : ""}
          </span>
        ) : (
          <span>Clasificación pendiente</span>
        )}
      </div>
      {document.review ? <details className="documentReviewDetails"><summary>Régimen y revisión de esta versión</summary><p>{document.review.regime ? `Régimen registrado: ${document.review.regime}. ` : "Régimen sin identificar. "}{document.review.method}.</p>{document.review.evidence ? <p>Identificado en: {document.review.evidence}</p> : null}<p>{document.review.reviewer}{document.review.reviewedAt ? ` · ${document.review.reviewedAt.slice(0,10)}` : " · fecha sin registrar"}.</p><p>Registro de vigencia: {document.review.validityRecord}. {document.review.validityReview}</p><p>Las fechas de publicación, actualización e incorporación corresponden solo a esta versión.</p></details> : null}
      <p className="documentWhy">
        {mode === "literal" && !document.matchCount && document.titleMatch ? "Coincidencia con el número o título del documento" : document.foundBy?.length ? `Encontrado por ${document.foundBy.map(method=>method==="words"?"palabras":"significado o referencias").join(" y ")} · ${matches.length} pasajes disponibles` : mode === "literal"
          ? `${document.matchCount} ${document.matchCount===1?"fragmento":"fragmentos"} con la frase${document.titleMatch ? " · también coincide el título" : ""}`
          : `${document.matchCount} ${document.matchCount===1?"pasaje recuperado":"pasajes recuperados"}${mode==="all_words"?" con las palabras indicadas":" por significado"}`}
      </p>
      {matches[0] ? (
        <Excerpt
          text={matches[0].excerpt}
          query={mode === "semantic" ? lexicalTopic(query) : query}
          literal={mode === "literal"} words={mode !== "literal"}
        />
      ) : (
        <p className="documentMatchText">
          La coincidencia está en el título o en el texto agregado del
          documento. No se ha localizado una página exacta para esta frase.
        </p>
      )}
      {firstPage ? <small className="documentPassagePage">Pasaje en página {firstPage}{matches[0]?.pageEnd && matches[0].pageEnd!==firstPage ? `–${matches[0].pageEnd}` : ""}</small> : null}
      <div className="documentResultActions">
        <PdfCiteButton documentId={document.documentId} page={firstPage} sidePanel quote={mode === "literal" ? query : matches[0]?.excerpt} label="Leer PDF" />
        <button
          className="secondaryButton"
          type="button"
          onClick={onChat}
          disabled={busy}
        >
          <MessageSquareText size={17} />
          {busy ? "Abriendo chat…" : "Consultar en Chat"}
        </button>
        <Link className="secondaryButton" href={legalCenterHref("normas",{documentId:document.documentId,documentType:document.documentType})}>Ver en Normativa</Link>
        <SaveButton
          itemType="documento"
          documentId={document.documentId}
          title={document.title}
        />
      </div>
      <details className="documentSecondaryActions">
        <summary>Más opciones del documento</summary>
        <div>
          <Link
            href={`/normas?documentId=${document.documentId}&documentType=${document.documentType}`}
          >
            Explorar en Normativa
          </Link>
          <Link href={`/validar?documentId=${document.documentId}`}>
            Validar procedimiento
          </Link>
          <Link
            href={`/comparar?documentIdA=${document.documentId}&documentTypeA=${document.documentType}`}
          >
            Comparar con otro documento
          </Link>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  `${document.title}${firstPage ? ` · página ${firstPage}` : ""}\n${document.matches[0]?.excerpt ?? ""}`,
                )
                .then(() => setCopied(true))
                .catch(() =>
                  setError(
                    "No se pudo copiar. Selecciona el texto del fragmento para copiarlo manualmente.",
                  ),
                );
            }}
          >
            {copied ? "Fuente copiada" : "Copiar fuente"}
          </button>
        </div>
      </details>
      <details className="documentMatches">
        <summary>Ver coincidencias y páginas · {document.matchCount}</summary>
        {matches.map((match, index) => (
          <section key={match.chunkId} className="documentMatch">
            <div className="documentMatchTop">
              <strong>Coincidencia {index + 1}</strong>
              <span>
                {match.pageStart
                  ? `Página ${match.pageStart}${match.pageEnd && match.pageEnd !== match.pageStart ? `–${match.pageEnd}` : ""}`
                  : "Página no identificada"}
              </span>
            </div>
            <Excerpt
              text={match.excerpt}
              query={mode === "semantic" ? lexicalTopic(query) : query}
              literal={mode === "literal"} words={mode !== "literal"}
            />
            <div className="documentMatchActions">
              <PdfCiteButton
                documentId={document.documentId}
                page={match.pageStart}
                quote={mode === "literal" ? query : match.excerpt}
                label="Revisar fragmento en PDF"
              />
              <Link
                href={`/normas?documentId=${document.documentId}&documentType=${document.documentType}`}
              >
                Ver en Normativa
              </Link>
            </div>
          </section>
        ))}
        {mode === "literal" && !noMoreMatches && matches.length < document.matchCount ? (
          <button
            type="button"
            className="secondaryButton"
            onClick={() => void more()}
            disabled={loading}
          >
            {loading
              ? "Cargando…"
              : `Ver más coincidencias (${matches.length} de ${document.matchCount})`}
          </button>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <small>
          El número cuenta fragmentos indexados; un fragmento puede contener la
          frase varias veces o solaparse con otro.
        </small>
      </details>
    </article>
  );
}

export function DocumentSearchWorkspace({ ownerId }: { ownerId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const storageKey = searchSessionKey(ownerId, params.toString());
  const [savedSearch, setSavedSearch] = useState<ReturnType<typeof readSearchSession>>(null);
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [mode, setMode] = useState<DocumentSearchInput["mode"]>("literal");
  const [filters, setFilters] = useState<DocumentSearchFilters>(() => {
    try {
      return initialFilters(params);
    } catch {
      return {};
    }
  });
  const [sort, setSort] = useState<DocumentSearchInput["sort"]>("relevance");
  const [pageSize, setPageSize] = useState<5 | 10 | 20>(10);
  const [result, setResult] = useState<DocumentSearchResponse | null>(null);
  const [lastInput, setLastInput] = useState<DocumentSearchInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const [chatBusy, setChatBusy] = useState("");
  const [selected, setSelected] = useState<Array<{documentId: string; title: string}>>([]);
  const [expandCorpus, setExpandCorpus] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const filtersRef = useRef<HTMLDetailsElement>(null);
  const restoredScroll = useRef<number | null>(null);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [libraryCoverage,setLibraryCoverage]=useState<{registered:number;indexed:number;uploaded:number;processing:number;failed:number;publicationDatesKnown:number;textIndexDocuments:number}|null>(null);
  const [coverageWarning,setCoverageWarning]=useState("");
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search/catalogue", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        setLibraryCoverage(data.coverage ?? null);setCoverageWarning(data.coverageWarning ?? "");setCatalogue(data.documents ?? []); setCatalogueReady(true);
        setCatalogueError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          { setCatalogueError("No se pudo cargar la clasificación disponible."); setCatalogueReady(true); }
      });
    return () => controller.abort();
  }, [catalogueRevision]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    const id = params.get("messageId");
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/search/context?messageId=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        setQuery(data.query ?? "");
        setFilters(documentSearchFiltersSchema.parse(data.filters ?? {}));
        setMode("semantic");
        setResult(null);
        setLastInput(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("No se pudo recuperar la consulta privada del chat.");
      });
    return () => controller.abort();
  }, [params]);
  function changeFilters(patch: Partial<DocumentSearchFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }
  function restore(entry: HistoryEntry) {
    activeRequest.current?.abort();
    requestSequence.current++;
    setLoading(false);
    setQuery(entry.query);
    setFilters(documentSearchFiltersSchema.parse(entry.filters ?? {}));
    setMode(entry.searchMode ?? "semantic");
    setSort(entry.sort ?? "relevance");
    setPageSize(entry.pageSize ?? 10);
    setResult(null);
    setLastInput(null);
    setError("");
    inputRef.current?.focus();
  }
  const currentInput: DocumentSearchInput = {
    query: query.trim(),
    mode,
    sort,
    pageSize,
    page: 1,
    filters,
  };
  const dirty = Boolean(
    lastInput &&
      !sameSearchInput(lastInput, currentInput),
  );
  useEffect(() => {
    if (result && !dirty && document.activeElement !== inputRef.current) {
      resultsRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [result, dirty]);
  useEffect(()=>{
    const receive=(event:Event)=>{const parsed=documentSearchRequestSchema.safeParse((event as CustomEvent).detail);if(parsed.success){setQuery(parsed.data.query);setMode(parsed.data.mode);setFilters(parsed.data.filters);void run(1,parsed.data);}};
    window.addEventListener("ace:search-request",receive);
    return ()=>window.removeEventListener("ace:search-request",receive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey]);
  async function run(page = 1, override?: DocumentSearchInput) {
    setShowSuggestions(false);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestSequence.current;
    const input = { ...(override ?? currentInput), page };
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/search/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "No se pudo completar la búsqueda.");
      if (sequence !== requestSequence.current) return;
      setResult(data);
      setLastInput(input);
      try { sessionStorage.setItem(storageKey, JSON.stringify({version:1, savedAt:Date.now(), input, selected, scroll:0})); } catch { /* Storage may be disabled; search remains usable. */ }
      if (restoredScroll.current !== null) { const y=restoredScroll.current; restoredScroll.current=null; requestAnimationFrame(() => window.scrollTo(0,y)); }
      if (page === 1) setHistoryRevision((value) => value + 1);
    } catch (e) {
      if (
        e instanceof Error &&
        e.name !== "AbortError" &&
        sequence === requestSequence.current
      ) {
        setError(e.message);
        setResult(null);
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled=false;
    void Promise.resolve().then(() => {
    try {
      const snapshot = readSearchSession(sessionStorage.getItem(storageKey));
      if (!snapshot || cancelled) return;
      // A fresh visit stays blank. Restoring previous work requires an explicit action.
      setSavedSearch(snapshot);
    } catch { /* Invalid or unavailable storage starts an empty search. */ }
    });
    return () => { cancelled=true; };
    // Offer previous work for this owner/context without changing the initial query.
  }, [storageKey]);
  useEffect(() => {
    const save = () => {
      if (!lastInput) return;
      try { sessionStorage.setItem(storageKey, JSON.stringify({version:1,savedAt:Date.now(),input:lastInput,selected,scroll:window.scrollY})); } catch { /* Optional continuity only. */ }
    };
    window.addEventListener("pagehide",save);
    return () => { save(); window.removeEventListener("pagehide",save); };
  }, [storageKey,lastInput,selected]);
  useEffect(()=>{
    if (!mobileFilters) return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    filtersRef.current?.querySelector<HTMLElement>("button")?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==="Escape") {event.preventDefault();setMobileFilters(false);return;}
      if(event.key!=="Tab") return;
      const items=[...(filtersRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,summary,[tabindex="0"]') ?? [])].filter(item=>item.getClientRects().length);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",keys);
    return()=>{document.removeEventListener("keydown",keys);document.body.style.overflow=overflow;previous?.focus();};
  },[mobileFilters]);
  async function chatSelection() {
    if (!selected.length) return;
    setChatBusy("selection"); setError("");
    try {
      const response=await fetch("/api/search/handoff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        question:`Revisa ${selected.map(item=>`«${item.title}»`).join("; ")} para esta consulta: ${lastInput?.query ?? query}. ${expandCorpus ? "Puedes ampliar con otras fuentes disponibles; distingue expresamente las fuentes añadidas." : "Usa exclusivamente los documentos seleccionados."} Cita documento y página e indica los límites.`,
        filters:expandCorpus ? {} : {documentIds:selected.map(item=>item.documentId)},
      })});
      const data=await response.json(); if (!response.ok) throw new Error();
      router.push(`/chat?sessionId=${data.sessionId}`);
    } catch { setError("No se pudo abrir la selección en el chat. Reintenta."); }
    finally { setChatBusy(""); }
  }
  async function openChat(document: DocumentSearchResult) {
    setChatBusy(document.documentId);
    setError("");
    try {
      const response = await fetch("/api/search/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Explica qué información aporta el documento «${document.title}» sobre: ${lastInput?.query ?? query}. Usa solo las fuentes disponibles, cita documento y página e indica qué falta.`,
          filters: {
            ...(lastInput?.filters ?? filters),
            documentId: document.documentId,
            documentType: document.documentType,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      router.push(`/chat?sessionId=${data.sessionId}`);
    } catch {
      setError("No se pudo abrir la consulta en el chat. Reintenta.");
    } finally {
      setChatBusy("");
    }
  }
  const objectRows = catalogue.filter(
    (row) =>
      !filters.object ||
      (filters.object === "sin_clasificar"
        ? !row.classification.objects.length
        : row.classification.objects.includes(filters.object)),
  );
  const subjectRows = objectRows.filter(
    (row) =>
      !filters.subject ||
      (filters.subject === "sin_clasificar"
        ? !row.classification.subjects.length
        : row.classification.subjects.includes(filters.subject)),
  );
  const count = (
    rows: CatalogueEntry[],
    key: "objects" | "subjects" | "topics",
    value: string,
  ) =>
    rows.filter((row) =>
      value === "sin_clasificar"
        ? !row.classification[key].length
        : row.classification[key].includes(value),
    ).length;
  const activeFilters = Object.entries(filters).filter(([, value]) =>
    Array.isArray(value) ? value.length : Boolean(value),
  );
  const primaryFilters = (
<div className="documentPrimaryFilters">            <label>
              Tipo de documento
              <select
                value={filters.documentType ?? ""}
                onChange={(e) =>
                  changeFilters({
                    documentType: e.target.value,
                    documentTypes: undefined,
                  })
                }
              >
                <option value="">Todos los tipos</option>
                {OFFICIAL_CORPUS_TYPES.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}{catalogueReady ? ` (${catalogue.filter(row=>row.documentType===item.value).length} en biblioteca)` : ""}
                  </option>
                ))}
              </select>
            </label><label>Régimen<select value={filters.regime ?? ""} onChange={e=>changeFilters({regime:e.target.value as DocumentSearchFilters["regime"]})}><option value="">Todos los regímenes</option><option value="32069">Ley 32069{catalogueReady ? ` (${catalogue.filter(row=>row.regime==="32069").length} en biblioteca)` : ""}</option><option value="30225">Ley 30225{catalogueReady ? ` (${catalogue.filter(row=>row.regime==="30225").length} en biblioteca)` : ""}</option><option value="especial">Régimen especial{catalogueReady ? ` (${catalogue.filter(row=>row.regime==="especial").length} en biblioteca)` : ""}</option><option value="no_determinado">Sin régimen revisado{catalogueReady ? ` (${catalogue.filter(row=>row.regime==="no_determinado").length} en biblioteca)` : ""}</option></select></label>            <label>
              Fecha · año registrado
              <select
                value={filters.year ?? ""}
                onChange={(e) =>
                  changeFilters({
                    year: e.target.value ? Number(e.target.value) : "",
                    years: undefined,
                  })
                }
              >
                <option value="">Todos los años</option>
                {[
                  ...new Set(
                    catalogue
                      .map((row) => row.year)
                      .filter((v): v is number => v !== null),
                  ),
                ]
                  .sort((a, b) => b - a)
                  .map((value) => (
                    <option key={value} value={value}>
                      {value} ({catalogue.filter(row=>row.year===value).length} en biblioteca)
                    </option>
                  ))}
              </select>
            </label></div>
  );
  return (
    <div className="documentSearchWorkspace">
      <LegalCenterNav active="busqueda" filters={filters} />
      <section className={`documentSearchIntro${result ? " compactSearchIntro" : ""}`}>
        <div>
        <span className="documentSearchEyebrow">TU BIBLIOTECA JURÍDICA</span>
        <h2>Encuentra el documento que necesitas</h2>
        <p>
          Busca una frase conocida o describe lo que necesitas. Revisa las
          coincidencias y consulta el original.
        </p>
        </div>
      <SearchAssistant ownerId={ownerId} onApply={input=>{setQuery(input.query);setMode(input.mode);setFilters(input.filters);void run(1,input);}} />
      </section>

      <form
        className="documentSearchForm"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void run();
        }}
      >
        <div
          className="documentSearchModes"
          role="radiogroup"
          aria-label="Cómo quieres buscar"
        >
          {(
            [
              {
                value: "literal",
                label: "Tengo palabras o un número",
                hint: "Encuentra una frase, palabras o un documento conocido.",
              },
              {
                value: "semantic",
                label: "Quiero describir un tema",
                hint: "Combina palabras y significado para encontrar fuentes.",
              },
            ] as const
          ).map((item) => (
            <label
              key={item.value}
              className="documentSearchModeOption"
            >
              <input type="radio" name="search-intent" value={item.value} checked={item.value === "literal" ? mode !== "semantic" : mode === item.value} onChange={() => {
                activeRequest.current?.abort();
                requestSequence.current++;
                setLoading(false);
                setMode(item.value);
                setResult(null);
                setLastInput(null);
                setError("");
              }} />
              <Search size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </label>
          ))}
        </div>
        <label htmlFor="document-search-query">
          Busca una norma, un número o describe tu tema
        </label>
        <div className="documentSearchComposer">
          <textarea
            id="document-search-query"
            ref={inputRef}
            maxLength={mode !== "semantic" ? 500 : 8000}
            rows={2}
            value={query}
            onChange={(event) => {setQuery(event.target.value);setFilters(current=>({...current,documentId:undefined}));setShowSuggestions(true);}}
            placeholder={
              mode !== "semantic"
                ? "Por ejemplo: perfeccionamiento del contrato"
                : "Por ejemplo: documentos que debe presentar el proveedor antes de firmar"
            }
            aria-describedby="document-search-hint"
            onFocus={()=>setShowSuggestions(true)}
            onKeyDown={event=>{if(event.key==="Escape")setShowSuggestions(false);}}
          />
          <VoiceSearch filters={filters} onApply={input=>{setQuery(input.query);setMode(input.mode);setFilters(input.filters);void run(1,input);}} />
          <button
            className="primaryButton"
            type="submit"
            disabled={
              loading ||
              query.trim().length < (mode !== "semantic" ? 2 : 5) ||
              query.length > (mode !== "semantic" ? 500 : 8000)
            }
          >
            {loading ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Search size={18} />
            )}{" "}
            {loading ? "Buscando…" : "Buscar documentos"}
          </button>
        </div>
        <SearchDiscovery query={query} filters={filters} visible={showSuggestions} onCorrect={corrected=>{setQuery(corrected);setFilters(current=>({...current,documentId:undefined}));inputRef.current?.focus();}} onChoose={document=>{const next={...currentInput,query:document.title,mode:"literal" as const,filters:{...filters,documentId:document.documentId}};setQuery(document.title);setMode("literal");setFilters(next.filters);setShowSuggestions(false);void run(1,next);}} />
        <p id="document-search-hint" className="documentSearchHint">
          {mode !== "semantic"
            ? (mode === "all_words" ? "Se exigen todas las palabras en el mismo documento. Usa hasta diez palabras de al menos dos caracteres; pueden aparecer en pasajes distintos." : "Se ignoran mayúsculas, tildes y espacios repetidos. También puedes escribir un número documental o Artículo seguido del número.")
            : "Se combinan palabras y significado con tus filtros. La lista es una selección de resultados, no un conteo completo del catálogo."}
        </p>
        {mode !== "semantic" ? <label className="documentLiteralChoice">Buscar como<select aria-label="Buscar como" value={mode} onChange={event=>setMode(event.target.value as "literal"|"all_words")}><option value="literal">Frase exacta o número documental</option><option value="all_words">Todas estas palabras</option></select></label> : null}
        <details className="searchPublicationRange"><summary>Fecha de publicación original</summary><label>Desde<input type="date" value={filters.publishedFrom ?? ""} onChange={e=>setFilters(current=>({...current,publishedFrom:e.target.value}))}/></label><label>Hasta<input type="date" min={filters.publishedFrom || undefined} value={filters.publishedTo ?? ""} onChange={e=>setFilters(current=>({...current,publishedTo:e.target.value}))}/></label><small>Incluye solo documentos con fecha de publicación original registrada.</small></details>
        {!mobileFilters ? primaryFilters : null}
        <button type="button" className="secondaryButton mobileFilterToggle" onClick={()=>{setMobileFilters(true); if(filtersRef.current) filtersRef.current.open=true;}}>Más filtros</button>
        <details ref={filtersRef} role={mobileFilters?"dialog":undefined} aria-modal={mobileFilters||undefined} aria-label={mobileFilters?"Filtros de búsqueda":undefined} className={`documentSearchFilters${mobileFilters ? " mobileOpen" : ""}`}>
          <div className="mobileFilterHeader"><strong>Filtros</strong><button type="button" onClick={()=>setMobileFilters(false)} aria-label="Cerrar filtros">×</button></div>{mobileFilters ? primaryFilters : null}
          <summary>
            <SlidersHorizontal size={17} />
            Más filtros
            {activeFilters.length
              ? ` · ${activeFilters.length} ${activeFilters.length===1?"ajuste":"ajustes"}`
              : " · opcional"}
          </summary>
          <h3>Clasificación guiada</h3>
          <p>
            Los números indican documentos disponibles en el catálogo, no
            resultados de esta consulta. Las sugerencias por título y tema son
            orientativas.
          </p>
          {catalogueError ? (
            <p role="alert">
              {catalogueError}{" "}
              <button
                type="button"
                onClick={() => setCatalogueRevision((v) => v + 1)}
              >
                Reintentar
              </button>
            </p>
          ) : null}
          <div className="documentFilterGrid">
            <label>
              Objeto
              <select
                value={filters.object ?? ""}
                onChange={(e) =>
                  changeFilters({
                    object: e.target.value,
                    subject: "",
                    guidedTopic: "",
                  })
                }
              >
                <option value="">Todos los objetos</option>
                {searchObjects.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({count(catalogue, "objects", item.value)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Materia
              <select
                value={filters.subject ?? ""}
                onChange={(e) =>
                  changeFilters({ subject: e.target.value, guidedTopic: "" })
                }
              >
                <option value="">Todas las materias</option>
                {searchSubjects.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({count(objectRows, "subjects", item.value)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tema
              <select
                value={filters.guidedTopic ?? ""}
                onChange={(e) => changeFilters({ guidedTopic: e.target.value })}
              >
                <option value="">Todos los temas</option>
                {searchTopics
                  .filter(
                    (item) =>
                      !filters.subject ||
                      item.value === "sin_clasificar" ||
                      item.subject === filters.subject,
                  )
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label} ({count(subjectRows, "topics", item.value)})
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <h3>Datos del documento</h3>
          <div className="documentFilterGrid">

            <label>
              Entidad
              <select
                value={filters.sourceEntity ?? ""}
                onChange={(e) =>
                  changeFilters({ sourceEntity: e.target.value })
                }
              >
                <option value="">Todas las entidades</option>
                {[
                  ...new Set(
                    catalogue
                      .map((row) => row.entity)
                      .filter((v): v is string => Boolean(v)),
                  ),
                ]
                  .sort()
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                {filters.sourceEntity &&
                !catalogue.some((r) => r.entity === filters.sourceEntity) ? (
                  <option>{filters.sourceEntity}</option>
                ) : null}
              </select>
            </label>

            <label>
              Vigencia registrada
              <select
                value={filters.vigencia ?? ""}
                onChange={(e) => changeFilters({ vigencia: e.target.value })}
              >
                <option value="">Cualquier estado</option>
                <option value="vigente">Vigente según registro</option>
                <option value="no vigente">No vigente</option>
                <option value="derogado">Derogado</option>
                <option value="unknown">Sin confirmar o por revisar</option>
              </select>
            </label>
            <label>
              Artículo
              <input
                value={filters.article ?? ""}
                maxLength={50}
                onChange={(e) => changeFilters({ article: e.target.value })}
                placeholder="Opcional"
              />
            </label>
            <label>
              Tipo de proceso
              <select
                value={filters.processType ?? ""}
                onChange={(e) => changeFilters({ processType: e.target.value })}
              >
                <option value="">Todos los procesos</option>
                {[
                  ...new Set(
                    catalogue
                      .map((row) => row.processType)
                      .filter((v): v is string => Boolean(v)),
                  ),
                ]
                  .sort()
                  .map((value) => (
                    <option key={value} value={value}>{value === "todos" ? "Aplicación general" : processTypeLabel(value) || value}</option>
                  ))}
                {filters.processType &&
                !catalogue.some(
                  (r) => r.processType === filters.processType,
                ) ? (
                  <option>{filters.processType}</option>
                ) : null}
              </select>
            </label>
            <label>
              Texto del tema
              <input
                maxLength={250}
                value={filters.topic ?? ""}
                onChange={(e) => changeFilters({ topic: e.target.value })}
                placeholder="Opcional"
              />
            </label>
          </div>
          <ExtendedLegalFilterControls hideRegime
            value={filters}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                documentTypes: undefined,
                years: undefined,
                regime: undefined,
                includeUnknownRegime: undefined,
                ...value,
                ...(value.documentTypes?.length ? { documentType: "" } : {}),
                ...(value.years?.length ? { year: "" as const } : {}),
              }))
            }
          />
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setFilters({})}
          >
            Quitar todos los filtros
          </button>
          <div className="mobileFilterFooter"><button type="button" className="secondaryButton" onClick={()=>setFilters({})}>Restablecer</button><button type="button" className="primaryButton" onClick={()=>{setMobileFilters(false); if(filtersRef.current) filtersRef.current.open=false; void run();}}>Aplicar filtros</button></div>
        </details>
        {activeFilters.length ? (
          <div className="documentActiveFilters">
            {filters.documentId ? (
              <span>
                Documento seleccionado{" "}
                <button
                  type="button"
                  aria-label="Quitar documento seleccionado"
                  onClick={() => changeFilters({ documentId: "" })}
                >
                  <X size={14} />
                </button>
              </span>
            ) : null}
            {activeFilters.filter(([key])=>key!=="documentId").map(([key,value])=><span key={key}>{({publishedFrom:"Publicación desde",publishedTo:"Publicación hasta",documentType:"Tipo",year:"Año",regime:"Régimen",object:"Objeto",subject:"Materia",guidedTopic:"Tema",sourceEntity:"Entidad",article:"Artículo",vigencia:"Vigencia",documentTypes:"Tipos",years:"Años",includeUnknownRegime:"Sin régimen revisado",processType:"Proceso",topic:"Tema",status:"Estado"} as Record<string,string>)[key] ?? key}: {filterDisplayValue(key,value)} <button type="button" aria-label={`Quitar filtro ${filterDisplayValue(key,value)}`} onClick={()=>setFilters(current=>{const next={...current}; delete next[key as keyof DocumentSearchFilters];return next;})}><X size={14}/></button></span>)}
            <button type="button" onClick={() => setFilters({})}>
              Quitar filtros
            </button>
          </div>
        ) : null}
      </form>
      <div className="documentLibraryTools">
      <LegalSearchHistory revision={historyRevision} onRestore={restore} />
      {savedSearch && !lastInput && !query ? <button type="button" className="secondaryButton" onClick={()=>{setQuery(savedSearch.input.query);setMode(savedSearch.input.mode);setFilters(savedSearch.input.filters);setSort(savedSearch.input.sort);setPageSize(savedSearch.input.pageSize);setSelected(savedSearch.selected);restoredScroll.current=savedSearch.scroll;void run(savedSearch.input.page,savedSearch.input);setSavedSearch(null);}}>Retomar búsqueda anterior</button> : null}
      <details className="documentCoverage"><summary>Cobertura de la biblioteca · {catalogueError ? "No disponible" : catalogueReady ? `${catalogue.length} documentos indexados` : "Cargando…"}</summary>{libraryCoverage?<p>Registrados: {libraryCoverage.registered} · Indexados: {libraryCoverage.indexed} · En procesamiento: {libraryCoverage.processing} · Por procesar: {libraryCoverage.uploaded} · Con error: {libraryCoverage.failed}. Publicación original registrada: {libraryCoverage.publicationDatesKnown}. Índice de texto: {libraryCoverage.textIndexDocuments} documentos.</p>:null}{coverageWarning?<p role="status">{coverageWarning}</p>:null}<p>Solo se buscan documentos institucionales con texto indexado. El catálogo puede no incluir todos los documentos publicados.</p>{OFFICIAL_CORPUS_TYPES.map(type=><span key={type.value}>{type.label}: {catalogue.filter(row=>row.documentType===type.value).length || "Sin documentos indexados"} </span>)}</details>
      </div>
      {error ? (
        <p className="documentSearchError" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="documentSearchStatus" role="status">
          {result ? "Buscando documentos. Puedes seguir revisando los resultados anteriores." : "Buscando coincidencias en los documentos disponibles…"}
        </p>
      ) : null}
      {selected.length ? <section className="documentSelection" aria-label="Fuentes seleccionadas"><strong>{selected.length} de 8 documentos seleccionados</strong><div>{selected.map(item=><span key={item.documentId}>{item.title}<button type="button" aria-label={`Quitar ${item.title}`} onClick={()=>setSelected(current=>current.filter(row=>row.documentId!==item.documentId))}>×</button></span>)}</div><label><input type="checkbox" checked={expandCorpus} onChange={event=>setExpandCorpus(event.target.checked)}/> Permitir que el chat amplíe la búsqueda con otras fuentes</label><p>{expandCorpus?"El chat podrá consultar otras fuentes del corpus.":"El chat usará solo los documentos seleccionados."}</p><button type="button" className="primaryButton" disabled={Boolean(chatBusy)} onClick={()=>void chatSelection()}>Consultar selección con IA</button><button type="button" onClick={()=>setSelected([])}>Vaciar selección</button></section> : null}
      {result ? (
        <section
          ref={resultsRef}
          style={{ scrollMarginTop: 64 }}
          className="documentSearchResults"
          aria-label="Resultados de búsqueda"
          aria-busy={loading}
        >
          {result.partialRetrieval ? <div className="documentSearchHint" role="status"><strong>Búsqueda parcial.</strong> Una parte de la recuperación no estuvo disponible. Los resultados pueden estar incompletos. Reintenta o revisa «Alcance de esta búsqueda».</div> : null}
          <div className="documentResultsHeading">
            <div>
              <h2>
                {result.totalDocuments}{" "}
                {result.scope === "catalogue"
                  ? (result.totalDocuments===1 ? "documento con coincidencias" : "documentos con coincidencias")
                  : (result.totalDocuments===1 ? "documento recuperado" : "documentos recuperados")}
              </h2>
              <p>
                Para «{lastInput?.query}» ·{" "}
                {result.mode === "literal" ? "frase exacta" : result.mode === "all_words" ? "todas las palabras" : "palabras y significado"}
              </p>
            </div>
            <div className="documentResultOrdering">
              <label>
                Ordenar
                <select
                  disabled={loading || dirty}
                  value={sort}
                  onChange={(e) => {
                    const next = e.target.value as DocumentSearchInput["sort"];
                    setSort(next);
                    if (lastInput) void run(1, { ...lastInput, sort: next });
                  }}
                >
                  <option value="relevance">Relevancia</option>
                  <option value="newest">Fecha más reciente</option>
                  <option value="oldest">Fecha más antigua</option>
                </select>
              </label>
              <label>
                Por página
                <select
                  disabled={loading || dirty}
                  value={pageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value) as 5 | 10 | 20;
                    setPageSize(next);
                    if (lastInput)
                      void run(1, { ...lastInput, pageSize: next });
                  }}
                >
                  {[5, 10, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} documentos
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {dirty && !loading ? (
            <p className="documentSearchPending" role="status">
              Has cambiado la consulta o los filtros. Pulsa «Buscar documentos»
              para aplicarlos.
            </p>
          ) : null}
          <p className="documentSearchHint">
            Cada tarjeta representa un documento. Las fechas desconocidas se
            muestran al final; el año registrado no confirma régimen ni
            vigencia.
          </p>
          {result.scope === "retrieved" ? <p className="documentScopeNote">Lista por relevancia, no exhaustiva. El orden por fecha se aplica solo a estos documentos recuperados.</p> : null}
          {result.historyWarning ? (
            <p role="status">{result.historyWarning}</p>
          ) : null}
          {result.documents.map((document) => (
            <DocumentCard
              key={`${lastInput?.mode}:${lastInput?.query}:${lastInput?.filters.article ?? ""}:${document.documentId}`}
              document={document}
              query={lastInput?.query ?? ""}
              mode={result.mode}
              article={lastInput?.filters.article}
              onChat={() => void openChat(document)}
              busy={chatBusy === document.documentId}
              selectionFull={selected.length>=8}
              selected={selected.some(item=>item.documentId===document.documentId)}
              onSelect={()=>setSelected(current=>current.some(item=>item.documentId===document.documentId)?current.filter(item=>item.documentId!==document.documentId):current.length<8?[...current,{documentId:document.documentId,title:document.title}]:current)}
            />
          ))}
          {!result.documents.length ? (
            <div className="documentSearchEmpty">
              <FileSearch size={28} />
              <h3>Sin coincidencias con estos criterios</h3>
              <SearchDiscovery query={lastInput?.query ?? query} filters={lastInput?.filters ?? filters} visible={!loading && !dirty} correctionOnly onChoose={()=>{}} onCorrect={corrected=>{const next={...(lastInput ?? currentInput),query:corrected};setQuery(corrected);void run(1,next);}} />
              <p>
                Prueba una frase más corta, cambia de modo o quita filtros.{" "}
                {result.scope === "retrieved"
                  ? "Este modo no revisa exhaustivamente todo el catálogo."
                  : "Solo se ha consultado el texto indexado del corpus institucional."}
              </p>
              <div className="documentEmptyActions">
                {result.mode === "literal" ? <button type="button" className="secondaryButton" onClick={()=>{const next={...(lastInput ?? currentInput),mode:"all_words" as const};setMode("all_words");void run(1,next);}}>Buscar todas las palabras</button> : null}
                {activeFilters.length ? <button type="button" className="secondaryButton" onClick={()=>{const next={...(lastInput ?? currentInput),filters:{}};setFilters({});void run(1,next);}}>Buscar sin filtros</button> : null}
              </div>
            </div>
          ) : null}
          {result.pages > 1 ? (
            <nav
              className="documentPagination"
              aria-label="Páginas de documentos"
            >
              <button
                type="button"
                className="secondaryButton"
                disabled={loading || dirty || result.page <= 1}
                onClick={() =>
                  lastInput && void run(result.page - 1, lastInput)
                }
              >
                <ChevronLeft size={17} />
                Anterior
              </button>
              <span>
                Página {result.page} de {result.pages}
              </span>
              <button
                type="button"
                className="secondaryButton"
                disabled={loading || dirty || result.page >= result.pages}
                onClick={() =>
                  lastInput && void run(result.page + 1, lastInput)
                }
              >
                Siguiente
                <ChevronRight size={17} />
              </button>
            </nav>
          ) : null}
          <details className="documentSearchLimits">
            <summary>Alcance de esta búsqueda</summary>
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <p>
              Las etiquetas orientativas se obtienen del título y el tema
              registrado, no de una revisión jurídica. La relevancia no mide
              exactitud legal.
            </p>
          </details>
        </section>
      ) : !loading ? (
        <div className="documentSearchEmpty">
          <FileSearch size={30} />
          <strong>Empieza con una frase o una pregunta</strong>
          <p>
            Después podrás abrir el documento, revisar sus páginas o consultar
            sus fuentes con la IA.
          </p>
        </div>
      ) : null}
    </div>
  );
}
