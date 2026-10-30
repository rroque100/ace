"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, type SetStateAction } from "react";
import { ExamBankFields } from "./exam-bank-fields";
import { ExamEditorialTask } from "./exam-learning";
import { ExamEditorialPanel } from "./exam-editorial-panel";
import { EXAM_CURRICULUM } from "@/lib/exam-curriculum";
import {
  OPTION_IDS,
  examQuestionSchema,
  examReviewFingerprint,
  type ExamQuestion,
} from "@/lib/exam-policy";
type Document = {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
};
type Row = Omit<
  ExamQuestion,
  "correctOption" | "reviewBasis" | "confirmReview"
> & {
  correct_option: "A" | "B" | "C" | "D";
  review_basis: string | null;
  curriculum_version?: string;
  competency_code?: string;
  subcompetency_code?: string;
  cognitive_level?: ExamQuestion["cognitiveLevel"];
  option_rationales?: ExamQuestion["optionRationales"];
  review_checks?: ExamQuestion["reviewChecks"];
  source_cutoff?: string;
  origin?: string;
};
type Bank = {
  questions: Row[];
  documents: Document[];
  total: number;
  page: number;
};
type Passage = {
  id: string;
  content: string;
  page_start: number;
  page_end: number;
  metadata: { article?: string };
};
const field =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20";
const toDraft = (q: Row): ExamQuestion => ({
  id: q.id,
  revision: q.revision,
  prompt: q.prompt,
  options: q.options,
  correctOption: q.correct_option,
  explanation: q.explanation,
  regime: q.regime,
  topic: q.topic,
  competency: q.competency,
  difficulty: q.difficulty,
  curriculumVersion: q.curriculum_version ?? "",
  competencyCode: q.competency_code ?? "",
  subcompetencyCode: q.subcompetency_code ?? "",
  cognitiveLevel: q.cognitive_level ?? "understand",
  optionRationales: q.option_rationales ?? { A: "", B: "", C: "", D: "" },
  reviewChecks: q.review_checks ?? {
    unambiguous: false,
    distractors: false,
    conditions: false,
    exceptions: false,
    sources: false,
  },
  sourceCutoff: q.source_cutoff ?? "",
  origin: q.origin ?? "manual",
  sources: q.sources,
  status: q.status,
  reviewBasis: q.review_basis ?? "",
  confirmReview: false,
});
const blank = (): ExamQuestion => ({
  revision: 0,
  prompt: "",
  options: OPTION_IDS.map((id) => ({ id, text: "" })),
  correctOption: "A",
  explanation: "",
  regime: "32069",
  topic: "",
  competency: "",
  difficulty: "basic",
  curriculumVersion: "",
  competencyCode: "",
  subcompetencyCode: "",
  cognitiveLevel: "understand",
  optionRationales: { A: "", B: "", C: "", D: "" },
  reviewChecks: {
    unambiguous: false,
    distractors: false,
    conditions: false,
    exceptions: false,
    sources: false,
  },
  sourceCutoff: "",
  origin: "manual",
  sources: [],
  status: "draft",
  reviewBasis: "",
  confirmReview: false,
});
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const x = await r.json();
  if (!r.ok) throw Error(x.error ?? "No se pudo consultar el banco.");
  return x;
}
export function ExamBank() {
  const initialCode = useSearchParams().get("subcompetency") ?? "";
  const validInitialCode = EXAM_CURRICULUM.some((s) => s.code === initialCode)
    ? initialCode
    : "";
  const [bank, setBank] = useState<Bank | null>(null),
    [draft, setDraftBase] = useState<ExamQuestion | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1),
    [statusFilter, setStatusFilter] = useState(validInitialCode ? "draft" : ""),
    [questionFilter, setQuestionFilter] = useState(""),
    [subFilter, setSubFilter] = useState(validInitialCode),
    [documentId, setDocumentId] = useState(""),
    [sourcePage, setSourcePage] = useState(2),
    [passages, setPassages] = useState<{
      document: Document;
      chunks: Passage[];
    } | null>(null);
  const setDraft = useCallback(
    (next: SetStateAction<ExamQuestion | null>) =>
      setDraftBase((previous) => {
        const proposed = typeof next === "function" ? next(previous) : next;
        if (
          previous &&
          proposed &&
          previous.id === proposed.id &&
          examReviewFingerprint(previous) !== examReviewFingerprint(proposed)
        )
          return {
            ...proposed,
            confirmReview: false,
            reviewChecks: {
              unambiguous: false,
              distractors: false,
              conditions: false,
              exceptions: false,
              sources: false,
            },
          };
        return proposed;
      }),
    [],
  );
  useEffect(() => {
    const c = new AbortController();
    api<Bank>(
      `/api/exams/bank?page=${page}&status=${statusFilter}&subcompetency=${subFilter}&questionId=${questionFilter}`,
      { signal: c.signal },
    )
      .then((x) => {
        setBank(x);
        setDraft(
          (prev) => prev ?? (x.questions[0] ? toDraft(x.questions[0]) : null),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [page, statusFilter, subFilter, questionFilter, setDraft]);
  async function reload() {
    const x = await api<Bank>(
      `/api/exams/bank?page=${page}&status=${statusFilter}&subcompetency=${subFilter}&questionId=${questionFilter}`,
    );
    setBank(x);
  }
  async function save(status: ExamQuestion["status"]) {
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api<{ id: string }>("/api/exams/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, status }),
      });
      const x = await api<Bank>(
        `/api/exams/bank?page=${page}&status=${statusFilter}&subcompetency=${subFilter}&questionId=${questionFilter}`,
      );
      setBank(x);
      const q = x.questions.find((q) => q.id === r.id);
      if (q) setDraft(toDraft(q));
      setNotice(
        status === "published"
          ? "Pregunta publicada con tu revisión registrada."
          : status === "retired"
            ? "Pregunta retirada de nuevos intentos; el historial se conserva."
            : "Borrador guardado. Todavía no aparece en los exámenes de los usuarios.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadPassages() {
    setBusy(true);
    setError("");
    try {
      setPassages(
        await api(
          `/api/exams/bank?documentId=${documentId}&page=${sourcePage}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function pick(p: Passage) {
    if (!draft || !passages) return;
    const d = passages.document;
    setDraft({
      ...draft,
      sources: [
        {
          documentId: d.id,
          chunkId: p.id,
          title: d.title,
          article: String(p.metadata.article ?? ""),
          pageStart: p.page_start,
          pageEnd: p.page_end,
          quote: p.content,
          version: String(d.metadata.officialVersion ?? ""),
          sha256: String(d.metadata.sha256 ?? ""),
        },
      ],
    });
    setPassages(null);
  }
  return (
    <div className="tw mx-auto max-w-7xl space-y-5 pb-8 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">
            Preguntas propias, revisión trazable
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Revisa el enunciado, cada alternativa y la explicación contra la
            fuente antes de publicar. Los borradores no forman parte del banco
            público.
          </p>
        </div>
        <Link className="secondaryButton" href="/simulador">
          Volver al simulador
        </Link>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-4 text-sm">
          {notice}
        </p>
      )}
      {draft?.id && (
        <ExamEditorialTask
          key={draft.id + ":" + draft.revision}
          questionId={draft.id}
          revision={draft.revision}
        />
      )}
      <ExamEditorialPanel
        onDrafts={() => void reload().catch((e) => setError(e.message))}
        onQuestion={(id) => {
          setQuestionFilter(id);
          setPage(1);
          setStatusFilter("");
          setSubFilter("");
          setDraft(null);
        }}
      />
      {questionFilter && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm">
          Pregunta seleccionada desde un reporte.
          <button
            className="secondaryButton"
            onClick={() => {
              setQuestionFilter("");
              setDraft(null);
            }}
          >
            Mostrar todo el banco
          </button>
        </div>
      )}
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <label className="text-sm">
          Estado
          <select
            className={field}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setDraft(null);
            }}
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
            <option value="retired">Retirada</option>
          </select>
        </label>
        <label className="text-sm">
          Filtrar por subcompetencia
          <select
            className={field}
            value={subFilter}
            onChange={(e) => {
              setSubFilter(e.target.value);
              setPage(1);
              setDraft(null);
            }}
          >
            <option value="">Todas</option>
            {EXAM_CURRICULUM.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!bank ? (
        <p>Cargando el banco…</p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{bank.total} preguntas</h2>
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => {
                  setDraft(blank());
                  setPassages(null);
                  setNotice("");
                  setError("");
                }}
              >
                Nueva pregunta
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {bank.questions.map((q) => (
                <li key={q.id}>
                  <button
                    disabled={busy}
                    className={`w-full rounded-xl border p-3 text-left ${draft?.id === q.id ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
                    onClick={() => {
                      setDraft(toDraft(q));
                      setPassages(null);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <span className="block text-xs font-semibold text-teal-800">
                      {q.status === "published"
                        ? "Publicada"
                        : q.status === "retired"
                          ? "Retirada"
                          : "Borrador"}{" "}
                      · Ley {q.regime}
                    </span>
                    <span className="mt-1 block text-sm">{q.prompt}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="secondaryButton"
                disabled={page === 1 || busy}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span className="text-xs">
                {page}/{Math.max(1, Math.ceil(bank.total / 30))}
              </span>
              <button
                className="secondaryButton"
                disabled={page * 30 >= bank.total || busy}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </aside>
          {draft ? (
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <h2 className="text-xl font-semibold">
                {draft.id ? "Revisar pregunta" : "Preparar pregunta original"}
              </h2>
              <fieldset disabled={busy} className="mt-5 space-y-4">
                <label className="block text-sm font-medium">
                  Pregunta
                  <textarea
                    rows={4}
                    className={field}
                    value={draft.prompt}
                    onChange={(e) =>
                      setDraft({ ...draft, prompt: e.target.value })
                    }
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {draft.options.map((o, i) => (
                    <label key={o.id} className="text-sm font-medium">
                      Alternativa {o.id}
                      <textarea
                        rows={3}
                        className={field}
                        value={o.text}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((x, n) =>
                              n === i ? { ...x, text: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Respuesta correcta
                    <select
                      className={field}
                      value={draft.correctOption}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          correctOption: e.target
                            .value as ExamQuestion["correctOption"],
                        })
                      }
                    >
                      {OPTION_IDS.map((id) => (
                        <option key={id}>{id}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Régimen
                    <select
                      className={field}
                      value={draft.regime}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          regime: e.target.value as "32069" | "30225",
                        })
                      }
                    >
                      <option value="32069">Ley 32069</option>
                      <option value="30225">Ley 30225</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Tema
                    <input
                      className={field}
                      value={draft.topic}
                      onChange={(e) =>
                        setDraft({ ...draft, topic: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Competencia
                    <input
                      className={field}
                      value={draft.competency}
                      onChange={(e) =>
                        setDraft({ ...draft, competency: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Dificultad
                    <select
                      className={field}
                      value={draft.difficulty}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          difficulty: e.target
                            .value as ExamQuestion["difficulty"],
                        })
                      }
                    >
                      <option value="basic">Básica</option>
                      <option value="intermediate">Intermedia</option>
                      <option value="advanced">Avanzada</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  Explicación y descarte de alternativas
                  <textarea
                    rows={5}
                    className={field}
                    value={draft.explanation}
                    onChange={(e) =>
                      setDraft({ ...draft, explanation: e.target.value })
                    }
                  />
                </label>
                <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                  <h3 className="font-semibold">Fundamento documental</h3>
                  {draft.sources.map((s) => (
                    <div key={s.chunkId} className="mt-3">
                      <p className="text-xs font-semibold">
                        {s.title} · artículo {s.article} · páginas {s.pageStart}
                        –{s.pageEnd}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{s.version}</p>
                      <blockquote className="my-3 whitespace-pre-wrap border-l-2 border-teal-500 pl-3 text-sm leading-relaxed">
                        {s.quote}
                      </blockquote>
                      <a
                        className="secondaryButton"
                        href={`/api/documents/${s.documentId}#page=${s.pageStart}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir fuente original
                      </a>
                    </div>
                  ))}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Elegir otro pasaje oficial
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px]">
                      <label className="text-sm">
                        Documento
                        <select
                          className={field}
                          value={documentId}
                          onChange={(e) => setDocumentId(e.target.value)}
                        >
                          <option value="">Elige una fuente</option>
                          {bank.documents
                            .filter(
                              (d) =>
                                d.metadata.sha256 && d.metadata.officialVersion,
                            )
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        Página
                        <input
                          type="number"
                          min={1}
                          max={20000}
                          className={field}
                          value={sourcePage}
                          onChange={(e) =>
                            setSourcePage(Number(e.target.value))
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="secondaryButton mt-3"
                      disabled={busy || !documentId || sourcePage < 1}
                      onClick={() => void loadPassages()}
                    >
                      Buscar pasajes en esta página
                    </button>
                    {passages && (
                      <ul className="mt-3 space-y-3">
                        {!passages.chunks.length && (
                          <li className="text-sm">
                            No hay pasajes en esta página. Revisa el PDF y elige
                            otra.
                          </li>
                        )}
                        {passages.chunks
                          .filter((p) => p.metadata.article)
                          .map((p) => (
                            <li
                              key={p.id}
                              className="rounded-lg border bg-white p-3"
                            >
                              <p className="text-xs font-semibold">
                                Artículo {p.metadata.article} · páginas{" "}
                                {p.page_start}–{p.page_end}
                              </p>
                              <p className="my-2 line-clamp-5 text-sm">
                                {p.content}
                              </p>
                              <button
                                className="secondaryButton"
                                onClick={() => pick(p)}
                                disabled={p.content.length > 5000}
                              >
                                Usar este pasaje
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </details>
                </section>
                <ExamBankFields value={draft} onChange={setDraft} />
                <label className="block text-sm font-medium">
                  Sustento de tu revisión
                  <textarea
                    rows={3}
                    className={field}
                    placeholder="Explica qué contrastaste y cómo la fuente respalda una única alternativa correcta."
                    value={draft.reviewBasis}
                    onChange={(e) =>
                      setDraft({ ...draft, reviewBasis: e.target.value })
                    }
                  />
                </label>
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    className="mt-1 h-4 w-4"
                    type="checkbox"
                    checked={draft.confirmReview}
                    onChange={(e) =>
                      setDraft({ ...draft, confirmReview: e.target.checked })
                    }
                  />
                  He revisado la pregunta, las cuatro alternativas, la clave y
                  su fundamento para la versión normativa indicada.
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="secondaryButton"
                    onClick={() => void save("draft")}
                  >
                    Guardar borrador
                  </button>
                  <button
                    className="primaryButton"
                    disabled={
                      !examQuestionSchema.safeParse({
                        ...draft,
                        status: "published",
                      }).success
                    }
                    onClick={() => void save("published")}
                  >
                    Publicar pregunta revisada
                  </button>
                  {draft.id && (
                    <button
                      className="secondaryButton"
                      onClick={() => void save("retired")}
                    >
                      Retirar de nuevos intentos
                    </button>
                  )}
                </div>
              </fieldset>
              <p className="mt-4 text-xs text-slate-500">
                Publicar registra tu revisión. Los intentos anteriores conservan
                la versión que utilizaron. Si cambia el archivo de la fuente, la
                pregunta queda fuera de nuevos intentos hasta volver a
                comprobarla.
              </p>
            </section>
          ) : (
            <p className="rounded-2xl border bg-white p-6 text-sm">
              Crea una pregunta propia o selecciona un borrador para revisarlo.
            </p>
          )}
        </div>
      )}
      <button
        className="secondaryButton"
        disabled={busy}
        onClick={() => void reload().catch((e) => setError(e.message))}
      >
        Actualizar banco
      </button>
    </div>
  );
}
