"use client";

import "./normative-browser.css";
import Link from "next/link";
import {DocumentValidityReview} from "./document-validity-review";
import type {ValidityRecord} from "@/lib/validity-review";
import {reviewedValidity} from "@/lib/validity-review";
import {resolveArticleIdentity} from "@/lib/normative-identity";
import {NormativeBodyReview} from "./normative-body-review";
import { ConcordanceReview } from "./concordance-review";
import { NormativeIndex } from "./normative-index";
import { legalCenterHref } from "@/lib/legal-center";
import { referenceReviewLabel, repeatedArticleNumbers } from "@/lib/normative-library";
import type { documentReviewSummary } from "@/lib/document-review";

import { ExtendedLegalFilterControls } from "./legal-workspace-tools";
import { extendedFiltersFromParams, type ExtendedLegalFilters } from "@/lib/legal-workspace-filters";
import { LegalCenterNav } from "./legal-center-nav";
import { LegalValidityBadge } from "./legal-validity-badge";
import { legalValidity } from "@/lib/legal-center";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitCompare,
  Library,
  LoaderCircle,
  MessageSquareText,
  Network,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DOCUMENT_TYPES, documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { corpusGroupForType, corpusTypesForGroup } from "@/lib/official-corpus";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { SaveButton } from "./save-button";
import { processLabelFromOptions, useSettingsCatalog } from "./use-settings-catalog";
import { stripPageMarkers } from "@/lib/page-markers";

type Category = "normas" | "jurisprudencia" | "orientacion";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «2008-09-01» → «1 sep 2008». Lo que no es una fecha ISO se devuelve tal cual. */
function formatNormDate(value?: string | null) {
  const match = (value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value ?? "";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** La «versión» a veces es el nombre del archivo subido («Archivo oficial 6682397-….pdf»): no se muestra. */
function readableVersion(value?: string | null) {
  if (!value || /[.](pdf|docx?)$/i.test(value.trim()) || /^archivo /i.test(value)) return "";
  return value;
}

type NormSummary = {
  review?: ReturnType<typeof documentReviewSummary>;
  sourceUrl?: string | null;
  dates?: {published:string|null;updated:string|null;imported:string|null;version:string|null};
  regime?: string | null;
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
  validityReview?:ValidityRecord|null;
  bodyId?:string;bodyTitle?:string;bodyReviewed?:boolean;bodyRevision?:number;version?:string|null;
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
  destinationCheck?:{valid:boolean;reason:string};
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
  canCorrectReferences?:boolean;
  warnings?: string[];
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
    dates?: {published:string|null;updated:string|null;imported:string|null;version:string|null};
    amends: string | null;
    documentType: string;
    id: string;
    status: string | null;
    title: string;
    vigencia: string | null;
    year: number | null;
  }>;
  hasAmendments: boolean;
  title: string;
  total: number;
};

function isNotCurrent(vigencia?: string | null, status?: string | null) {
  const text = `${vigencia ?? ""} ${status ?? ""}`.toLowerCase();
  return text.includes("derog") || text.includes("modific");
}

function classifyConcordance() { return "Referencia detectada"; }

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
  const targetArticleUuid = searchParams.get("articleId");
  const targetBodyId = searchParams.get("bodyId");
  const [category, setCategory] = useState<Category>(() => corpusGroupForType(searchParams.get("documentType") ?? "ley"));
  const [extendedFilters, setExtendedFilters] = useState<ExtendedLegalFilters>(() => extendedFiltersFromParams(searchParams));
  const [norms, setNorms] = useState<NormSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [reading, setReading] = useState(Boolean(targetDocumentId));
  const readingRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(targetDocumentId);
  const [detail, setDetail] = useState<NormDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleFilter, setArticleFilter] = useState("");
  // Con ancho suficiente el índice va al lado del texto y abierto; en pantallas estrechas empieza
  // plegado. Si la persona lo abre o lo cierra, manda su elección.
  const wideScreen = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 1180px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1180px)").matches,
    () => false,
  );
  const [articleNavChoice, setArticleNavChoice] = useState<boolean | null>(null);
  const articleNavOpen = articleNavChoice ?? wideScreen;
  const [onlyVigente, setOnlyVigente] = useState(false);
  const [citing, setCiting] = useState<Citing[]>([]);
  const [error, setError] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState(searchParams.get("documentType") ?? "");
  const [processTypeFilter, setProcessTypeFilter] = useState(searchParams.get("processType") ?? "");
  const [sourceEntityFilter, setSourceEntityFilter] = useState(searchParams.get("sourceEntity") ?? "");
  const [yearFilter, setYearFilter] = useState(searchParams.get("year") ?? "");
  const [vigenciaFilter, setVigenciaFilter] = useState(searchParams.get("vigencia") ?? "");
  const [topicFilter, setTopicFilter] = useState(searchParams.get("topic") ?? "");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticNotice, setSemanticNotice] = useState("");
  const [semanticSources, setSemanticSources] = useState<SemanticSource[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reviewEpoch,setReviewEpoch]=useState(0);
  const [pagination, setPagination] = useState({total:0,pages:0});
  const [facets, setFacets] = useState<{entities:string[];years:number[];categoryTotal:number}>({entities:[],years:[],categoryTotal:0});
  const [listWarnings, setListWarnings] = useState<string[]>([]);
  const [versionsError, setVersionsError] = useState("");
  const [citingError, setCitingError] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const detailSequence = useRef(0);
  const openedTarget = useRef<string|null>(null);
  const [versions, setVersions] = useState<VersionGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadNorms() {
      setLoadingList(true);
      setError("");

      try {
        const params = new URLSearchParams({ category, q:titleQuery, page:String(page) });
        if (extendedFilters.documentTypes?.length) params.set("documentTypes", extendedFilters.documentTypes.join(","));
        if (extendedFilters.years?.length) params.set("years", extendedFilters.years.join(","));
        if (extendedFilters.regime) params.set("regime", extendedFilters.regime);
        if (extendedFilters.includeUnknownRegime) params.set("includeUnknownRegime", "true");
        if (documentTypeFilter) params.set("documentType", documentTypeFilter);
        if (processTypeFilter) params.set("processType", processTypeFilter);
        if (sourceEntityFilter) params.set("sourceEntity", sourceEntityFilter);
        if (yearFilter) params.set("year", yearFilter);
        if (vigenciaFilter) params.set("vigencia", vigenciaFilter);
        if (topicFilter) params.set("topic", topicFilter);

        const response = await fetch(`/api/norms?${params.toString()}`,{signal:controller.signal});
        const payload = (await response.json()) as { norms?: NormSummary[]; error?: string; total:number;pages:number;warnings?:string[];facets:typeof facets };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "No se pudieron cargar las normas.");
          setNorms([]);
          return;
        }

        setNorms(payload.norms ?? []);
        setPagination({total:payload.total,pages:payload.pages});setFacets(payload.facets);setListWarnings(payload.warnings ?? []);

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

    const timer = setTimeout(()=>void loadNorms(),250);

    return () => {
      cancelled = true; controller.abort(); clearTimeout(timer);
    };
  }, [reviewEpoch,titleQuery,page,extendedFilters, category, documentTypeFilter, processTypeFilter, sourceEntityFilter, targetDocumentId, topicFilter, vigenciaFilter, yearFilter]);

  useEffect(() => {
    if(!selectedId)return;
    let cancelled = false;
    fetch(`/api/norms/versions?documentId=${selectedId}`)
      .then(async response => {if(!response.ok) throw new Error();return response.json();})
      .then((payload) => {
        if (!cancelled) {
          setVersions(payload.versions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);setVersionsError("No se pudieron comprobar las versiones relacionadas.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (reading && selectedId) {
      readingRef.current?.scrollIntoView({ block: "start" });
      readingRef.current?.focus({ preventScroll: true });
    }
  }, [reading, selectedId]);

  function refreshAfterValidityReview() {
    if(!selectedId)return;
    const sequence=detailSequence.current;
    setReviewEpoch(value=>value+1);
    void fetch(`/api/norms/${selectedId}`,{cache:"no-store"}).then(async response=>{
      if(!response.ok)throw Error("La revisión se guardó, pero no se pudo actualizar la ficha. Vuelve a abrirla.");
      const payload=await response.json() as NormDetail;
      if(sequence!==detailSequence.current)return;
      setDetail(payload);
    }).catch(cause=>{if(sequence===detailSequence.current)setError(cause instanceof Error?cause.message:"No se pudo actualizar la ficha");});
  }

  async function selectNorm(id: string, targetArticleId?: string) {
    const sequence=++detailSequence.current;
    setReading(true);
    setSelectedId(id);
    setDetail(null);
    setSelectedArticleId(null);
    setArticleFilter("");
    setOnlyVigente(false);
    setSemanticSources([]);setSemanticLoading(false);
    setSemanticQuery("");setSemanticNotice("");
    setLoadingDetail(true);

    try {
      const response = await fetch(`/api/norms/${id}`);
      const payload = (await response.json()) as NormDetail & { error?: string };

      if(sequence!==detailSequence.current) return;
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar la norma.");
        return;
      }

      setDetail(payload);
      const requested=targetArticleId || (id===targetDocumentId?targetArticleUuid:null);
      const number=id===targetDocumentId?targetArticle:null;
      const resolution=requested||number?resolveArticleIdentity(payload.articles,{articleId:requested,articleNumber:requested?null:number,bodyId:!targetArticleId&&id===targetDocumentId?targetBodyId:null}):null;
      if(resolution && resolution.status!=="found")setError(resolution.status==="ambiguous"?"El número corresponde a varios artículos. Elige el cuerpo y artículo en el índice; no se seleccionó uno por su cuenta.":"No se encontró el artículo solicitado en esta versión.");
      setSelectedArticleId(resolution?resolution.article?.id??null:payload.articles[0]?.id??null);
    } catch {
      if(sequence===detailSequence.current) setError("No se pudo conectar con el servidor.");
    } finally {
      if(sequence===detailSequence.current) setLoadingDetail(false);
    }
  }

  useEffect(()=>{
    if(targetDocumentId && openedTarget.current!==targetDocumentId){openedTarget.current=targetDocumentId;void selectNorm(targetDocumentId);}
    // A deep link opens its exact document even when it is not on the current catalogue page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[targetDocumentId]);

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
    if (!concordancia.resolved || !concordancia.targetDocumentId || !concordancia.destinationCheck?.valid) {
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
      if (onlyVigente && (article.validityReview?reviewedValidity(article.validityReview):legalValidity(article.vigencia, article.status)).state !== "current") {
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
    () => visibleArticles.find((article) => article.id === selectedArticleId) ?? null,
    [visibleArticles, selectedArticleId],
  );

  const selectedArticleId2 = selectedArticle?.id ?? null;

  useEffect(() => {
    if (!selectedArticleId2) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(()=>{if(!cancelled){setCiting([]);setCitingError("");}});
    fetch(`/api/norms/articles/${selectedArticleId2}/citing`)
      .then(async response=>{if(!response.ok)throw new Error();return response.json();})
      .then((payload) => {
        if (!cancelled) {
          setCiting(payload.citing ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCiting([]);setCitingError("No se pudo comprobar qué documentos citan este artículo.");
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

  async function askDocument(article?: Article) {
    if (!detail || chatBusy) return;
    setChatBusy(true); setError("");
    try {
      const response=await fetch("/api/search/handoff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:`Explica ${article ? `el artículo ${article.articleNumber} de ` : "el documento "}${detail.norm.title}. Responde solo con este documento${article ? " y el artículo seleccionado" : ""}, cita documento y página, distingue regla y excepciones e indica qué falta comprobar.${article ? ` Pasaje seleccionado (página ${article.pageStart ?? "sin registrar"}, sección ${article.sectionTitle ?? "sin identificar"}): ${article.content.slice(0,1200)}` : ""}`,filters:{documentId:detail.norm.id,documentIds:[detail.norm.id],articleId:article?.id,bodyId:article?.bodyId,documentType:detail.norm.documentType,...(article && !repeatedArticleNumbers(detail.articles).includes(article.articleNumber)?{article:article.articleNumber}:{})}})});
      const payload=await response.json();if(!response.ok || !payload.sessionId) throw new Error();
      router.push(`/chat?sessionId=${payload.sessionId}`);
    } catch {setError("No se pudo abrir el chat con esta fuente. Reintenta.");}
    finally {setChatBusy(false);}
  }
  function sendArticleToChat(article: Article) { void askDocument(article); }

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

    const sequence=detailSequence.current;
    setSemanticLoading(true);setSemanticNotice("");
    setSemanticSources([]);
    try {
      const response = await fetch(`/api/norms/${detail.norm.id}/semantic`, {
        body: JSON.stringify({ query: semanticQuery.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { sources?: SemanticSource[]; error?: string; assessment?: {evidenceWarnings?:string[]}; retrieval?:Record<string,string> };
      if(sequence!==detailSequence.current)return;
      if (response.ok) {
        setSemanticSources(payload.sources ?? []);
        const partial=Object.values(payload.retrieval ?? {}).includes("unavailable");
        setSemanticNotice(partial?"Recuperación parcial: no estuvieron disponibles todas las vías de consulta. Los resultados pueden ser incompletos.":payload.sources?.length?"Selección de pasajes del documento; no es un recorrido exhaustivo.":"No se recuperaron pasajes con esta consulta. Esto no acredita que el documento no trate el tema.");
      } else {
        setError(payload.error ?? "No se pudo buscar dentro de la norma.");
      }
    } catch {
      if(sequence===detailSequence.current)setError("No se pudo conectar con el buscador semantico.");
    } finally {
      if(sequence===detailSequence.current)setSemanticLoading(false);
    }
  }

  function clearNormFilters() {
    setDocumentTypeFilter("");
    setProcessTypeFilter("");
    setSourceEntityFilter("");
    setYearFilter("");
    setVigenciaFilter("");
    setTopicFilter("");setTitleQuery("");setPage(1);setExtendedFilters({});
  }

  function changeCategory(nextCategory: Category) {
    setCategory(nextCategory);setPage(1);setExtendedFilters({});
    setDocumentTypeFilter("");
    setSelectedId(null);
    setDetail(null);
    setSelectedArticleId(null);
    setCiting([]);
  }

  return (
    <div className={`toolPanel normBrowser ${reading ? "normReading" : "normBrowsing"}`}>
      <LegalCenterNav active="normas" filters={{ ...extendedFilters, documentType: documentTypeFilter || detail?.norm.documentType, documentId: selectedId, article: selectedArticle?.articleNumber, articleId:selectedArticle?.id, bodyId:selectedArticle?.bodyId, processType: processTypeFilter, sourceEntity: sourceEntityFilter, year: yearFilter, vigencia: vigenciaFilter, topic: topicFilter }} />

      <div className="normCatalogueControls">
      <p className="normIntro">Busca por título o número, o explora por categoría. Cada documento enlaza su PDF para poder citarlo con su página.</p>

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
          Criterios y decisiones
        </button>
        <button aria-pressed={category === "orientacion"} onClick={() => changeCategory("orientacion")} type="button">
          Bases y orientación
        </button>
      </div>

      <div className="normSearchEntry"><label htmlFor="norm-title-query">Encuentra un documento por título o número</label><div><Search size={18} aria-hidden="true"/><input id="norm-title-query" value={titleQuery} maxLength={200} onChange={event=>{setTitleQuery(event.target.value);setPage(1);}} placeholder="Por ejemplo: Reglamento de la Ley 32069" /></div></div>
      <div className="normFilters normPrimaryFilters">
        <label><span>Tipo</span><select value={documentTypeFilter} onChange={event=>{setDocumentTypeFilter(event.target.value);setPage(1);}}><option value="">Todos los tipos</option>{DOCUMENT_TYPES.filter(item=>corpusTypesForGroup(category).includes(item.value)).map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Régimen identificado</span><select value={extendedFilters.regime ?? ""} onChange={event=>{setExtendedFilters({...extendedFilters,regime:event.target.value as ExtendedLegalFilters["regime"]});setPage(1);}}><option value="">Todos</option><option value="32069">Ley 32069</option><option value="30225">Ley 30225</option><option value="especial">Especial</option><option value="no_determinado">Sin identificar</option></select></label>
        <label><span>Año registrado</span><select value={yearFilter} onChange={event=>{setYearFilter(event.target.value);setPage(1);}}><option value="">Todos</option>{facets.years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
        <button className="secondaryButton" type="button" onClick={clearNormFilters}>Restablecer</button>
      </div>
      <details className="normAdvancedFilters"><summary>Más filtros · entidad, procedimiento y revisión{[sourceEntityFilter,processTypeFilter,vigenciaFilter,topicFilter,extendedFilters.documentTypes?.length,extendedFilters.years?.length].filter(Boolean).length ? ` · ${[sourceEntityFilter,processTypeFilter,vigenciaFilter,topicFilter,extendedFilters.documentTypes?.length,extendedFilters.years?.length].filter(Boolean).length} activos` : ""}</summary><div className="normFilters">
        <label><span>Entidad</span><select value={sourceEntityFilter} onChange={event=>{setSourceEntityFilter(event.target.value);setPage(1);}}><option value="">Todas</option>{facets.entities.map(entity=><option key={entity} value={entity}>{entity}</option>)}</select></label>
        <label><span>Procedimiento</span><select value={processTypeFilter} onChange={event=>{setProcessTypeFilter(event.target.value);setPage(1);}}><option value="">Todos</option>{processTypes.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Estado registrado de vigencia</span><select value={vigenciaFilter} onChange={event=>{setVigenciaFilter(event.target.value);setPage(1);}}><option value="">Todos</option><option value="vigente">Registrado como vigente</option><option value="no vigente">Registrado como no vigente</option><option value="parcialmente vigente">Parcialmente vigente</option><option value="unknown">Sin confirmar / por revisar</option></select></label>
        <label><span>Tema registrado</span><input value={topicFilter} onChange={event=>{setTopicFilter(event.target.value);setPage(1);}} placeholder="Tema del catálogo" /></label>
        </div><ExtendedLegalFilterControls value={extendedFilters} onChange={value=>{setExtendedFilters(value);setPage(1);if(value.documentTypes?.length)setDocumentTypeFilter("");if(value.years?.length)setYearFilter("");}} /></details>
      <p className="normCatalogueCount" role="status">
        <strong>{loadingList ? "Consultando documentos…" : `${pagination.total} ${pagination.total === 1 ? "documento" : "documentos"}`}</strong>
        {loadingList ? null : <span>{facets.categoryTotal} en esta categoría</span>}
        <span className="normCatalogueNote">La vigencia y el régimen se confirman dentro de cada documento; el listado no acredita que apliquen a tu caso. Solo se marca lo que consta como vigente o no vigente.</span>
      </p>
      {listWarnings.length ? <div className="normPartialNotice" role="status"><strong>Listado disponible con comprobaciones pendientes</strong>{listWarnings.map(warning=><p key={warning}>{warning}</p>)}</div> : null}


      </div>
      {error ? <p className="formMessage errorText">{error}</p> : null}
      <div className="normReaderToolbar" ref={readingRef} tabIndex={-1}>
        {reading ? <button type="button" className="secondaryButton" onClick={() => {setReading(false);requestAnimationFrame(()=>document.getElementById("norm-title-query")?.focus());}}><ArrowLeft size={16} aria-hidden="true"/> Volver al catálogo</button> : selectedId ? <button type="button" className="secondaryButton" onClick={()=>setReading(true)}>Continuar leyendo el documento</button> : null}
        {reading ? <span>Lectura del documento · comprueba la versión y la página del PDF.</span> : null}
      </div>
      <div className="normGrid">
        <aside className="normList" aria-label="Listado de normas">
          {loadingList ? (
            <>
              <span className="normSkeletonLabel" role="status">Cargando documentos…</span>
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="normCardSkeleton" aria-hidden="true"><i /><i /><i /></div>)}
            </>
          ) : norms.length === 0 ? (
            <div className="emptyState">
              <ScrollText size={18} />
              <span>{error ? "No se pudo cargar el listado. Revisa el mensaje e intenta de nuevo." : facets.categoryTotal===0 ? "Esta categoría aún no tiene documentos incorporados." : "No hay coincidencias con estos filtros. Prueba restablecerlos."}</span>
            </div>
          ) : (
            norms.map((norm) => (
              <button
                key={norm.id}
                className={`normCard ${selectedId === norm.id ? "active" : ""}`}
                onClick={() => selectNorm(norm.id)}
                type="button"
              >
                <span className="normCardTop">
                  <span className="normCardType">{documentTypeLabel(norm.documentType)}</span>
                  {norm.dates?.published || norm.year ? <time className="normCardDate">{norm.dates?.published ? formatNormDate(norm.dates.published) : `Año ${norm.year}`}</time> : null}
                </span>
                <strong className="normCardTitle">{norm.title}</strong>
                <span className="normCardMeta">
                  {[
                    norm.documentNumber && !norm.title.includes(norm.documentNumber) ? `N.° ${norm.documentNumber}` : "",
                    norm.sourceEntity ?? "",
                    readableVersion(norm.dates?.version),
                  ].filter(Boolean).join(" · ")}
                </span>
                {/* Solo se muestra lo que informa: «sin identificar» y «por revisar» en todas las tarjetas era ruido. */}
                <span className="normCardTags">
                  {norm.regime && norm.regime !== "no_determinado" ? <span className="normTag">Régimen {norm.regime}</span> : null}
                  {legalValidity(norm.vigencia, norm.status).state !== "unknown" || norm.review?.validity ? <LegalValidityBadge value={norm.vigencia} status={norm.status} review={norm.review?.validity} compact /> : null}
                </span>
              </button>
            ))
          )}
          {pagination.pages>1 ? <nav className="normPagination" aria-label="Páginas de documentos"><button type="button" disabled={loadingList||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>{page} / {pagination.pages}</span><button type="button" disabled={loadingList||page>=pagination.pages} onClick={()=>setPage(value=>value+1)}>Siguiente</button></nav> : null}
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
              <strong>Selecciona un documento</strong>
              <span>Elige una norma, criterio o guía para revisar su contenido y abrir el PDF.</span>
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
                  <LegalValidityBadge value={detail.norm.vigencia} status={detail.norm.status} review={detail.norm.review?.validity} />
                </div>
                <div className="normHeaderActions">
                  <button type="button" className="primaryButton compactButton" disabled={chatBusy} onClick={() => void askDocument()}>
                    <MessageSquareText size={15} />
                    Consultar en Chat
                  </button>
                  <a
                    className="secondaryButton compactButton"
                    href={`/api/documents/${detail.norm.id}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={15} />
                    Abrir PDF
                  </a>
                </div>
              </header>

              {detail.warnings?.length ? <div className="normPartialNotice" role="status">{detail.warnings.map(warning=><p key={warning}>{warning}</p>)}</div> : null}
              {versionsError ? <p className="normPartialNotice" role="status">{versionsError}</p> : null}
              <details className="normDocumentInfo"><summary>Ficha, vigencia, versiones y acciones del documento</summary>
              {detail.norm.amends ? (
                <div className="normAmends">
                  <AlertTriangle size={15} />
                  <span>Nota registrada · efectos jurídicos sin comprobar: {detail.norm.amends}</span>
                </div>
              ) : null}

              <div className="normReadingActions"><button type="button" className="primaryButton" disabled={chatBusy} onClick={()=>void askDocument()}>Consultar este documento en Chat</button><Link className="secondaryButton" href={legalCenterHref("busqueda",{documentId:detail.norm.id,documentType:detail.norm.documentType})}>Ver en Búsqueda</Link><SaveButton itemType="documento" documentId={detail.norm.id} title={detail.norm.title}/></div>
              <p className="normScopeNote">La consulta en Chat queda limitada al documento seleccionado. Para un artículo, usa su acción específica.</p>
              <DocumentValidityReview key={detail.norm.id} documentId={detail.norm.id} version={detail.norm.dates?.version??null} articles={detail.articles} onSaved={refreshAfterValidityReview} />              <details className="normProvenance"><summary>Procedencia, versión y revisión</summary><p>Entidad: {detail.norm.sourceEntity ?? "Sin registrar"}</p><p>Publicación original: {detail.norm.dates?.published ?? "Sin registrar"} · Actualización: {detail.norm.dates?.updated ?? "Sin registrar"} · Incorporación: {detail.norm.dates?.imported ?? "Sin registrar"}</p><p>Versión: {detail.norm.dates?.version ?? "Sin denominación de versión"}</p>{detail.norm.sourceUrl ? <a href={detail.norm.sourceUrl} target="_blank" rel="noreferrer">Abrir publicación oficial</a> : null}<p>{detail.norm.review?.method} · {detail.norm.review?.reviewer}</p><p>{detail.norm.review?.evidence}</p><p>{detail.norm.review?.validityReview ?? "La vigencia y la aplicación al caso requieren revisión."}</p></details>
              <details className="normTechnicalState"><summary>Estado del documento · lectura e indexación</summary><p>Estos indicadores describen la preparación técnica; no son una revisión jurídica. Una búsqueda IA disponible no garantiza citas con página.</p>
              <div className="normQualityStrip">
                {detail.norm.articleCount > 0 ? <span data-ready={true}>
                  <BookOpenCheck size={15} />
                  {detail.norm.articleCount} articulos
                </span> : null}
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
                  Consulta IA {detail.norm.pineconeVerified ? "disponible" : "pendiente"}
                </span>
                <span data-ready={detail.norm.hasSummary}>
                  <CheckCircle2 size={15} />
                  Resumen {detail.norm.hasSummary ? "generado" : "pendiente"}
                </span>
              </div>

              </details>
              {selectedVersionGroup ? (
                <details className="versionPanel">
                  <summary>Versiones del documento · {selectedVersionGroup.total}</summary>
                  <span>
                    {selectedVersionGroup.total} documentos de la misma familia · ordenados por fecha de actualización o publicación; fechas desconocidas al final
                  </span>
                  <div className="versionList">
                    {selectedVersionGroup.documents.map((document) => (
                      <div key={document.id} className="normVersionChoice"><button
                        className={`versionChip ${document.id === detail.norm.id ? "active" : ""} ${
                          isNotCurrent(document.vigencia, document.status) ? "warn" : ""
                        }`}
                        key={document.id}
                        onClick={() => selectNorm(document.id)}
                        type="button"
                      >
                        {document.dates?.version ?? document.title} · Actualizado: {document.dates?.updated ?? "sin fecha"} · Publicado: {document.dates?.published ?? "sin fecha"}
                      </button>{document.id!==detail.norm.id ? <Link className="secondaryButton compactButton" href={`/comparar?${new URLSearchParams({comparison:"texto",documentIdA:detail.norm.id,documentIdB:document.id,documentTypeA:detail.norm.documentType,documentTypeB:document.documentType}).toString()}`}>Comparar texto de estas versiones</Link> : null}</div>
                    ))}
                  </div>
                  {currentVersionDocument?.amends || hasModifiedArticle ? (
                    <small>
                      Hay notas o estados que requieren revisión. No se ha comprobado aquí que una norma modifique o derogue otra.
                    </small>
                  ) : null}
                </details>
              ) : null}

              </details>

              {repeatedArticleNumbers(detail.articles).length ? <p className="normPartialNotice">Hay numeración de artículos repetida en este archivo. Puede contener varios cuerpos o secciones; el ámbito aún no está separado. Comprueba encabezado y página del PDF antes de citar.</p> : null}
              {detail.articles.length === 0 ? (
                <div className="normJurisprudence">
                  {detail.norm.summary ? (
                    <details className="normAssistedReading"><summary>Resumen asistido · contenido generado, no texto original</summary><p>{detail.norm.summary}</p><small>Contrasta la explicación con el documento original. No se presume revisión humana.</small></details>
                  ) : (
                    <p>Este documento no tiene articulos detectados. Abre el PDF para leerlo completo.</p>
                  )}
                  <button
                    className="secondaryButton compactButton"
                    onClick={() => void askDocument()} disabled={chatBusy}
                    type="button"
                  >
                    <MessageSquareText size={15} />
                    Consultar en el chat
                  </button>
                </div>
              ) : (
                <div className="articleLayout">
                  <details className="articleNavCol normArticleNavigation" open={articleNavOpen} onToggle={(event) => setArticleNavChoice(event.currentTarget.open)}><summary>Índice y búsqueda en el documento</summary>
                    <label className="articleSearch">
                      <Search size={15} />
                      <input
                        onChange={(event) => setArticleFilter(event.target.value)}
                        aria-label="Buscar artículo o texto"
                        placeholder="Buscar artículo o texto"
                        value={articleFilter}
                      />
                    </label>
                    <label className="vigenteToggle">
                      <input
                        checked={onlyVigente}
                        onChange={(event) => setOnlyVigente(event.target.checked)}
                        type="checkbox"
                      />
                      Solo registrado como vigente
                    </label>
                    <div className="semanticInNorm">
                      <label className="articleSearch">
                        <Sparkles size={15} />
                        <input
                          onChange={(event) => setSemanticQuery(event.target.value)}
                          aria-label="Buscar por tema en este documento"
                          maxLength={500}
                          placeholder="Describe qué buscas en este documento"
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
                    {semanticNotice ? <p className="normScopeNote" role="status">{semanticNotice}</p> : null}
                    {semanticSources.length > 0 ? (
                      <div className="semanticNormResults">
                        {semanticSources.slice(0, 5).map((source) => (
                          <button
                            key={source.chunkId}
                            onClick={() => {
                              const match = resolveArticleIdentity(detail.articles,{articleNumber:source.article});
                              if (match.status==="found") setSelectedArticleId(match.article.id); else setError("El pasaje no identifica un artículo único. Selecciónalo en el índice y comprueba el cuerpo normativo.");
                            }}
                            type="button"
                          >
                            <strong>{source.article ? `Art. ${source.article}` : source.citation}</strong>
                            <span>{stripPageMarkers(source.excerpt).slice(0, 110)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <NormativeIndex articles={visibleArticles} selectedId={selectedArticle?.id} onSelect={setSelectedArticleId} />
                  </details>

                  <article className="articleReader">
                    {selectedArticle ? (
                      <>
                        <div className="articleReaderHeader">
                          <div>
                            {selectedArticle.sectionTitle ? (
                              <span className="articleSection">{selectedArticle.sectionTitle}</span>
                            ) : null}
                            <strong>Articulo {selectedArticle.articleNumber}</strong><p className="normScopeNote">{selectedArticle.bodyTitle ?? "Cuerpo normativo sin identificar"} · {selectedArticle.bodyReviewed?"Ámbito revisado":"Ámbito por revisar"} · {selectedArticle.version ?? "Versión sin registrar"}</p>
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
                            <LegalValidityBadge value={selectedArticle.vigencia} status={selectedArticle.status} review={selectedArticle.validityReview} />
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

                        <p className="normScopeNote">Texto extraído del documento · comprueba la página del PDF para citar.</p>
                        <p className="articleText">{selectedArticle.content}</p>
                        {detail.canCorrectReferences ? <NormativeBodyReview key={selectedArticle.id} articleId={selectedArticle.id} title={selectedArticle.bodyReviewed?selectedArticle.bodyTitle:undefined} revision={selectedArticle.bodyRevision??0} onSaved={()=>void selectNorm(detail.norm.id,selectedArticle.id)}/> : null}

                        {selectedReading ? (
                          <details className="normAssistedReading"><summary>Extracto y señales automáticas · sin revisión jurídica</summary><div className="legalReadingPanel">
                            <div>
                              <strong>Extracto textual abreviado</strong>
                              <p>{selectedReading.summary}</p>
                            </div>
                            <div>
                              <strong>Pasajes con palabras de obligación</strong>
                              {selectedReading.requirements.length > 0 ? (
                                <ul>
                                  {selectedReading.requirements.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span>No se encontraron palabras coincidentes; esto no significa que no existan obligaciones.</span>
                              )}
                            </div>
                            <div>
                              <strong>Pasajes con palabras de excepción o advertencia</strong>
                              {selectedReading.risks.length > 0 ? (
                                <ul>
                                  {selectedReading.risks.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span>No se encontraron palabras coincidentes; esto no acredita ausencia de excepciones o riesgos.</span>
                              )}
                            </div>
                          </div><p>Detección por palabras, no análisis jurídico. Para una explicación con fuentes, consulta este artículo en Chat.</p></details>
                        ) : null}

                        {citingError ? <p className="normPartialNotice" role="status">{citingError}</p> : null}
                        {articleConcordancias.length > 0 || citing.length > 0 ? (
                          <div className="concordanciaPanel">
                            {articleConcordancias.length > 0 ? (
                              <div className="concordanciaGroup">
                                <strong>Referencias detectadas · sin revisión jurídica</strong>
                                <div className="concordanciaList">
                                  {articleConcordancias.map((concordancia) =>
                                    concordancia.resolved && concordancia.targetDocumentId && concordancia.destinationCheck?.valid ? (
                                      <button
                                        key={concordancia.id}
                                        className="concordanciaChip resolved"
                                        onClick={() => navigateToConcordancia(concordancia)}
                                        type="button"
                                        title={concordancia.rawText}
                                      >
                                        <span>{concordancia.destinationCheck?.reason ?? referenceReviewLabel(concordancia.resolved, concordancia.targetDocumentId)}</span>
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
                                        {concordancia.destinationCheck?.reason ?? referenceReviewLabel(concordancia.resolved, concordancia.targetDocumentId)} · {concordancia.rawText} · no indexada
                                      </span>
                                    ),
                                  )}
                                  {detail.canCorrectReferences ? <details><summary>Revisar destinos e historial</summary>{articleConcordancias.map(reference=><div key={reference.id}><p>{reference.rawText}</p><ConcordanceReview referenceId={reference.id} onSaved={()=>void selectNorm(detail.norm.id,selectedArticle.id)}/></div>)}</details> : null}
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
                                      <span>{classifyConcordance()}</span>
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
                            disabled={chatBusy}
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
