"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSearch,
  Gauge,
  ListChecks,
  MessageSquareText,
  Play,
  Save,
  ShieldCheck,
} from "lucide-react";
import { OBJECT_TYPES, processTypeLabel } from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { processLabelFromOptions, useSettingsCatalog } from "./use-settings-catalog";

type RuleFinding = {
  action: string;
  basis?: string;
  code: string;
  level: "bloqueante" | "alto" | "medio" | "bajo";
  message: string;
  status: "cumple" | "no_cumple" | "requiere_dato" | "riesgo";
};

type OrchestratorResult = {
  inferredContext: {
    amount?: number | "";
    objectType?: string;
    procedureType?: string;
    standardized?: boolean;
    validOffers?: number | "";
    directCause?: string;
    hasTechnicalFile?: boolean;
    marketPlurality?: boolean;
  };
  critical: {
    missing: string[];
    ok: boolean;
    required: string[];
    warning: string | null;
  };
  legal: {
    assessment: {
      confidence: string;
      sufficient: boolean;
      reason: string;
    };
    sources: Array<{
      article: string | null;
      chunkId?: string;
      documentId: string;
      documentTitle: string;
      documentType: string;
      excerpt?: string;
      pageStart: number | null;
      processType: string | null;
      score: number;
    }>;
  } | null;
  plan: {
    agents: string[];
    intent: string;
    reason: string;
  };
  rules: {
    conclusion: "procede" | "no_procede" | "requiere_revision";
    findings: RuleFinding[];
    nextSteps: string[];
    procedureLabel: string | null;
    procedureType: string | null;
  } | null;
};

type Process = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
};

type ValidationHistoryItem = {
  id: string;
  title: string;
  metadata: OrchestratorResult | null;
  created_at: string;
};

type CorpusResult = {
  corpusReady: boolean;
  criticalSearches: Array<{
    code: string;
    expected: string;
    pass: boolean;
    recovered: Array<{
      article: string | null;
      documentTitle: string;
      documentType: string;
      pageStart: number | null;
      processType: string | null;
      score: number;
    }>;
  }>;
  documents: {
    indexed: number;
    total: number;
    byType: Array<{
      chunks: number;
      chunksWithArticle: number;
      chunksWithPage: number;
      documentType: string;
      documents: number;
      indexed: number;
      pineconeVerified: number;
    }>;
  };
  flow: { detail: string; ready: boolean };
  requirements: Array<{ code: string; detail: string; label: string; pass: boolean }>;
};

function boolFromSelect(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function conclusionLabel(value?: string | null) {
  if (value === "procede") return "Procede";
  if (value === "no_procede") return "No procede";
  return "Requiere revision";
}

function statusTone(status: string, level?: string) {
  if (status === "cumple") return "ok";
  if (status === "no_cumple" || level === "bloqueante") return "bad";
  return "warn";
}

const presets = [
  {
    label: "Comparacion de precios",
    query: "Validar requisitos para una compra por comparacion de precios",
    procedureType: "comparacion_precios",
    objectType: "bienes",
    standardized: "true",
    marketPlurality: "true",
    hasTechnicalFile: "",
  },
  {
    label: "Subasta inversa",
    query: "Validar si corresponde subasta inversa electronica y revisar ficha tecnica vigente",
    procedureType: "subasta_inversa_electronica",
    objectType: "bienes",
    standardized: "true",
    marketPlurality: "true",
    hasTechnicalFile: "true",
  },
  {
    label: "Contratacion directa",
    query: "Validar una contratacion directa y revisar si la causal esta sustentada",
    procedureType: "contratacion_directa",
    objectType: "servicios",
    standardized: "",
    marketPlurality: "",
    hasTechnicalFile: "",
  },
  {
    label: "Licitacion publica",
    query: "Validar expediente para licitacion publica",
    procedureType: "licitacion_publica",
    objectType: "bienes",
    standardized: "",
    marketPlurality: "",
    hasTechnicalFile: "",
  },
  {
    label: "Concurso publico",
    query: "Validar expediente para concurso publico",
    procedureType: "concurso_publico",
    objectType: "servicios",
    standardized: "",
    marketPlurality: "",
    hasTechnicalFile: "",
  },
  {
    label: "Adjudicacion simplificada",
    query: "Validar expediente para adjudicacion simplificada",
    procedureType: "adjudicacion_simplificada",
    objectType: "servicios",
    standardized: "",
    marketPlurality: "",
    hasTechnicalFile: "",
  },
];

function guidanceForProcedure(type: string) {
  if (type === "comparacion_precios") {
    return {
      checks: [
        "Debe recuperar el Reglamento como fuente critica (la Ley, art. 4, remite a el).",
        "Verifica si el bien o servicio es comparable por precio.",
        "Confirma pluralidad de proveedores y ofertas validas.",
        "Las bases solo sirven como esquema operativo.",
      ],
      description: "La validacion debe separar la definicion legal del procedimiento y los requisitos concretos del Reglamento.",
      title: "Comparacion de precios",
    };
  }
  if (type === "subasta_inversa_electronica") {
    return {
      checks: [
        "Debe existir ficha tecnica vigente.",
        "Debe recuperar la Directiva SIE aplicable.",
        "No deben agregarse requisitos fuera de la ficha tecnica.",
        "Confirma si el objeto esta estandarizado.",
      ],
      description: "El foco es validar ficha tecnica, directiva y restricciones para no modificar la especificacion estandar.",
      title: "Subasta inversa electronica",
    };
  }
  if (type === "contratacion_directa") {
    return {
      checks: [
        "Identifica la causal invocada.",
        "Busca sustento en Ley o Reglamento.",
        "Evalua si la causal exige informe tecnico o legal.",
        "Advierte si falta evidencia para justificar la excepcion.",
      ],
      description: "La validacion debe revisar que la causal este expresamente prevista y sustentada.",
      title: "Contratacion directa",
    };
  }
  return {
    checks: [
      "Vincula un expediente si existe.",
      "Completa monto, objeto y procedimiento.",
      "Revisa cobertura normativa antes de usar el resultado.",
      "Guarda la validacion cuando sirva como sustento interno.",
    ],
    description: "Completa los datos minimos para que el orquestador aplique reglas y fuentes normativas del corpus.",
    title: "Validacion general",
  };
}

export function ProcedureValidator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processTypes } = useSettingsCatalog();
  const labelProcessType = (value?: string | null) => processLabelFromOptions(processTypes, value) ?? processTypeLabel(value);
  const [query, setQuery] = useState(searchParams.get("pregunta") ?? "Validar procedimiento de comparacion de precios");
  const [procedureType, setProcedureType] = useState(searchParams.get("processType") ?? "comparacion_precios");
  const [objectType, setObjectType] = useState("bienes");
  const [amount, setAmount] = useState("");
  const [validOffers, setValidOffers] = useState("");
  const [standardized, setStandardized] = useState("");
  const [marketPlurality, setMarketPlurality] = useState("");
  const [hasTechnicalFile, setHasTechnicalFile] = useState("");
  const [directCause, setDirectCause] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCorpus, setCheckingCorpus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [corpus, setCorpus] = useState<CorpusResult | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processId, setProcessId] = useState(searchParams.get("processId") ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [history, setHistory] = useState<ValidationHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/processes")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setProcesses(payload.processes ?? []);
      })
      .catch(() => {
        if (!cancelled) setProcesses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch("/api/saved", { cache: "no-store" });
      const payload = await response.json();
      setHistory(
        (payload.items ?? [])
          .filter((item: { item_type: string }) => item.item_type === "validacion")
          .slice(0, 6),
      );
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setHistory(
            (payload.items ?? [])
              .filter((item: { item_type: string }) => item.item_type === "validacion")
              .slice(0, 6),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const context = useMemo(
    () => ({
      amount: amount ? Number(amount) : "",
      directCause,
      hasTechnicalFile: boolFromSelect(hasTechnicalFile),
      marketPlurality: boolFromSelect(marketPlurality),
      objectType: objectType || undefined,
      procedureType,
      standardized: boolFromSelect(standardized),
      validOffers: validOffers ? Number(validOffers) : "",
    }),
    [amount, directCause, hasTechnicalFile, marketPlurality, objectType, procedureType, standardized, validOffers],
  );
  const isComparison = procedureType === "comparacion_precios";
  const isSie = procedureType === "subasta_inversa_electronica";
  const isDirect = procedureType === "contratacion_directa";
  const showMarketFields = isComparison || isSie;
  const showValidOffers = isComparison;
  const showTechnicalFile = isSie;
  const showDirectCause = isDirect;
  const requiredSignals = [
    procedureType,
    objectType,
    amount,
    showMarketFields ? standardized : "ok",
    showMarketFields ? marketPlurality : "ok",
    showValidOffers ? validOffers : "ok",
    showTechnicalFile ? hasTechnicalFile : "ok",
    showDirectCause ? directCause : "ok",
  ];
  const completion = Math.round((requiredSignals.filter(Boolean).length / requiredSignals.length) * 100);
  const guidance = guidanceForProcedure(procedureType);
  const requiredChecklist = [
    { done: Boolean(procedureType), label: "Procedimiento" },
    { done: Boolean(objectType), label: "Objeto" },
    { done: Boolean(amount), label: "Monto" },
    ...(showMarketFields
      ? [
          { done: Boolean(standardized), label: "Estandarizable" },
          { done: Boolean(marketPlurality), label: "Pluralidad" },
        ]
      : []),
    ...(showValidOffers ? [{ done: Boolean(validOffers), label: "Ofertas validas" }] : []),
    ...(showTechnicalFile ? [{ done: Boolean(hasTechnicalFile), label: "Ficha tecnica" }] : []),
    ...(showDirectCause ? [{ done: Boolean(directCause), label: "Causal" }] : []),
  ];

  function handleProcedureType(nextType: string) {
    setProcedureType(nextType);
    if (nextType !== "comparacion_precios") {
      setValidOffers("");
    }
    if (!["comparacion_precios", "subasta_inversa_electronica"].includes(nextType)) {
      setStandardized("");
      setMarketPlurality("");
    }
    if (nextType !== "subasta_inversa_electronica") {
      setHasTechnicalFile("");
    }
    if (nextType !== "contratacion_directa") {
      setDirectCause("");
    }
  }

  async function validateProcedure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orchestrate", {
          body: JSON.stringify({ context, processId, query }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo validar el procedimiento");
        return;
      }
      setResult(payload);
      setSavedMessage("");
    } catch {
      setError("No se pudo conectar con el orquestador.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCorpus() {
    setCheckingCorpus(true);
    setError(null);
    try {
      const response = await fetch("/api/corpus/verify", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError("Verificar corpus requiere usuario administrador. La validacion del procedimiento si puede ejecutarse con tu sesion.");
          return;
        }
        setError(payload.error ?? "No se pudo verificar el corpus");
        return;
      }
      setCorpus(payload);
    } catch {
      setError("No se pudo conectar con la verificacion de corpus.");
    } finally {
      setCheckingCorpus(false);
    }
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setQuery(preset.query);
    handleProcedureType(preset.procedureType);
    setObjectType(preset.objectType);
    setStandardized(preset.standardized);
    setMarketPlurality(preset.marketPlurality);
    setHasTechnicalFile(preset.hasTechnicalFile);
    setDirectCause("");
    setValidOffers("");
    setAmount("");
  }

  function applyProcess(id: string) {
    setProcessId(id);
    const selected = processes.find((item) => item.id === id);
    if (!selected) return;
    handleProcedureType(selected.procedure_type ?? "");
    setObjectType(selected.object_type);
    setAmount(selected.amount == null ? "" : String(selected.amount));
    setQuery(`Validar procedimiento del expediente ${selected.nomenclature}`);
  }

  function sendSourceToChat(source: NonNullable<OrchestratorResult["legal"]>["sources"][number]) {
    const params = new URLSearchParams({
      documentId: source.documentId,
      documentType: source.documentType,
      pregunta: `${query}. Usa como fuente principal ${source.documentTitle}${source.article ? ` articulo ${source.article}` : ""}.`,
    });
    if (source.article) params.set("article", source.article);
    if (source.processType) params.set("processType", source.processType);
    router.push(`/chat?${params.toString()}`);
  }

  function openAnalyzer() {
    const params = new URLSearchParams({
      documentKind: "bases_integradas",
      processType: procedureType,
    });
    if (processId) params.set("processId", processId);
    const documentId = searchParams.get("documentId");
    if (documentId) params.set("documentId", documentId);
    router.push(`/analizar?${params.toString()}`);
  }

  async function saveValidation() {
    if (!result) return;
    setSaving(true);
    setSavedMessage("");
    try {
      const response = await fetch("/api/orchestrate/save", {
        body: JSON.stringify({
          processId,
          result,
          title: `Validacion - ${result.rules?.procedureLabel ?? result.inferredContext.procedureType ?? "procedimiento"}`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo guardar la validacion.");
        return;
      }
      setSavedMessage(processId ? "Validacion guardada en Guardados y en el expediente." : "Validacion guardada.");
      await loadHistory();
    } catch {
      setError("No se pudo conectar para guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function exportValidation() {
    if (!result) return;
    const response = await fetch("/api/orchestrate/export", {
      body: JSON.stringify({
        result,
        title: `Validacion - ${result.rules?.procedureLabel ?? result.inferredContext.procedureType ?? "procedimiento"}`,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setError("No se pudo exportar la validacion.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "validacion-ace.docx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const sourceCoverage = useMemo(() => {
    const sources = result?.legal?.sources ?? [];
    return ["ley", "reglamento", "directiva", "opinion", "bases_integradas"].map((type) => ({
      count: sources.filter((source) => source.documentType === type).length,
      label: type === "bases_integradas" ? "Bases" : type.charAt(0).toUpperCase() + type.slice(1),
      type,
    }));
  }, [result]);

  return (
    <div className="validatorLayout">
      <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Agent Orchestrator</p>
            <h2>Validar procedimiento</h2>
          </div>
          <ShieldCheck size={21} />
        </div>

        <form className="validatorForm" onSubmit={validateProcedure}>
          <div className="validatorSteps" aria-label="Flujo de validacion">
            <span data-active="true">
              <ClipboardCheck size={15} />
              Datos
            </span>
            <span data-active={completion >= 70}>
              <ListChecks size={15} />
              Reglas
            </span>
            <span data-active={Boolean(result)}>
              <ShieldCheck size={15} />
              Sustento
            </span>
          </div>

          <div className="validationReadiness">
            <div>
              <strong>{completion}% listo para validar</strong>
              <span>
                {completion >= 80
                  ? "Datos suficientes para una validacion operativa."
                  : "Completa los campos clave para reducir observaciones por falta de dato."}
              </span>
            </div>
            <Gauge size={18} />
          </div>

          <div className="validatorAssistPanel">
            <div>
              <span className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Guia del procedimiento</span>
              <strong>{guidance.title}</strong>
              <p>{guidance.description}</p>
            </div>
            <ul>
              {guidance.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>

          <div className="validatorSectionTitle">
            <span>1</span>
            Escoge un caso de trabajo
          </div>

          <div className="procedurePresetGrid" aria-label="Ejemplos de validacion">
            {presets.map((preset) => (
              <button
                className="procedurePresetCard"
                data-active={preset.procedureType === procedureType}
                key={preset.label}
                onClick={() => applyPreset(preset)}
                type="button"
              >
                <strong>{preset.label}</strong>
                <span>{labelProcessType(preset.procedureType) ?? "Procedimiento"}</span>
              </button>
            ))}
          </div>

          <div className="validatorSectionTitle">
            <span>2</span>
            Datos del caso
          </div>

          <label>
            <span>Expediente vinculado</span>
            <select value={processId} onChange={(event) => applyProcess(event.target.value)}>
              <option value="">Sin expediente</option>
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.nomenclature}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Consulta</span>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>

          <div className="requiredChecklist" aria-label="Campos necesarios">
            {requiredChecklist.map((item) => (
              <span data-ready={item.done} key={item.label}>
                {item.done ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {item.label}
              </span>
            ))}
          </div>

          <div className="validatorSectionTitle">
            <span>3</span>
            Condiciones verificables
          </div>

          <div className="formGrid">
            <label>
              <span>Procedimiento</span>
              <select value={procedureType} onChange={(event) => handleProcedureType(event.target.value)}>
                {processTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Objeto</span>
              <select value={objectType} onChange={(event) => setObjectType(event.target.value)}>
                {OBJECT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Monto estimado</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {showValidOffers ? (
              <label>
                <span>Ofertas validas</span>
                <input inputMode="numeric" value={validOffers} onChange={(event) => setValidOffers(event.target.value)} />
              </label>
            ) : null}
            {showMarketFields ? (
              <label>
                <span>Estandarizable</span>
                <select value={standardized} onChange={(event) => setStandardized(event.target.value)}>
                  <option value="">Sin dato</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </label>
            ) : null}
            {showMarketFields ? (
              <label>
                <span>Pluralidad mercado</span>
                <select value={marketPlurality} onChange={(event) => setMarketPlurality(event.target.value)}>
                  <option value="">Sin dato</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </label>
            ) : null}
            {showTechnicalFile ? (
              <label>
                <span>Ficha tecnica</span>
                <select value={hasTechnicalFile} onChange={(event) => setHasTechnicalFile(event.target.value)}>
                  <option value="">Sin dato</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </label>
            ) : null}
            {showDirectCause ? (
              <label>
                <span>Causal CD</span>
                <input value={directCause} onChange={(event) => setDirectCause(event.target.value)} />
              </label>
            ) : null}
          </div>

          <div className="formActions">
            <button className={buttonClasses({ variant: "secondary" })} type="button" onClick={verifyCorpus} disabled={checkingCorpus}>
              <FileSearch size={16} />
              {checkingCorpus ? "Verificando..." : "Verificar corpus (admin)"}
            </button>
            <button className={buttonClasses({ variant: "primary" })} type="submit" disabled={loading}>
              <Play size={16} />
              {loading ? "Validando..." : "Validar"}
            </button>
          </div>
          {error ? <p className="evalError">{error}</p> : null}
          {savedMessage ? <p className="formMessage successText">{savedMessage}</p> : null}
        </form>
      </section>

      <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Resultado</p>
            <h2>{result?.rules ? conclusionLabel(result.rules.conclusion) : "Sin validar"}</h2>
          </div>
          <Gauge size={21} />
        </div>

        {!result ? (
          <div className="validatorEmptyGuide">
            <ShieldCheck size={28} />
            <strong>Listo para validar un procedimiento</strong>
            <p>
              Completa los datos del caso y ejecuta la validacion. El resultado indicara si procede, si falta sustento o si
              requiere subsanacion.
            </p>
            <div>
              <span>1. Reglas del procedimiento</span>
              <span>2. Fuentes criticas obligatorias</span>
              <span>3. Acciones para corregir</span>
            </div>
          </div>
        ) : (
          <div className="validatorResult">
            <div className="decisionGrid">
              <article data-tone={result.rules?.conclusion ?? "requiere_revision"}>
                <strong>{conclusionLabel(result.rules?.conclusion)}</strong>
                <span>Conclusión operativa</span>
              </article>
              <article data-tone={result.critical.ok ? "procede" : "requiere_revision"}>
                <strong>{result.critical.ok ? "Completas" : "Pendientes"}</strong>
                <span>Fuentes críticas</span>
              </article>
              <article data-tone={result.legal?.assessment.sufficient ? "procede" : "requiere_revision"}>
                <strong>{result.legal?.assessment.confidence ?? "s/d"}</strong>
                <span>Confianza documental</span>
              </article>
            </div>

            <div className="validationBanner" data-tone={result.rules?.conclusion ?? "requiere_revision"}>
              <strong>{result.rules?.procedureLabel ?? labelProcessType(result.inferredContext.procedureType)}</strong>
              <span>{result.plan.reason}</span>
              <span>
                Conclusion formal:{" "}
                {result.rules?.conclusion === "procede"
                  ? "Procede"
                  : result.rules?.conclusion === "no_procede"
                    ? "No procede"
                    : "Requiere subsanar/revision"}
              </span>
              <div className="sourceCoverage">
                {result.critical.required.map((item) => (
                  <span data-ready={!result.critical.missing.includes(item)} key={item}>
                    {item}: {result.critical.missing.includes(item) ? "falta" : "ok"}
                  </span>
                ))}
              </div>
              {result.critical.warning ? <small>{result.critical.warning}</small> : null}
              <div className="sourceCoverage">
                {sourceCoverage.map((item) => (
                  <span data-ready={item.count > 0} key={item.type}>
                    {item.label}: {item.count > 0 ? "si" : "no"}
                  </span>
                ))}
              </div>
              <small>Bases integradas: apoyo operativo. No sustituyen Ley, Reglamento, Directiva u Opinion como fundamento normativo.</small>
            </div>

            <div className="formActions compactActions">
              <button className={buttonClasses({ variant: "secondary" })} disabled={saving} onClick={saveValidation} type="button">
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar validacion"}
              </button>
              <button className={buttonClasses({ variant: "secondary" })} onClick={openAnalyzer} type="button">
                <FileSearch size={16} />
                Analizar documento base
              </button>
              <button className={buttonClasses({ variant: "secondary" })} onClick={exportValidation} type="button">
                <Download size={16} />
                Exportar Word
              </button>
            </div>

            <div className="ruleList">
              {result.rules?.findings.map((finding) => (
                <article className="ruleItem" data-tone={statusTone(finding.status, finding.level)} key={finding.code}>
                  <div>
                    {finding.status === "cumple" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                    <strong>{finding.code}</strong>
                    <span>{finding.status}</span>
                  </div>
                  <p>{finding.message}</p>
                  {finding.basis ? <small>Fundamento operativo: {finding.basis}</small> : null}
                  <small>{finding.action}</small>
                </article>
              ))}
            </div>

            {result.rules?.nextSteps?.length ? (
              <div className="sourcePanel">
                <strong>Que hacer despues</strong>
                {result.rules.nextSteps.map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
            ) : null}

            <div className="sourcePanel">
              <strong>Fuentes recuperadas</strong>
              <span>
                Confianza {result.legal?.assessment.confidence ?? "sin dato"} ·{" "}
                {result.legal?.assessment.sufficient ? "suficiente" : "requiere revision"}
              </span>
              {result.legal?.assessment.reason ? <span>{result.legal.assessment.reason}</span> : null}
              {(result.legal?.sources ?? []).slice(0, 6).map((source) => (
                <article className="sourceCard" key={`${source.documentTitle}-${source.article}-${source.pageStart}`}>
                  <strong>{source.documentTitle}</strong>
                  <span>
                    {source.documentType} · {labelProcessType(source.processType) ?? "Todos los procesos"}
                    {source.article ? ` · articulo ${source.article}` : ""}
                    {source.pageStart ? ` · pagina ${source.pageStart}` : ""}
                  </span>
                  <div className="sourceActions">
                    <PdfCiteButton
                      documentId={source.documentId}
                      page={source.pageStart}
                      quote={source.excerpt ?? ""}
                    />
                    <button className={buttonClasses({ variant: "secondary", size: "sm" })} onClick={() => sendSourceToChat(source)} type="button">
                      <MessageSquareText size={15} />
                      Enviar al chat
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {corpus ? (
        <section className="toolPanel validatorWide">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Corpus</p>
              <h2>{corpus.corpusReady ? "Listo para pruebas" : "Requiere ajustes"}</h2>
            </div>
          </div>
          <div className="corpusGrid">
            {corpus.documents.byType.map((item) => (
              <article className="ruleItem" data-tone={item.indexed > 0 ? "ok" : "warn"} key={item.documentType}>
                <div>
                  {item.indexed > 0 ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <strong>{item.documentType}</strong>
                </div>
                <small>
                  {item.indexed}/{item.documents} indexado(s) · {item.chunksWithPage} con pagina · {item.chunksWithArticle} con articulo ·{" "}
                  {item.pineconeVerified} Pinecone
                </small>
              </article>
            ))}
            {corpus.requirements.map((item) => (
              <article className="ruleItem" data-tone={item.pass ? "ok" : "warn"} key={item.code}>
                <div>
                  {item.pass ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <strong>{item.label}</strong>
                </div>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
          <div className="criticalSearchList">
            {corpus.criticalSearches.map((item) => (
              <article className="sourceCard" key={item.code}>
                <strong>
                  {item.pass ? "OK" : "Falta"} · {item.expected}
                </strong>
                {item.recovered.map((source) => (
                  <span key={`${item.code}-${source.documentTitle}-${source.article}`}>
                    {source.documentTitle} · {source.documentType}
                    {source.article ? ` · art. ${source.article}` : ""}
                    {source.pageStart ? ` · pag. ${source.pageStart}` : ""}
                  </span>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="toolPanel validatorWide">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Historial</p>
              <h2>Validaciones guardadas</h2>
            </div>
          </div>
          <div className="ruleList">
            {history.map((item) => (
              <article className="ruleItem" data-tone={item.metadata?.rules?.conclusion === "procede" ? "ok" : "warn"} key={item.id}>
                <div>
                  <ShieldCheck size={17} />
                  <strong>{item.title}</strong>
                  <span>{new Date(item.created_at).toLocaleString("es-PE")}</span>
                </div>
                <p>
                  {item.metadata?.rules?.procedureLabel ?? "Procedimiento"} ·{" "}
                  {conclusionLabel(item.metadata?.rules?.conclusion)}
                </p>
                <small>
                  Fuentes criticas: {item.metadata?.critical?.ok ? "completas" : "requieren revision"}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
