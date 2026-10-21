"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitCompare,
  Library,
  LoaderCircle,
  MessageSquareText,
  Network,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DOCUMENT_TYPES, documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { SaveButton } from "./save-button";
import { processLabelFromOptions, useSettingsCatalog } from "./use-settings-catalog";

type Category = "normas" | "jurisprudencia";

type NormSummary = {
  id: string;
  title: string;
  documentType: string;
  sourceEntity: string | null;
  processType: string | null;
  status: string;
  articleCount: number;
  documentNumber: string | null;
  vigencia: string | null;
  topic: string | null;
  year: number | null;
  amends: string | null;
  concordanceCount: number;
  hasSummary: boolean;
  pagesDetected: number;
  pineconeVerified: boolean;
  qualityStatus: "lista" | "revisar";
  vectorCount: number;
};

type Article = {
  id: string;
  articleNumber: string;
  label: string | null;
  sectionTitle: string | null;
  ordinal: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  status: string | null;
  vigencia: string | null;
};

type Concordancia = {
  id: string;
  refType: string | null;
  relationType?: string | null;
  refDocumentNumber: string | null;
  refArticleNumber: string | null;
  rawText: string;
  resolved: boolean;
  targetDocumentId: string | null;
  targetDocumentTitle: string | null;
  targetArticleId: string | null;
  targetArticleNumber: string | null;
};

type Citing = {
  id: string;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  sourceArticleId: string | null;
  sourceArticleNumber: string | null;
  rawText: string;
};

type NormDetail = {
  norm: NormSummary & { summary: string | null };
  articles: Article[];
  concordanciasByArticle: Record<string, Concordancia[]>;
};

type SemanticSource = {
  article: string | null;
  chunkId: string;
  citation: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  pageStart: number | null;
  score: number;
};

type VersionGroup = {
  key: string;
  documents: Array<{
    amends: string | null;
    documentType: string;
    id: string;
    status: string | null;
    title: string;
    vigencia: string | null;
    year: number | null;
  }>;
  hasAmendments: boolean;
  latestYear: number;
  title: string;
  total: number;
};

function isNotCurrent(vigencia?: string | null, status?: string | null) {
  const text = `${vigencia ?? ""} ${status ?? ""}`.toLowerCase();
  return text.includes("derog") || text.includes("modific");
}

function classifyConcordance(rawText: string, refType?: string | null, relationType?: string | null) {
  const relationLabels: Record<string, string> = {
    complementa: "Complementa",
    concordancia: "Concordancia",
    deroga: "Deroga",
    modifica: "Modifica",
    reglamenta: "Reglamenta",
    remite: "Remite",
  };

  if (relationType && relationLabels[relationType]) {
    return relationLabels[relationType];
  }

  const text = `${refType ?? ""} ${rawText}`.toLowerCase();
  if (text.includes("derog")) return "Deroga";
  if (text.includes("modific")) return "Modifica";
  if (text.includes("reglament")) return "Reglamenta";
  if (text.includes("remit") || text.includes("conforme") || text.includes("segun")) return "Remite";
  if (text.includes("complement")) return "Complementa";
  return "Concordancia";
}

function articleBrief(article: Article) {
  const firstSentence = article.content
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+/)
    .find((sentence) => sentence.length > 35);
  return firstSentence?.slice(0, 280) ?? article.content.slice(0, 280);
}

function extractLegalReading(article: Article) {
  const sentences = article.content
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const requirementTerms = ["debe", "deben", "oblig", "requisito", "condicion", "corresponde", "presenta", "cumpl"];
  const riskTerms = ["salvo", "excepto", "bajo responsabilidad", "nulidad", "improced", "prohib", "no puede", "sin perjuicio"];

  return {
    requirements: sentences.filter((sentence) => requirementTerms.some((term) => sentence.toLowerCase().includes(term))).slice(0, 4),
    risks: sentences.filter((sentence) => riskTerms.some((term) => sentence.toLowerCase().includes(term))).slice(0, 4),
    summary: articleBrief(article),
  };
}

export function NormativeBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processTypes } = useSettingsCatalog();
  const labelProcessType = (value?: string | null) => processLabelFromOptions(processTypes, value) ?? processTypeLabel(value);
  const targetDocumentId = searchParams.get("documentId");
  const targetArticle = searchParams.get("article");
  const [category, setCategory] = useState<Category>("normas");
  const [norms, setNorms] = useState<NormSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(targetDocumentId);
  const [detail, setDetail] = useState<NormDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleFilter, setArticleFilter] = useState("");
  const [onlyVigente, setOnlyVigente] = useState(false);
  const [citing, setCiting] = useState<Citing[]>([]);
  const [error, setError] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState(searchParams.get("documentType") ?? "");
  const [processTypeFilter, setProcessTypeFilter] = useState(searchParams.get("processType") ?? "");
  const [sourceEntityFilter, setSourceEntityFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [vigenciaFilter, setVigenciaFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticSources, setSemanticSources] = useState<SemanticSource[]>([]);
  const [versions, setVersions] = useState<VersionGroup[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadNorms() {
      setLoadingList(true);
      setError("");

      try {
        const params = new URLSearchParams({ category });
        if (documentTypeFilter) params.set("documentType", documentTypeFilter);
        if (processTypeFilter) params.set("processType", processTypeFilter);
        if (sourceEntityFilter) params.set("sourceEntity", sourceEntityFilter);
        if (yearFilter) params.set("year", yearFilter);
        if (vigenciaFilter) params.set("vigencia", vigenciaFilter);
        if (topicFilter) params.set("topic", topicFilter);

        const response = await fetch(`/api/norms?${params.toString()}`);
        const payload = (await response.json()) as { norms?: NormSummary[]; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "No se pudieron cargar las normas.");
          setNorms([]);
          return;
        }

        setNorms(payload.norms ?? []);
        if (targetDocumentId && (payload.norms ?? []).some((norm) => norm.id === targetDocumentId)) {
          void selectNorm(targetDocumentId);
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo conectar con el servidor.");
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    void loadNorms();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, documentTypeFilter, processTypeFilter, sourceEntityFilter, targetDocumentId, topicFilter, vigenciaFilter, yearFilter]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/norms/versions")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setVersions(payload.versions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectNorm(id: string, targetArticleId?: string) {
    setSelectedId(id);
    setDetail(null);
    setSelectedArticleId(null);
    setArticleFilter("");
    setOnlyVigente(false);
    setSemanticSources([]);
    setSemanticQuery("");
    setLoadingDetail(true);

    try {
      const response = await fetch(`/api/norms/${id}`);
      const payload = (await response.json()) as NormDetail & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar la norma.");
        return;
      }

      setDetail(payload);
      const target = targetArticleId
        ? payload.articles.find((article) => article.id === targetArticleId)
        : undefined;
      const targetByNumber = targetArticle
        ? payload.articles.find((article) => article.articleNumber === targetArticle)
        : null;
      setSelectedArticleId(target?.id ?? targetByNumber?.id ?? payload.articles[0]?.id ?? null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoadingDetail(false);
    }
  }

  function navigateToArticleRef(documentId: string | null, articleId: string | null) {
    if (!documentId) {
      return;
    }

    if (documentId === selectedId) {
      if (articleId) {
        setArticleFilter("");
        setOnlyVigente(false);
        setSelectedArticleId(articleId);
      }
      return;
    }

    void selectNorm(documentId, articleId ?? undefined);
  }

  function navigateToConcordancia(concordancia: Concordancia) {
    if (!concordancia.resolved || !concordancia.targetDocumentId) {
      return;
    }

    navigateToArticleRef(concordancia.targetDocumentId, concordancia.targetArticleId);
  }

  const visibleArticles = useMemo(() => {
    if (!detail) {
      return [];
    }

    const needle = articleFilter.trim().toLowerCase();

    return detail.articles.filter((article) => {
      if (onlyVigente && isNotCurrent(article.vigencia, article.status)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return (
        article.articleNumber.toLowerCase().includes(needle) ||
        (article.label ?? "").toLowerCase().includes(needle) ||
        article.content.toLowerCase().includes(needle)
      );
    });
  }, [detail, articleFilter, onlyVigente]);

  const selectedArticle = useMemo(
    () => visibleArticles.find((article) => article.id === selectedArticleId) ?? visibleArticles[0] ?? null,
    [visibleArticles, selectedArticleId],
  );

  const selectedArticleId2 = selectedArticle?.id ?? null;

  useEffect(() => {
    if (!selectedArticleId2) {
      return;
    }

    let cancelled = false;
    fetch(`/api/norms/articles/${selectedArticleId2}/citing`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setCiting(payload.citing ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCiting([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedArticleId2]);

  const articleConcordancias = selectedArticle
    ? detail?.concordanciasByArticle?.[selectedArticle.id] ?? []
    : [];
  const selectedReading = selectedArticle ? extractLegalReading(selectedArticle) : null;
  const selectedVersionGroup = detail
    ? versions.find((group) => group.documents.some((document) => document.id === detail.norm.id)) ?? null
    : null;
  const currentVersionDocument = selectedVersionGroup?.documents.find((document) => document.id === detail?.norm.id) ?? null;
  const hasModifiedArticle = selectedArticle
    ? isNotCurrent(selectedArticle.vigencia, selectedArticle.status) || Boolean(detail?.norm.amends)
    : false;

  function sendArticleToChat(article: Article, intent = "explica su alcance, requisitos, limites y aplicacion practica") {
    if (!detail) {
      return;
    }

    const prompt = `Sobre ${detail.norm.title}, articulo ${article.articleNumber}: ${intent}. Usa solo este documento y articulo como fuente principal.`;
    const params = new URLSearchParams({
      article: article.articleNumber,
      documentId: detail.norm.id,
      documentType: detail.norm.documentType,
      pregunta: prompt,
    });

    if (detail.norm.processType) {
      params.set("processType", detail.norm.processType);
    }

    router.push(`/chat?${params.toString()}`);
  }

  function compareArticle(article: Article) {
    if (!detail) return;
    const params = new URLSearchParams({
      documentIdA: detail.norm.id,
      topic: `${detail.norm.title} articulo ${article.articleNumber}`,
    });
    if (detail.norm.documentType) params.set("documentTypeA", detail.norm.documentType);
    if (detail.norm.processType) params.set("processType", detail.norm.processType);
    router.push(`/comparar?${params.toString()}`);
  }

  function validateArticle(article: Article) {
    if (!detail) return;
    const params = new URLSearchParams({
      article: article.articleNumber,
      documentId: detail.norm.id,
      pregunta: `Validar procedimiento considerando ${detail.norm.title}, articulo ${article.articleNumber}.`,
    });
    if (detail.norm.processType) params.set("processType", detail.norm.processType);
    router.push(`/validar?${params.toString()}`);
  }

  async function runSemanticSearch() {
    if (!detail || semanticQuery.trim().length < 5) {
      return;
    }

    setSemanticLoading(true);
    setSemanticSources([]);
    try {
      const response = await fetch(`/api/norms/${detail.norm.id}/semantic`, {
        body: JSON.stringify({ query: semanticQuery.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { sources?: SemanticSource[]; error?: string };
      if (response.ok) {
        setSemanticSources(payload.sources ?? []);
      } else {
        setError(payload.error ?? "No se pudo buscar dentro de la norma.");
      }
    } catch {
      setError("No se pudo conectar con el buscador semantico.");
    } finally {
      setSemanticLoading(false);
    }
  }

  function clearNormFilters() {
    setDocumentTypeFilter("");
    setProcessTypeFilter("");
    setSourceEntityFilter("");
    setYearFilter("");
    setVigenciaFilter("");
    setTopicFilter("");
  }

  function changeCategory(nextCategory: Category) {
    setCategory(nextCategory);
    setDocumentTypeFilter("");
    setSelectedId(null);
    setDetail(null);
    setSelectedArticleId(null);
    setCiting([]);
  }

  return (
    <div className="toolPanel normBrowser">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Base documental</p>
          <h2>Navegador normativo</h2>
        </div>
        <Library size={22} />
      </div>

      {/* Filtro de categoría sobre el mismo listado, no pestañas. */}
      <div className="sourceTabs normCategoryTabs" role="group" aria-label="Categoria">
        <button
          aria-pressed={category === "normas"}
          onClick={() => changeCategory("normas")}
          type="button"
        >
          Normas
        </button>
        <button
          aria-pressed={category === "jurisprudencia"}
          onClick={() => changeCategory("jurisprudencia")}
          type="button"
        >
          Jurisprudencia y opiniones
        </button>
      </div>

      <div className="normFilters">
        <label>
          <span>Tipo</span>
          <select onChange={(event) => setDocumentTypeFilter(event.target.value)} value={documentTypeFilter}>
            <option value="">Todos</option>
            {DOCUMENT_TYPES.filter((item) =>
              category === "normas"
                ? ["ley", "reglamento", "directiva"].includes(item.value)
                : ["resolucion", "opinion"].includes(item.value),
            ).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Proceso</span>
          <select onChange={(event) => setProcessTypeFilter(event.target.value)} value={processTypeFilter}>
            <option value="">Todos</option>
            {processTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Entidad</span>
          <input onChange={(event) => setSourceEntityFilter(event.target.value)} placeholder="OECE, MEF..." value={sourceEntityFilter} />
        </label>
        <label>
          <span>Año</span>
          <input inputMode="numeric" onChange={(event) => setYearFilter(event.target.value)} placeholder="2025" value={yearFilter} />
        </label>
        <label>
          <span>Vigencia</span>
          <input onChange={(event) => setVigenciaFilter(event.target.value)} placeholder="vigente" value={vigenciaFilter} />
        </label>
        <label>
          <span>Tema</span>
          <input onChange={(event) => setTopicFilter(event.target.value)} placeholder="procedimiento" value={topicFilter} />
        </label>
        <button className="secondaryButton compactButton" onClick={clearNormFilters} type="button">
          <RotateCcw size={15} />
          Limpiar
        </button>
      </div>

      {error ? <p className="formMessage errorText">{error}</p> : null}

      <div className="normGrid">
        <aside className="normList" aria-label="Listado de normas">
          {loadingList ? (
            <div className="emptyState">
              <LoaderCircle size={18} />
              <span>Cargando...</span>
            </div>
          ) : norms.length === 0 ? (
            <div className="emptyState">
              <ScrollText size={18} />
              <span>No hay documentos en esta categoria.</span>
            </div>
          ) : (
            norms.map((norm) => (
              <button
                key={norm.id}
                className={`normCard ${selectedId === norm.id ? "active" : ""}`}
                onClick={() => selectNorm(norm.id)}
                type="button"
              >
                <strong>{norm.title}</strong>
                <span className="normCardMeta">
                  {documentTypeLabel(norm.documentType)}
                  {norm.documentNumber ? ` · ${norm.documentNumber}` : ""}
                  {norm.year ? ` · ${norm.year}` : ""}
                </span>
                <span className="normCardTags">
                  <span className="normTag">{norm.articleCount} articulo(s)</span>
                  <span className={`normTag ${norm.pagesDetected > 0 ? "ok" : "warn"}`}>
                    {norm.pagesDetected} pag.
                  </span>
                  <span className={`normTag ${norm.pineconeVerified ? "ok" : "warn"}`}>
                    Pinecone {norm.pineconeVerified ? "ok" : "rev."}
                  </span>
                  <span className={`normTag ${norm.hasSummary ? "ok" : "warn"}`}>
                    Resumen {norm.hasSummary ? "si" : "no"}
                  </span>
                  <span className="normTag">{norm.concordanceCount} ref.</span>
                  {norm.vigencia ? (
                    <span className={`normTag ${isNotCurrent(norm.vigencia) ? "warn" : "ok"}`}>
                      {norm.vigencia}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="normDetail" aria-label="Detalle de la norma">
          {loadingDetail ? (
            <div className="emptyState">
              <LoaderCircle size={20} />
              <span>Cargando norma...</span>
            </div>
          ) : !detail ? (
            <div className="emptyState">
              <Library size={20} />
              <strong>Selecciona una norma</strong>
              <span>Elige un documento de la izquierda para leerlo por articulo.</span>
            </div>
          ) : (
            <>
              <header className="normDetailHeader">
                <div>
                  <p className="eyebrow">
                    {documentTypeLabel(detail.norm.documentType)}
                    {detail.norm.documentNumber ? ` · ${detail.norm.documentNumber}` : ""}
                    {labelProcessType(detail.norm.processType)
                      ? ` · ${labelProcessType(detail.norm.processType)}`
                      : ""}
                  </p>
                  <h3>{detail.norm.title}</h3>
                </div>
                <a
                  className="secondaryButton compactButton"
                  href={`/api/documents/${detail.norm.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={15} />
                  Abrir PDF
                </a>
              </header>

              {detail.norm.amends ? (
                <div className="normAmends">
                  <AlertTriangle size={15} />
                  <span>Relaciones de vigencia: {detail.norm.amends}</span>
                </div>
              ) : null}

              <div className="normQualityStrip">
                <span data-ready={detail.norm.articleCount > 0}>
                  <BookOpenCheck size={15} />
                  {detail.norm.articleCount} articulos
                </span>
                <span data-ready={detail.norm.pagesDetected > 0}>
                  <FileText size={15} />
                  {detail.norm.pagesDetected} paginas con cita
                </span>
                <span data-ready={detail.norm.concordanceCount > 0}>
                  <Network size={15} />
                  {detail.norm.concordanceCount} concordancias
                </span>
                <span data-ready={detail.norm.pineconeVerified}>
                  <ShieldCheck size={15} />
                  Pinecone {detail.norm.pineconeVerified ? "verificado" : "pendiente"}
                </span>
                <span data-ready={detail.norm.hasSummary}>
                  <CheckCircle2 size={15} />
                  Resumen {detail.norm.hasSummary ? "generado" : "pendiente"}
                </span>
              </div>

              {selectedVersionGroup ? (
                <div className="versionPanel">
                  <strong>Versionado normativo</strong>
                  <span>
                    {selectedVersionGroup.total} documento(s) relacionados · version mas reciente{" "}
                    {selectedVersionGroup.latestYear || "s/d"}
                  </span>
                  <div className="versionList">
                    {selectedVersionGroup.documents.map((document) => (
                      <button
                        className={`versionChip ${document.id === detail.norm.id ? "active" : ""} ${
                          isNotCurrent(document.vigencia, document.status) ? "warn" : ""
                        }`}
                        key={document.id}
                        onClick={() => selectNorm(document.id)}
                        type="button"
                      >
                        {document.year ?? "s/a"} · {document.vigencia ?? document.status ?? "vigencia s/d"}
                      </button>
                    ))}
                  </div>
                  {currentVersionDocument?.amends || hasModifiedArticle ? (
                    <small>
                      Advertencia: existen relaciones de modificacion o el articulo/documento requiere validar vigencia.
                    </small>
                  ) : null}
                </div>
              ) : null}

              {detail.articles.length === 0 ? (
                <div className="normJurisprudence">
                  {detail.norm.summary ? (
                    <p>{detail.norm.summary}</p>
                  ) : (
                    <p>Este documento no tiene articulos detectados. Abre el PDF para leerlo completo.</p>
                  )}
                  <button
                    className="secondaryButton compactButton"
                    onClick={() =>
                      router.push(
                        `/chat?pregunta=${encodeURIComponent(`Resume y explica ${detail.norm.title}`)}`,
                      )
                    }
                    type="button"
                  >
                    <MessageSquareText size={15} />
                    Consultar en el chat
                  </button>
                </div>
              ) : (
                <div className="articleLayout">
                  <div className="articleNavCol">
                    <label className="articleSearch">
                      <Search size={15} />
                      <input
                        onChange={(event) => setArticleFilter(event.target.value)}
                        placeholder="Buscar articulo o texto"
                        value={articleFilter}
                      />
                    </label>
                    <label className="vigenteToggle">
                      <input
                        checked={onlyVigente}
                        onChange={(event) => setOnlyVigente(event.target.checked)}
                        type="checkbox"
                      />
                      Solo vigente
                    </label>
                    <div className="semanticInNorm">
                      <label className="articleSearch">
                        <Sparkles size={15} />
                        <input
                          onChange={(event) => setSemanticQuery(event.target.value)}
                          placeholder="Buscar semantico en esta norma"
                          value={semanticQuery}
                        />
                      </label>
                      <button
                        className="secondaryButton compactButton"
                        disabled={semanticLoading || semanticQuery.trim().length < 5}
                        onClick={runSemanticSearch}
                        type="button"
                      >
                        {semanticLoading ? <LoaderCircle size={15} /> : <Search size={15} />}
                        Buscar
                      </button>
                    </div>
                    {semanticSources.length > 0 ? (
                      <div className="semanticNormResults">
                        {semanticSources.slice(0, 5).map((source) => (
                          <button
                            key={source.chunkId}
                            onClick={() => {
                              const match = detail.articles.find((article) => article.articleNumber === source.article);
                              if (match) setSelectedArticleId(match.id);
                            }}
                            type="button"
                          >
                            <strong>{source.article ? `Art. ${source.article}` : source.citation}</strong>
                            <span>{source.excerpt.slice(0, 110)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="articleIndex">
                      {visibleArticles.length === 0 ? (
                        <span className="articleIndexEmpty">Sin coincidencias</span>
                      ) : (
                        visibleArticles.map((article) => (
                          <button
                            key={article.id}
                            className={`articleChip ${
                              selectedArticle?.id === article.id ? "active" : ""
                            } ${isNotCurrent(article.vigencia, article.status) ? "warn" : ""}`}
                            onClick={() => setSelectedArticleId(article.id)}
                            type="button"
                          >
                            Art. {article.articleNumber}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <article className="articleReader">
                    {selectedArticle ? (
                      <>
                        <div className="articleReaderHeader">
                          <div>
                            {selectedArticle.sectionTitle ? (
                              <span className="articleSection">{selectedArticle.sectionTitle}</span>
                            ) : null}
                            <strong>Articulo {selectedArticle.articleNumber}</strong>
                          </div>
                          <div className="articleBadges">
                            {selectedArticle.pageStart ? (
                              <span className="normTag">
                                pag. {selectedArticle.pageStart}
                                {selectedArticle.pageEnd && selectedArticle.pageEnd !== selectedArticle.pageStart
                                  ? `-${selectedArticle.pageEnd}`
                                  : ""}
                              </span>
                            ) : null}
                            <span
                              className={`normTag ${
                                isNotCurrent(selectedArticle.vigencia, selectedArticle.status) ? "warn" : "ok"
                              }`}
                            >
                              {selectedArticle.vigencia ?? selectedArticle.status ?? "vigencia s/d"}
                            </span>
                          </div>
                        </div>

                        {isNotCurrent(selectedArticle.vigencia, selectedArticle.status) ? (
                          <div className="normAmends">
                            <AlertTriangle size={15} />
                            <span>
                              Este articulo figura como derogado o modificado; verifica la version vigente
                              antes de usarlo.
                            </span>
                          </div>
                        ) : null}

                        <p className="articleText">{selectedArticle.content}</p>

                        {selectedReading ? (
                          <div className="legalReadingPanel">
                            <div>
                              <strong>Resumen breve</strong>
                              <p>{selectedReading.summary}</p>
                            </div>
                            <div>
                              <strong>Requisitos o reglas detectadas</strong>
                              {selectedReading.requirements.length > 0 ? (
                                <ul>
                                  {selectedReading.requirements.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span>No se detectaron reglas textuales evidentes.</span>
                              )}
                            </div>
                            <div>
                              <strong>Riesgos de interpretacion</strong>
                              {selectedReading.risks.length > 0 ? (
                                <ul>
                                  {selectedReading.risks.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span>Sin alertas textuales automaticas; revisar contexto normativo.</span>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {articleConcordancias.length > 0 || citing.length > 0 ? (
                          <div className="concordanciaPanel">
                            {articleConcordancias.length > 0 ? (
                              <div className="concordanciaGroup">
                                <strong>Concordancias</strong>
                                <div className="concordanciaList">
                                  {articleConcordancias.map((concordancia) =>
                                    concordancia.resolved && concordancia.targetDocumentId ? (
                                      <button
                                        key={concordancia.id}
                                        className="concordanciaChip resolved"
                                        onClick={() => navigateToConcordancia(concordancia)}
                                        type="button"
                                        title={concordancia.rawText}
                                      >
                                        <span>{classifyConcordance(concordancia.rawText, concordancia.refType, concordancia.relationType)}</span>
                                        {concordancia.targetDocumentTitle ?? "Norma"}
                                        {concordancia.targetArticleNumber
                                          ? `, art. ${concordancia.targetArticleNumber}`
                                          : ""}
                                      </button>
                                    ) : (
                                      <span
                                        key={concordancia.id}
                                        className="concordanciaChip external"
                                        title={concordancia.rawText}
                                      >
                                        {classifyConcordance(concordancia.rawText, concordancia.refType, concordancia.relationType)} · {concordancia.rawText} · no indexada
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {citing.length > 0 ? (
                              <div className="concordanciaGroup">
                                <strong>Citado por</strong>
                                <div className="concordanciaList">
                                  {citing.map((item) => (
                                    <button
                                      key={item.id}
                                      className="concordanciaChip"
                                      onClick={() =>
                                        navigateToArticleRef(item.sourceDocumentId, item.sourceArticleId)
                                      }
                                      type="button"
                                      title={item.rawText}
                                    >
                                      <span>{classifyConcordance(item.rawText)}</span>
                                      {item.sourceDocumentTitle ?? "Norma"}
                                      {item.sourceArticleNumber ? `, art. ${item.sourceArticleNumber}` : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="sourceActions">
                          <PdfCiteButton
                            documentId={detail.norm.id}
                            page={selectedArticle.pageStart}
                            quote={selectedArticle.content}
                          />
                          <a
                            className="secondaryButton compactButton"
                            href={`/api/documents/${detail.norm.id}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <FileText size={15} />
                            Abrir PDF
                          </a>
                          <button
                            className="secondaryButton compactButton"
                            onClick={() => sendArticleToChat(selectedArticle)}
                            type="button"
                          >
                            <MessageSquareText size={15} />
                            Preguntar sobre este articulo
                          </button>
                          <button
                            className="secondaryButton compactButton"
                            onClick={() => validateArticle(selectedArticle)}
                            type="button"
                          >
                            <ShieldCheck size={15} />
                            Validar con este articulo
                          </button>
                          <button
                            className="secondaryButton compactButton"
                            onClick={() => compareArticle(selectedArticle)}
                            type="button"
                          >
                            <GitCompare size={15} />
                            Comparar articulo
                          </button>
                          <SaveButton
                            itemType="articulo"
                            documentId={detail.norm.id}
                            articleId={selectedArticle.id}
                            title={`${detail.norm.title} — Art. ${selectedArticle.articleNumber}`}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="emptyState">
                        <span>Selecciona un articulo del indice.</span>
                      </div>
                    )}
                  </article>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
