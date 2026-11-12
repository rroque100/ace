"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  PROCESS_DOC_KINDS,
  documentTypeLabel,
  processDocKindLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { PdfCiteButton } from "./pdf-cite-viewer";
import { processLabelFromOptions, useSettingsCatalog } from "./use-settings-catalog";
import { S } from "./document-analyzer-estilos";
import { C } from "@/app/components/estilos-comunes";
import { cn } from "@/lib/utils";

type ClauseCheck = { evidence?: string; key: string; label: string; presente: boolean; nota: string };
type Source = {
  article: string | null;
  chunkId?: string;
  citation: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  excerpt: string;
  pageStart: number | null;
  processType: string | null;
  vigencia?: string | null;
};
type AnalysisFinding = {
  category: "incumplimiento" | "riesgo" | "recomendacion" | "revision_humana";
  message: string;
  severity: "alto" | "medio" | "bajo";
  sources: number[];
};
type Analysis = {
  checklist: Array<{ done: boolean; label: string; note: string }>;
  clausulas: ClauseCheck[];
  confidence: "alta" | "media" | "baja";
  confidenceReason: string;
  coverage: Record<"bases" | "directiva" | "ley" | "opinion" | "reglamento", boolean>;
  criticalSources: Array<{ code: string; label: string; missing: string | null; ok: boolean }>;
  findings: AnalysisFinding[];
  normasAplicables: Array<{ documentTitle: string; documentType: string; citation: string }>;
  recomendaciones: string[];
  resumen: string;
  riesgos: string[];
  sources: Source[];
  model: string;
};
type IndexedDoc = { id: string; title: string; document_type: string; status: string };
type Process = {
  amount: number | null;
  entity: string | null;
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
};
type AnalysisHistoryItem = {
  created_at: string;
  document_id: string | null;
  id: string;
  result: Analysis & { documentKind?: string; processType?: string };
  source: string;
  title: string;
};

const analysisDocumentKinds = PROCESS_DOC_KINDS.filter((item) =>
  ["bases", "bases_integradas", "contrato", "expediente", "requerimiento", "informe", "directiva", "tdr", "ee_tt", "otros"].includes(
    item.value,
  ),
);

function findingTitle(value: AnalysisFinding["category"]) {
  if (value === "incumplimiento") return "Incumplimientos normativos";
  if (value === "riesgo") return "Riesgos";
  if (value === "recomendacion") return "Recomendaciones";
  return "Requiere revisión humana";
}

function findingIcon(value: AnalysisFinding["category"]) {
  if (value === "incumplimiento") return <XCircle size={17} />;
  if (value === "riesgo") return <AlertTriangle size={17} />;
  if (value === "recomendacion") return <Lightbulb size={17} />;
  return <ShieldCheck size={17} />;
}

export function DocumentAnalyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processTypes } = useSettingsCatalog();
  const labelProcessType = (value?: string | null) => processLabelFromOptions(processTypes, value) ?? processTypeLabel(value);
  const [mode, setMode] = useState<"upload" | "indexed">(searchParams.get("documentId") ? "indexed" : "indexed");
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<IndexedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(searchParams.get("documentId") ?? "");
  const [documentKind, setDocumentKind] = useState(searchParams.get("documentKind") ?? "bases_integradas");
  const [processType, setProcessType] = useState(searchParams.get("processType") ?? "comparacion_precios");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processId, setProcessId] = useState(searchParams.get("processId") ?? "");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/documents").then((response) => response.json()),
      fetch("/api/processes").then((response) => response.json()).catch(() => ({ processes: [] })),
      fetch("/api/analyze").then((response) => response.json()).catch(() => ({ items: [] })),
    ])
      .then(([documentsPayload, processesPayload, historyPayload]) => {
        if (cancelled) return;
        setDocs((documentsPayload.documents ?? []).filter((doc: IndexedDoc) => doc.status === "indexed"));
        setProcesses(processesPayload.processes ?? []);
        setHistory(historyPayload.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([]);
          setProcesses([]);
          setHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedFindings = useMemo(() => {
    const groups: Record<AnalysisFinding["category"], AnalysisFinding[]> = {
      incumplimiento: [],
      recomendacion: [],
      revision_humana: [],
      riesgo: [],
    };
    for (const finding of analysis?.findings ?? []) {
      groups[finding.category].push(finding);
    }
    return groups;
  }, [analysis]);

  const selectedProcess = processes.find((item) => item.id === processId);

  function applyProcess(id: string) {
    setProcessId(id);
    const selected = processes.find((item) => item.id === id);
    if (selected?.procedure_type) {
      setProcessType(selected.procedure_type);
    }
  }

  async function loadHistory() {
    const response = await fetch("/api/analyze", { cache: "no-store" });
    const payload = await response.json();
    setHistory(payload.items ?? []);
  }

  async function uploadCurrentPdfToLibrary() {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("documentType", documentKind === "bases" ? "bases_integradas" : documentKind);
    formData.append("processType", processType);
    const response = await fetch("/api/documents", { body: formData, method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ? `Analisis listo, pero no se pudo guardar en biblioteca: ${payload.error}` : "Analisis listo, pero no se pudo guardar en biblioteca.");
      return;
    }
    setMessage("Analisis generado. El PDF tambien fue enviado a biblioteca para procesar e indexar.");
  }

  async function runAnalysis() {
    setError("");
    setMessage("");
    setAnalysis(null);
    setLoading(true);

    try {
      let response: Response;
      if (mode === "upload") {
        if (!file) {
          setError("Adjunta un PDF para analizar.");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name);
        formData.append("documentKind", documentKind);
        formData.append("processType", processType);
        if (processId) formData.append("processId", processId);
        response = await fetch("/api/analyze", { body: formData, method: "POST" });
      } else {
        if (!selectedDoc) {
          setError("Elige un documento indexado.");
          setLoading(false);
          return;
        }
        response = await fetch("/api/analyze", {
          body: JSON.stringify({ documentId: selectedDoc, documentKind, processId, processType }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }

      const payload = (await response.json()) as { analysis?: Analysis; error?: string };
      if (!response.ok || !payload.analysis) {
        setError(payload.error ?? "No se pudo analizar el documento.");
        return;
      }
      setAnalysis(payload.analysis);
      if (mode === "upload" && saveToLibrary) {
        await uploadCurrentPdfToLibrary();
      } else if (processId) {
        setMessage("Analisis guardado y vinculado al expediente seleccionado.");
      } else {
        setMessage("Analisis guardado en el historial.");
      }
      await loadHistory();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function sendFindingToChat(finding: AnalysisFinding) {
    const source = analysis?.sources[(finding.sources[0] ?? 1) - 1] ?? analysis?.sources[0];
    const params = new URLSearchParams({
      documentType: source?.documentType ?? "",
      pregunta: `${finding.message}. Explica el sustento usando la fuente exacta y el tipo de proceso ${labelProcessType(processType) ?? processType}.`,
    });
    if (source?.documentId) params.set("documentId", source.documentId);
    if (source?.article) params.set("article", source.article);
    if (source?.processType ?? processType) params.set("processType", source?.processType ?? processType);
    router.push(`/chat?${params.toString()}`);
  }

  async function exportAnalysis() {
    if (!analysis) return;
    const response = await fetch("/api/analyze/export", {
      body: JSON.stringify({ analysis, title: file?.name ?? docs.find((doc) => doc.id === selectedDoc)?.title ?? "Analisis documental" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      setError("No se pudo exportar el analisis.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "analisis-ace.docx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openValidator() {
    const params = new URLSearchParams({
      processType,
      pregunta: `Validar procedimiento usando el analisis documental ${file?.name ?? docs.find((doc) => doc.id === selectedDoc)?.title ?? ""}`.trim(),
    });
    if (processId) params.set("processId", processId);
    if (selectedDoc) params.set("documentId", selectedDoc);
    router.push(`/validar?${params.toString()}`);
  }

  const missingClauses = analysis?.clausulas.filter((clause) => !clause.presente).length ?? 0;
  const coverageEntries = analysis
    ? [
        ["ley", "Ley", analysis.coverage.ley],
        ["reglamento", "Reglamento", analysis.coverage.reglamento],
        ["directiva", "Directiva", analysis.coverage.directiva],
        ["opinion", "Opinión", analysis.coverage.opinion],
        ["bases", "Bases", analysis.coverage.bases],
      ]
    : [];

  return (
    <div className={S.analysisWorkspace}>
      <div className={C.toolPanel}>
        <div className={C.toolPanelHeader}>
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Análisis documental</p>
            <h2>Revisión jurídica asistida</h2>
          </div>
          <ScanSearch size={22} />
        </div>

        <div className={S.analyzerForm_toolBody}>
          {/* Elige de dónde sale el documento dentro del MISMO formulario: no
              hay dos paneles entre los que alternar. */}
          <div className={S.analysisModeGrid} role="group" aria-label="Origen del documento">
            <button aria-pressed={mode === "indexed"} onClick={() => setMode("indexed")} type="button">
              <strong>Documento indexado</strong>
              <span>Usa biblioteca, páginas, chunks y Pinecone.</span>
            </button>
            <button aria-pressed={mode === "upload"} onClick={() => setMode("upload")} type="button">
              <strong>PDF temporal</strong>
              <span>Revisión rápida; puede enviarse a biblioteca.</span>
            </button>
          </div>

          <div className={C.formGrid}>
            <label>
              <span>Tipo de documento</span>
              <select onChange={(event) => setDocumentKind(event.target.value)} value={documentKind}>
                {analysisDocumentKinds.map((item) => (
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
              <span>Expediente</span>
              <select onChange={(event) => applyProcess(event.target.value)} value={processId}>
                <option value="">Sin expediente</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.nomenclature}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === "upload" ? (
            <>
              <label className={S.uploadField}>
                <Upload size={18} />
                <span>{file ? file.name : "Selecciona un PDF para análisis temporal"}</span>
                <input accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              <label className={S.inlineCheck}>
                <input checked={saveToLibrary} onChange={(event) => setSaveToLibrary(event.target.checked)} type="checkbox" />
                <span>Enviar también a biblioteca documental para Storage, chunks y Pinecone.</span>
              </label>
            </>
          ) : (
            <label className={C.promptInput}>
              <span>Documento del corpus</span>
              <select onChange={(event) => setSelectedDoc(event.target.value)} value={selectedDoc}>
                <option value="">Elige un documento...</option>
                {docs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({documentTypeLabel(doc.document_type)})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={C.analysisHelpBox}>
            <ShieldCheck size={18} />
            <div>
              <strong>{labelProcessType(processType) ?? "Proceso"}</strong>
              <span>
                {documentKind === "contrato"
                  ? "Se revisan cláusulas contractuales y fuentes normativas."
                  : "El análisis aplicará reglas del procedimiento y no tratará el documento como contrato."}
              </span>
              {selectedProcess ? <small>Vinculado a {selectedProcess.nomenclature}.</small> : null}
            </div>
          </div>

          <div className={C.formActions}>
            <button className={buttonClasses({ variant: "primary" })} disabled={loading} onClick={runAnalysis} type="button">
              {loading ? <LoaderCircle size={18} /> : <ScanSearch size={18} />}
              {loading ? "Analizando..." : "Analizar documento"}
            </button>
            <button className={buttonClasses({ variant: "secondary" })} onClick={openValidator} type="button">
              <ShieldCheck size={16} />
              Validar este procedimiento
            </button>
          </div>

          {error ? <p className={C.errorText_formMessage}>{error}</p> : null}
          {message ? <p className={C.formMessage_successText}>{message}</p> : null}
        </div>
      </div>

      {analysis ? (
        <div className={S.analysisReport}>
          <div className={S.evidenceSummary}>
            <div className={S.evidenceSummaryHeader}>
              <span className={analysis.confidence === "alta" ? C.confidencePill_high : analysis.confidence === "media" ? C.confidencePill_medium : C.confidencePill_low}>Confianza {analysis.confidence}</span>
              <span className={missingClauses > 0 ? cn(S.sourceBadge, "warning") : S.sourceBadge_valid}>
                {analysis.clausulas.length
                  ? missingClauses > 0
                    ? `${missingClauses} cláusula(s) faltante(s)`
                    : "Cláusulas contractuales presentes"
                  : "Checklist según documento/proceso"}
              </span>
            </div>
            <p>{analysis.resumen}</p>
            <small>{analysis.confidenceReason}</small>
            <div className={cn(C.formActions, "compactActions")}>
              <button className={buttonClasses({ variant: "secondary" })} onClick={exportAnalysis} type="button">
                <Download size={16} />
                Exportar Word
              </button>
            </div>
          </div>

          <section className={S.analysisSection}>
            <h3>
              <ShieldCheck size={17} /> Fuentes críticas
            </h3>
            <div className={C.sourceCoverage}>
              {analysis.criticalSources.map((item) => (
                <span data-ready={item.ok} key={item.code}>
                  {item.label}: {item.ok ? "ok" : "falta"}
                </span>
              ))}
            </div>
            {analysis.criticalSources.some((item) => !item.ok) ? (
              <ul className={S.analysisList}>
                {analysis.criticalSources
                  .filter((item) => !item.ok)
                  .map((item) => (
                    <li key={item.code}>{item.missing}</li>
                  ))}
              </ul>
            ) : null}
            <div className={C.sourceCoverage}>
              {coverageEntries.map(([key, label, ready]) => (
                <span data-ready={Boolean(ready)} key={String(key)}>
                  {label}: {ready ? "sí" : "no"}
                </span>
              ))}
            </div>
          </section>

          <section className={S.analysisSection}>
            <h3>
              <ListChecks size={17} /> Checklist operativo
            </h3>
            <div className={S.clauseList}>
              {analysis.checklist.map((item) => (
                <div className={`${S.clauseItem} ${item.done ? S.ok : S.missing}`} key={item.label}>
                  {item.done ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {analysis.clausulas.length ? (
            <section className={S.analysisSection}>
              <h3>
                <ShieldCheck size={17} /> Cláusulas obligatorias del contrato
              </h3>
              <div className={S.clauseList}>
                {analysis.clausulas.map((clause) => (
                  <div className={`${S.clauseItem} ${clause.presente ? S.ok : S.missing}`} key={clause.key}>
                    {clause.presente ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <div>
                      <strong>{clause.label}</strong>
                      <span>{clause.nota}</span>
                      {clause.evidence ? <small>Coincidencia positiva: {clause.evidence}</small> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(["incumplimiento", "riesgo", "recomendacion", "revision_humana"] as const).map((category) =>
            groupedFindings[category].length ? (
              <section className={S.analysisSection} key={category}>
                <h3>
                  {findingIcon(category)} {findingTitle(category)}
                </h3>
                <div className={C.ruleList}>
                  {groupedFindings[category].map((finding, index) => (
                    <article className={C.ruleItem} data-tone={category === "incumplimiento" ? "bad" : category === "recomendacion" ? "ok" : "warn"} key={`${category}-${index}`}>
                      <div>
                        <strong>{finding.severity}</strong>
                        {finding.sources.length ? <span>Fuentes: {finding.sources.map((source) => `F${source}`).join(", ")}</span> : null}
                      </div>
                      <p>{finding.message}</p>
                      <button className={buttonClasses({ variant: "secondary", size: "sm" })} onClick={() => sendFindingToChat(finding)} type="button">
                        <MessageSquareText size={15} />
                        Enviar al chat
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null,
          )}

          {analysis.riesgos.length > 0 ? (
            <section className={S.analysisSection}>
              <h3>
                <AlertTriangle size={17} /> Riesgos adicionales
              </h3>
              <ul className={S.analysisList}>
                {analysis.riesgos.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {analysis.recomendaciones.length > 0 ? (
            <section className={S.analysisSection}>
              <h3>
                <Lightbulb size={17} /> Recomendaciones adicionales
              </h3>
              <ul className={S.analysisList}>
                {analysis.recomendaciones.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {analysis.sources.length > 0 ? (
            <section className={S.analysisSection}>
              <h3>
                <FileText size={17} /> Fuentes usadas
              </h3>
              <div className={C.documentList}>
                {analysis.sources.map((source, index) => (
                  <article className={C.sourceItem} key={source.documentId + source.chunkId + index}>
                    <div className={C.sourceItemHeader}>
                      <div>
                        <span>
                          [F{index + 1}] {documentTypeLabel(source.documentType)}
                        </span>
                        <strong>{source.documentTitle}</strong>
                      </div>
                    </div>
                    <div className={C.sourceMetaGrid}>
                      <span>{source.citation}</span>
                      <span>{source.vigencia === "derogado" ? "No vigente" : "Vigencia por verificar"}</span>
                    </div>
                    <p>{source.excerpt.slice(0, 360)}</p>
                    <div className={C.sourceActions}>
                      <PdfCiteButton documentId={source.documentId} page={source.pageStart} quote={source.excerpt} />
                      <button
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                        onClick={() =>
                          sendFindingToChat({
                            category: "revision_humana",
                            message: `Explica esta fuente: ${source.documentTitle} ${source.article ? `articulo ${source.article}` : ""}`,
                            severity: "medio",
                            sources: [index + 1],
                          })
                        }
                        type="button"
                      >
                        <MessageSquareText size={15} />
                        Consultar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <p className={S.analysisDisclaimer}>
            Análisis de apoyo generado con IA sobre el corpus indexado; no constituye asesoría legal vinculante. Verifica texto,
            página, artículo y vigencia antes de usarlo formalmente.
          </p>
        </div>
      ) : null}

      {history.length ? (
        <section className={S.analyzerHistory_toolPanel}>
          <div className={C.toolPanelHeader}>
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Historial</p>
              <h2>Últimos análisis</h2>
            </div>
            <History size={20} />
          </div>
          <div className={C.ruleList}>
            {history.slice(0, 6).map((item) => (
              <article className={C.ruleItem} data-tone={item.result?.confidence === "alta" ? "ok" : "warn"} key={item.id}>
                <div>
                  <FileText size={16} />
                  <strong>{item.title}</strong>
                  <span>{new Date(item.created_at).toLocaleString("es-PE")}</span>
                </div>
                <p>
                  {processDocKindLabel(item.result?.documentKind)} · {labelProcessType(item.result?.processType) ?? "Sin proceso"} · confianza{" "}
                  {item.result?.confidence ?? "baja"}
                </p>
                <small>{item.result?.confidenceReason ?? "Sin detalle"}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
