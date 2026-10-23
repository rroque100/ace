"use client";

import Link from "next/link";
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
import { documentTypeLabel } from "@/lib/legal-taxonomy";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { extendedFiltersFromParams } from "@/lib/legal-workspace-filters";
import {
  documentSearchFiltersSchema,
  literalMatchParts,
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
  documentType: string;
  year: number | null;
  entity: string | null;
  processType: string | null;
  classification: SearchClassification;
};
type HistoryEntry = {
  query: string;
  filters: Record<string, unknown>;
  searchMode?: "literal" | "semantic";
  sort?: DocumentSearchInput["sort"];
  pageSize?: 5 | 10 | 20;
};
const initialFilters = (params: { get: (key: string) => string | null }) =>
  documentSearchFiltersSchema.parse({
    ...extendedFiltersFromParams(params),
    ...Object.fromEntries(
      [
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
  literal,
}: {
  text: string;
  query: string;
  literal: boolean;
}) {
  const parts = literal
    ? literalMatchParts(text, query)
    : [{ text, match: false }];
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
  const window = text.slice(start, start + 1100);
  return (
    <p className="documentMatchText">
      {start > 0 ? "… " : ""}
      {(literal
        ? literalMatchParts(window, query)
        : [{ text: window, match: false }]
      ).map((part, i) =>
        part.match ? (
          <mark key={i}>{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
      {start + 1100 < text.length ? " …" : ""}
    </p>
  );
}
function DocumentCard({
  document,
  query,
  mode,
  article,
  onChat,
  busy,
}: {
  document: DocumentSearchResult;
  query: string;
  mode: DocumentSearchInput["mode"];
  article?: string;
  onChat: () => void;
  busy: boolean;
}) {
  const [matches, setMatches] = useState(document.matches);
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
      setMatches((current) => [...current, ...data.matches]);
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
      <div className="documentResultTags">
        <span
          className={`legalValidity ${document.validity.tone}`}
          title="Estado registrado; no confirma aplicabilidad al caso."
        >
          {document.validity.label}
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
      <p className="documentWhy">
        {mode === "literal"
          ? `${document.matchCount} fragmento(s) con la frase${document.titleMatch ? " · también coincide el título" : ""}`
          : `${document.matchCount} fragmento(s) recuperados por significado`}
      </p>
      {matches[0] ? (
        <Excerpt
          text={matches[0].excerpt}
          query={query}
          literal={mode === "literal"}
        />
      ) : (
        <p className="documentMatchText">
          La coincidencia está en el título o en el texto agregado del
          documento. No se ha localizado una página exacta para esta frase.
        </p>
      )}
      <div className="documentResultActions">
        <a
          className="primaryButton"
          href={`/api/documents/${document.documentId}${firstPage ? `#page=${firstPage}` : ""}`}
          target="_blank"
          rel="noreferrer"
        >
          <FileSearch size={17} />
          Abrir documento
        </a>
        <button
          className="secondaryButton"
          type="button"
          onClick={onChat}
          disabled={busy}
        >
          <MessageSquareText size={17} />
          {busy ? "Abriendo chat…" : "Consultar con IA"}
        </button>
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
              query={query}
              literal={mode === "literal"}
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
        {mode === "literal" && matches.length < document.matchCount ? (
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

export function DocumentSearchWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
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
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search/catalogue", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        setCatalogue(data.documents ?? []);
        setCatalogueError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setCatalogueError("No se pudo cargar la clasificación disponible.");
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
      JSON.stringify({ ...lastInput, page: 1 }) !==
        JSON.stringify(currentInput),
  );
  async function run(page = 1, override?: DocumentSearchInput) {
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
  return (
    <div className="documentSearchWorkspace">
      <LegalCenterNav active="busqueda" filters={filters} />
      <LegalSearchHistory revision={historyRevision} onRestore={restore} />
      <section className="documentSearchIntro">
        <span className="documentSearchEyebrow">TU BIBLIOTECA JURÍDICA</span>
        <h2>Encuentra el documento que necesitas</h2>
        <p>
          Busca una frase conocida o describe lo que necesitas. Revisa las
          coincidencias y consulta el original.
        </p>
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
          role="group"
          aria-label="Cómo quieres buscar"
        >
          {(
            [
              {
                value: "literal",
                label: "Palabras o frase",
                hint: "Busca la frase exacta en el texto indexado.",
              },
              {
                value: "semantic",
                label: "Por significado",
                hint: "Encuentra documentos relacionados con tu pregunta.",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={mode === item.value}
              onClick={() => {
                activeRequest.current?.abort();
                requestSequence.current++;
                setLoading(false);
                setMode(item.value);
                setResult(null);
                setLastInput(null);
                setError("");
              }}
            >
              <Search size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>
        <label htmlFor="document-search-query">
          {mode === "literal"
            ? "¿Qué palabras o frase debe contener?"
            : "¿Sobre qué necesitas información?"}
        </label>
        <div className="documentSearchComposer">
          <textarea
            id="document-search-query"
            ref={inputRef}
            maxLength={mode === "literal" ? 500 : 8000}
            rows={2}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === "literal"
                ? "Por ejemplo: perfeccionamiento del contrato"
                : "Por ejemplo: documentos que debe presentar el proveedor antes de firmar"
            }
            aria-describedby="document-search-hint"
          />
          <button
            className="primaryButton"
            type="submit"
            disabled={
              loading ||
              query.trim().length < (mode === "literal" ? 2 : 5) ||
              query.length > (mode === "literal" ? 500 : 8000)
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
        <p id="document-search-hint" className="documentSearchHint">
          {mode === "literal"
            ? "No necesitas comillas ni confirmar con Enter. Se ignoran mayúsculas, tildes y espacios repetidos; la frase conserva el orden de sus palabras."
            : "Los resultados se eligen por relevancia. No representan todas las coincidencias del catálogo."}
        </p>
        <details className="documentSearchFilters">
          <summary>
            <SlidersHorizontal size={17} />
            Afinar búsqueda
            {activeFilters.length
              ? ` · ${activeFilters.length} ajustes`
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
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
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
              Año registrado
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
                      {value}
                    </option>
                  ))}
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
                    <option key={value}>{value}</option>
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
          <ExtendedLegalFilterControls
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
            <span>{activeFilters.length} ajuste(s) de búsqueda</span>
            <button type="button" onClick={() => setFilters({})}>
              Quitar filtros
            </button>
          </div>
        ) : null}
      </form>
      {error ? (
        <p className="documentSearchError" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="documentSearchStatus" role="status">
          Buscando documentos. Puedes seguir revisando los resultados
          anteriores.
        </p>
      ) : null}
      {result ? (
        <section
          className="documentSearchResults"
          aria-label="Resultados de búsqueda"
          aria-busy={loading}
        >
          <div className="documentResultsHeading">
            <div>
              <h2>
                {result.totalDocuments}{" "}
                {result.scope === "catalogue"
                  ? "documento(s) con coincidencias"
                  : "documento(s) recuperado(s)"}
              </h2>
              <p>
                Para «{lastInput?.query}» ·{" "}
                {result.mode === "literal" ? "frase exacta" : "por significado"}
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
          {dirty ? (
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
            />
          ))}
          {!result.documents.length ? (
            <div className="documentSearchEmpty">
              <FileSearch size={28} />
              <h3>Sin coincidencias con estos criterios</h3>
              <p>
                Prueba una frase más corta, cambia de modo o quita filtros.{" "}
                {result.scope === "retrieved"
                  ? "Este modo no revisa exhaustivamente todo el catálogo."
                  : "Solo se ha consultado el texto indexado del corpus institucional."}
              </p>
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
