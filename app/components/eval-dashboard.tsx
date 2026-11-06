"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { Activity, CheckCircle2, Gauge, MessageSquareWarning, Play, Plus, Target, Trash2 } from "lucide-react";
import { DOCUMENT_TYPES, documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { processLabelFromOptions, useSettingsCatalog } from "./use-settings-catalog";

type Question = {
  id: string;
  question: string;
  expected_keywords: string[];
  expected_sources: Array<{
    article?: string;
    documentType?: string;
    processType?: string;
    titleIncludes?: string;
  }>;
  document_type: string | null;
  process_type: string | null;
};
type RunSummary = {
  total: number;
  avgScore: number;
  sufficientCount: number;
  avgKeywordHit: number | null;
  confidence: { alta: number; media: number; baja: number };
};
type Run = { id: string; run_at: string; summary: RunSummary };
type Result = {
  id: string;
  question: string | null;
  confidence: string | null;
  sufficient: boolean | null;
  sources_count: number | null;
  keyword_hit: number | null;
  source_hit: number | null;
  score: number | null;
  feedback: string | null;
};
type FeedbackExample = {
  id: string;
  question: string;
  answer: string | null;
  feedback: "correct" | "incorrect";
  expected_sources: unknown[];
  recovered_sources: unknown[];
  created_at: string;
};

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function scoreClass(score: number | null) {
  if (score === null) return "";
  if (score >= 0.75) return "scoreGood";
  if (score >= 0.45) return "scoreMid";
  return "scoreBad";
}

export function EvalDashboard() {
  const { processTypes } = useSettingsCatalog();
  const labelProcessType = (value?: string | null) => processLabelFromOptions(processTypes, value) ?? processTypeLabel(value);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [feedbackExamples, setFeedbackExamples] = useState<FeedbackExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [keywords, setKeywords] = useState("");
  const [expectedSources, setExpectedSources] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [processType, setProcessType] = useState("");

  async function reload() {
    const payload = await fetch("/api/eval").then((response) => response.json());
    if (payload.error) {
      setError(payload.error);
    } else {
      setQuestions(payload.preguntas ?? []);
      setRuns(payload.corridas ?? []);
      setResults(payload.lastResults ?? []);
      setFeedbackExamples(payload.feedbackExamples ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with the evaluation API when the dashboard mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  const latest = runs[0]?.summary ?? null;

  const successRate = useMemo(() => {
    if (!latest || latest.total === 0) return null;
    return latest.sufficientCount / latest.total;
  }, [latest]);
  const incorrectFeedback = feedbackExamples.filter((item) => item.feedback === "incorrect").length;

  async function runEval() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/eval", {
        body: JSON.stringify({ action: "run" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo correr la evaluacion");
      }
      await reload();
    } finally {
      setRunning(false);
    }
  }

  async function seedQuestions() {
    setError(null);
    const response = await fetch("/api/eval", {
      body: JSON.stringify({ action: "seed" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar el set base");
      return;
    }
    await reload();
  }

  async function addQuestion() {
    if (question.trim().length < 8) {
      return;
    }

    let parsedSources: unknown = [];
    if (expectedSources.trim()) {
      try {
        parsedSources = JSON.parse(expectedSources);
      } catch {
        setError("Fuentes esperadas debe ser JSON valido.");
        return;
      }
    }

    if (!Array.isArray(parsedSources)) {
      setError("Fuentes esperadas debe ser una lista JSON.");
      return;
    }

    await fetch("/api/eval", {
      body: JSON.stringify({
        action: "add",
        documentType,
        expectedKeywords: keywords
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        expectedSources: parsedSources,
        processType,
        question: question.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setQuestion("");
    setKeywords("");
    setExpectedSources("");
    setDocumentType("");
    setProcessType("");
    void reload();
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/eval?id=${id}`, { method: "DELETE" });
    setQuestions((current) => current.filter((item) => item.id !== id));
  }

  if (loading) {
    return (
      <div className="emptyState">
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div className="evalLayout">
      <div className="evalStats">
        <article className="statCard">
          <Gauge size={18} />
          <span className="statLabel">Score promedio</span>
          <strong className={scoreClass(latest?.avgScore ?? null)}>{pct(latest?.avgScore ?? null)}</strong>
        </article>
        <article className="statCard">
          <CheckCircle2 size={18} />
          <span className="statLabel">Con fuentes suficientes</span>
          <strong>{successRate === null ? "—" : pct(successRate)}</strong>
        </article>
        <article className="statCard">
          <Target size={18} />
          <span className="statLabel">Cobertura de términos</span>
          <strong>{pct(latest?.avgKeywordHit ?? null)}</strong>
        </article>
        <article className="statCard">
          <Activity size={18} />
          <span className="statLabel">Feedback capturado</span>
          <strong>{feedbackExamples.length}</strong>
        </article>
        <article className="statCard">
          <MessageSquareWarning size={18} />
          <span className="statLabel">Casos incorrectos</span>
          <strong>{incorrectFeedback}</strong>
        </article>
      </div>

      <div className="toolPanelHeader">
        <div>
          <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Calidad del RAG</p>
          <h2>Última corrida</h2>
        </div>
        <div className="buttonCluster">
          <button className={buttonClasses({ variant: "secondary" })} onClick={seedQuestions} type="button">
            <Plus size={16} />
            Set base
          </button>
          <button className={buttonClasses({ variant: "primary" })} disabled={running || questions.length === 0} onClick={runEval} type="button">
            <Play size={16} />
            {running ? "Corriendo..." : "Correr evaluación"}
          </button>
        </div>
      </div>

      {error ? <p className="evalError">{error}</p> : null}

      <div className="evalGrid">
        <section className="toolPanel">
          <div className="documentList">
            {results.length === 0 ? (
              <div className="emptyState">
                <Activity size={20} />
                <span>Sin resultados. Agrega preguntas y corre la evaluación.</span>
              </div>
            ) : (
              results.map((result) => (
                <article className="evalResult" key={result.id}>
                  <div className="evalResultHead">
                    <strong>{result.question}</strong>
                    <span className={`evalScore ${scoreClass(result.score)}`}>{pct(result.score)}</span>
                  </div>
                  <div className="feedMeta">
                    <span>Confianza: {result.confidence ?? "—"}</span>
                    <span>{result.sufficient ? "Suficiente" : "Insuficiente"}</span>
                    <span>{result.sources_count ?? 0} fuentes</span>
                    <span>Términos: {pct(result.keyword_hit)}</span>
                    <span>Fuentes esperadas: {pct(result.source_hit)}</span>
                  </div>
                  {result.feedback ? <p>{result.feedback}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Banco de preguntas</p>
              <h2>{questions.length} pregunta(s)</h2>
            </div>
          </div>
          <div className="toolBody">
            <div className="followForm">
              <textarea
                className="noteTextarea"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="¿Qué requisitos exige la Ley 32069 para...?"
                value={question}
              />
              <input
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Términos esperados separados por coma"
                value={keywords}
              />
              <textarea
                className="noteTextarea compactTextarea"
                onChange={(event) => setExpectedSources(event.target.value)}
                placeholder='Fuentes esperadas JSON. Ej. [{"documentType":"reglamento","article":"144"}]'
                value={expectedSources}
              />
              <select onChange={(event) => setDocumentType(event.target.value)} value={documentType}>
                <option value="">Cualquier tipo documental</option>
                {DOCUMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select onChange={(event) => setProcessType(event.target.value)} value={processType}>
                <option value="">Cualquier proceso</option>
                {processTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button className={buttonClasses({ variant: "secondary" })} onClick={addQuestion} type="button">
                <Plus size={16} />
                Agregar pregunta
              </button>
            </div>

            <div className="evalQuestionList">
              {questions.map((item) => (
                <article className="evalQuestion" key={item.id}>
                  <div>
                    <strong>{item.question}</strong>
                    <div className="feedMeta">
                      {item.document_type ? <span>{documentTypeLabel(item.document_type)}</span> : null}
                      {labelProcessType(item.process_type) ? <span>{labelProcessType(item.process_type)}</span> : null}
                      {(item.expected_keywords ?? []).length > 0 ? (
                        <span>{item.expected_keywords.length} término(s)</span>
                      ) : null}
                      {(item.expected_sources ?? []).length > 0 ? (
                        <span>{item.expected_sources.length} fuente(s) esperada(s)</span>
                      ) : null}
                    </div>
                  </div>
                  <button className="iconButton" onClick={() => removeQuestion(item.id)} type="button" aria-label="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {runs.length > 1 ? (
        <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Histórico</p>
              <h2>Corridas recientes</h2>
            </div>
          </div>
          <div className="evalHistory">
            {runs.map((run) => (
              <div className="evalHistoryRow" key={run.id}>
                <span>{new Date(run.run_at).toLocaleString("es-PE")}</span>
                <span className={scoreClass(run.summary.avgScore)}>Score {pct(run.summary.avgScore)}</span>
                <span>
                  {run.summary.sufficientCount}/{run.summary.total} suficientes
                </span>
                <span>Términos {pct(run.summary.avgKeywordHit)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {feedbackExamples.length > 0 ? (
        <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Memoria institucional</p>
              <h2>Feedback reciente del chat</h2>
            </div>
          </div>
          <div className="documentList">
            {feedbackExamples.map((item) => (
              <article className="evalResult" key={item.id}>
                <div className="evalResultHead">
                  <strong>{item.question}</strong>
                  <span className={`evalScore ${item.feedback === "correct" ? "scoreGood" : "scoreBad"}`}>
                    {item.feedback === "correct" ? "Correcta" : "Incorrecta"}
                  </span>
                </div>
                <div className="feedMeta">
                  <span>{new Date(item.created_at).toLocaleString("es-PE")}</span>
                  <span>{item.recovered_sources?.length ?? 0} fuente(s) recuperada(s)</span>
                  <span>{item.expected_sources?.length ?? 0} fuente(s) esperada(s)</span>
                </div>
                {item.answer ? <p>{item.answer.slice(0, 260)}...</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
