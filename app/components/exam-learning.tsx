"use client";
import { useEffect, useState } from "react";
import type { PublicExam } from "@/lib/exam-policy";
import { EXAM_CURRICULUM } from "@/lib/exam-curriculum";
import { examStudyReport, type StudyReview } from "@/lib/exam-learning-policy";
export type SetAttempt = {
  setId: string;
  attemptId: string;
  date: string;
  result: { correct: number; total: number };
};
type Learning = {
  reviews: Array<StudyReview & { available: boolean; updated: boolean }>;
  limited: boolean;
  tasks: EditorialTask[];
  setAttempts: Array<{
    setId: string;
    attemptId: string;
    date: string;
    result: { correct: number; total: number };
  }>;
};
type EditorialTask = {
  question_id: string;
  question_revision: number;
  mine: boolean;
  assigned_name?: string;
  state: string;
  note: string;
  history: Array<{ state: string; note: string; at: string }>;
  updated_at: string;
};
export function ExamLearningDashboard({
  onScheduled,
  onOpen,
  onTopic,
  busy,
  onSets,
}: {
  onSets: (sets: SetAttempt[]) => void;
  onScheduled: (regime: string) => void;
  onOpen: (id: string) => void;
  onTopic: (topic: string) => void;
  busy: boolean;
}) {
  const [data, setData] = useState<Learning | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/exams/learning", { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw Error(x.error);
        return x;
      })
      .then((x) => {
        setData(x);
        onSets(x.setAttempts);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [onSets]);
  return (
    <section
      id="exam-review"
      className="examHistory space-y-4"
      aria-labelledby="review-title"
    >
      <h2 id="review-title">Qué estudiar después</h2>
      <p className="text-sm text-slate-600">
        Repasos de 1, 3, 7, 14 y 30 días según tus respuestas. Repetir varias
        veces el mismo día no demuestra retención.
      </p>
      {error ? (
        <p role="alert">No se pudo consultar tu plan: {error}</p>
      ) : !data ? (
        <p role="status">Consultando tu plan de estudio…</p>
      ) : (
        <>
          {data.limited && (
            <p className="text-xs">
              Plan calculado con tus últimos 100 intentos entregados.
            </p>
          )}
          {!data.reviews.length ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm">
              Al terminar una práctica con preguntas publicadas, tus errores y
              omisiones aparecerán aquí. Los borradores administrativos no
              cuentan.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {["32069", "30225"].map((regime) => {
                  const n = data.reviews.filter(
                    (r) => r.due && r.available && r.regime === regime,
                  ).length;
                  return (
                    <button
                      className="primaryButton"
                      key={regime}
                      disabled={busy || !n}
                      onClick={() => onScheduled(regime)}
                    >
                      Repasar hoy · Ley {regime} ({n})
                    </button>
                  );
                })}
              </div>
              <ul className="divide-y divide-slate-100">
                {data.reviews.slice(0, 12).map((r) => (
                  <li
                    key={r.questionId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{r.topic}</p>
                      <p className="text-xs text-slate-600">
                        {r.status} ·{" "}
                        {r.due
                          ? "Repaso pendiente"
                          : `Próximo: ${new Date(r.dueAt).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`}
                        {!r.available
                          ? " · Fuente no disponible para repasar"
                          : r.updated
                            ? " · Se usará la versión actual"
                            : ""}
                      </p>
                    </div>
                    <button
                      className="secondaryButton"
                      onClick={() => onTopic(r.topic)}
                    >
                      Estudiar tema
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <details className="examDisclosure">
            <summary>Mis resultados en balotarios</summary>
            {data.setAttempts.length ? (
              <ul className="mt-3 space-y-2">
                {data.setAttempts.slice(0, 15).map((a) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={a.attemptId}
                  >
                    <span>
                      {new Date(a.date).toLocaleDateString("es-PE")} ·{" "}
                      {a.result?.correct ?? 0}/{a.result?.total ?? 72} correctas
                    </span>
                    <button
                      disabled={busy}
                      className="secondaryButton"
                      onClick={() => onOpen(a.attemptId)}
                    >
                      Revisar resultado
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm">
                Todavía no has entregado un balotario publicado.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
export function ExamStudyReport({
  exam,
  onTopic,
}: {
  exam: PublicExam;
  onTopic: (topic: string) => void;
}) {
  const rows = examStudyReport(exam);
  const [activity, setActivity] = useState<Array<{
      question_id: string;
      seconds: number;
    }> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (exam.attempt.state !== "submitted") return;
    const c = new AbortController();
    fetch(`/api/exams/learning?attemptId=${exam.attempt.id}`, {
      signal: c.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw Error(x.error);
        return x.activity;
      })
      .then(setActivity)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [exam.attempt.id, exam.attempt.state]);
  if (!rows) return null;
  const observed = activity?.reduce((n, x) => n + x.seconds, 0) ?? 0;
  return (
    <section className="examHistory space-y-4" aria-labelledby="study-report">
      <h2 id="study-report">Tu informe de estudio</h2>
      <p className="text-sm text-slate-600">
        {exam.attempt.preview
          ? "Revisión de borradores: resultado excluido de tus métricas de preparación."
          : "Recomendaciones basadas en este intento; no son una predicción de aprobación."}
      </p>
      <p className="text-sm">
        {error
          ? `No se pudo consultar el tiempo observado: ${error}`
          : activity === null
            ? "Consultando tiempo observado…"
            : observed
              ? `Tiempo activo observado: ${Math.floor(observed / 60)} min ${observed % 60} s. Es una medición parcial de actividad visible, no el tiempo total del examen.`
              : "Sin medición suficiente de tiempo activo."}
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.topic} className="space-y-3 py-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">{row.topic}</h3>
                <p className="text-sm">
                  {row.correct}/{row.total} correctas · {row.omitted} omitidas
                </p>
              </div>
              <button
                className="secondaryButton"
                onClick={() => onTopic(row.topic)}
              >
                Practicar este tema
              </button>
            </div>
            {row.sources.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm">
                  Normas para repasar
                </summary>
                <ul className="mt-3 space-y-2">
                  {row.sources.map((s) => (
                    <li
                      key={s.documentId + ":" + s.article + ":" + s.pageStart}
                      className="text-sm"
                    >
                      <a
                        className="underline"
                        href={`/api/exams/documents/${s.documentId}?attemptId=${exam.attempt.id}#page=${s.pageStart}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.title} · {s.article ? `art. ${s.article} · ` : ""}p.{" "}
                        {s.pageStart}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function ExamTutor({
  attemptId,
  questionId,
}: {
  attemptId: string;
  questionId: string;
}) {
  const [data, setData] = useState<{
      paragraphs: Array<{ text: string; sources: number[] }>;
      missing: string[];
      sources: Array<{ title: string; documentId: string; pageStart: number }>;
      preview: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function ask(action: string) {
    setBusy(true);
    setError("");
    setData(null);
    try {
      const r = await fetch("/api/exams/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, questionId, action }),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setData(x);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="examDisclosure mt-5">
      <summary>Tutor de estudio con IA</summary>
      <p className="mt-3 text-xs text-slate-600">
        Explicación asistida a partir de las fuentes de esta pregunta. La clave
        y la nota conservan su revisión editorial.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        {[
          ["mistake", "Explicar mi respuesta"],
          ["example", "Dar un ejemplo"],
          ["alternatives", "Comparar alternativas"],
        ].map(([action, label]) => (
          <button
            className="secondaryButton"
            key={action}
            disabled={busy}
            onClick={() => void ask(action)}
          >
            {label}
          </button>
        ))}
      </div>
      {busy && <p role="status">Consultando las fuentes de la pregunta…</p>}
      {error && (
        <p role="alert" className="text-sm">
          Tutor no disponible: {error}. Puedes seguir leyendo la explicación y
          el pasaje original.
        </p>
      )}
      {data && (
        <div className="space-y-3 text-sm">
          {data.preview && (
            <p className="font-semibold">
              Pregunta en borrador, pendiente de revisión.
            </p>
          )}
          {data.paragraphs.map((p, i) => (
            <p key={i}>
              {p.text}{" "}
              {p.sources.map((n) => (
                <a
                  className="font-semibold underline"
                  key={n}
                  target="_blank"
                  rel="noreferrer"
                  href={`/api/exams/documents/${data.sources[n - 1].documentId}?attemptId=${attemptId}#page=${data.sources[n - 1].pageStart}`}
                >
                  [{n}]{" "}
                </a>
              ))}
            </p>
          ))}
          {data.missing.length > 0 && (
            <div>
              <p className="font-semibold">Qué falta comprobar</p>
              <ul className="list-disc pl-5">
                {data.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs">
            {data.sources
              .map((s, i) => `${i + 1}. ${s.title} · p. ${s.pageStart}`)
              .join(" / ")}
          </p>
        </div>
      )}
    </details>
  );
}
export function ExamEditorialTask({
  questionId,
  revision,
}: {
  questionId: string;
  revision: number;
}) {
  const [state, setState] = useState("reviewing"),
    [note, setNote] = useState(""),
    [task, setTask] = useState<EditorialTask | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/exams/learning?queue=1", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw Error(x.error);
        return (
          x.tasks?.find(
            (t: EditorialTask) =>
              t.question_id === questionId && t.question_revision === revision,
          ) ?? null
        );
      })
      .then(setTask)
      .catch((e) => {
        if (!c.signal.aborted) setMessage(e.message);
      });
    return () => c.abort();
  }, [questionId, revision]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/exams/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "editorial",
          questionId,
          revision,
          state,
          note,
        }),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setMessage(
        "Responsable y observación registrados. La pregunta conserva su estado de publicación.",
      );
      setTask({
        ...task,
        question_id: questionId,
        question_revision: revision,
        mine: true,
        state,
        note,
        history: [
          ...(task?.history ?? []),
          { state, note, at: new Date().toISOString() },
        ],
        updated_at: new Date().toISOString(),
      } as EditorialTask);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">
        Seguimiento de la revisión · versión {revision}
      </summary>
      <p className="mt-3 text-sm">
        {task
          ? `${task.mine ? "Asignada a ti" : `Responsable: ${task.assigned_name ?? "otro administrador"}`} · ${task.state === "blocked" ? "Con observaciones" : task.state === "pending" ? "Pendiente" : "En revisión"}`
          : "Sin responsable registrado para esta versión."}
      </p>
      <label className="mt-3 block text-sm">
        Estado de trabajo
        <select
          className="mt-1 w-full rounded-lg border p-3"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="reviewing">En revisión</option>
          <option value="blocked">Con observaciones</option>
          <option value="pending">Pendiente</option>
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Observaciones
        <textarea
          className="mt-1 w-full rounded-lg border p-3"
          value={note}
          minLength={10}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </label>
      <button
        className="secondaryButton mt-3"
        disabled={busy || note.trim().length < 10}
        onClick={() => void save()}
      >
        Asignarme y registrar seguimiento
      </button>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {task?.history?.length ? (
        <ul className="mt-3 space-y-2 text-xs">
          {task.history.slice(-8).map((h, i) => (
            <li key={i}>
              {new Date(h.at).toLocaleString("es-PE")} · {h.state} · {h.note}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
export function ExamEditorialQueue({
  coverage,
  onQuestion,
}: {
  coverage: Array<{ code: string; quota: number; published: number }>;
  onQuestion: (id: string) => void;
}) {
  const [data, setData] = useState<{
      queue: Array<{
        id: string;
        revision: number;
        prompt: string;
        subcompetency_code: string;
      }>;
      tasks: EditorialTask[];
      total: number;
    } | null>(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/exams/learning?queue=1", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw Error(x.error);
        return x;
      })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  const priority = (code: string) => {
    const c = coverage.find((c) => c.code === code);
    return c ? Math.max(0, c.quota - c.published) : 0;
  };
  const rows = [...(data?.queue ?? [])]
    .filter((q) => {
      const t = data?.tasks.find(
        (t) => t.question_id === q.id && t.question_revision === q.revision,
      );
      return (
        filter === "all" ||
        (filter === "mine" && t?.mine) ||
        (filter === "unassigned" && !t) ||
        (filter === "blocked" && t?.state === "blocked")
      );
    })
    .sort(
      (a, b) => priority(b.subcompetency_code) - priority(a.subcompetency_code),
    );
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">
        Cola de revisión jurídica · {data?.total ?? "…"} borradores
      </summary>
      <p className="mt-3 text-sm text-slate-600">
        Prioridad por faltantes para habilitar el primer simulacro. Asignar una
        revisión no aprueba ni publica la pregunta.
      </p>
      <label className="mt-3 block text-sm">
        Mostrar
        <select
          className="mt-1 rounded-lg border p-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todas las pendientes</option>
          <option value="unassigned">Sin responsable</option>
          <option value="mine">Asignadas a mí</option>
          <option value="blocked">Con observaciones</option>
        </select>
      </label>
      {error && <p role="alert">No se pudo consultar la cola: {error}</p>}
      <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {rows.map((q) => {
          const task = data?.tasks.find(
            (t) => t.question_id === q.id && t.question_revision === q.revision,
          );
          return (
            <li className="space-y-2 py-4 text-sm" key={q.id}>
              <p className="font-semibold">{q.prompt}</p>
              <p className="text-xs text-slate-600">
                {q.subcompetency_code
                  ? `${q.subcompetency_code} · ${EXAM_CURRICULUM.find((s) => s.code === q.subcompetency_code)?.label ?? "Clasificación por revisar"}`
                  : "Sin clasificación"}{" "}
                · Faltan {priority(q.subcompetency_code)} revisadas en esta
                subcompetencia ·{" "}
                {task
                  ? task.mine
                    ? "Asignada a ti"
                    : "Asignada a otro administrador"
                  : "Sin responsable"}
              </p>
              {task && <p className="text-xs">Observación: {task.note}</p>}
              <button
                className="secondaryButton"
                onClick={() => onQuestion(q.id)}
              >
                Abrir revisión
              </button>
            </li>
          );
        })}
      </ul>
      {data && !rows.length && (
        <p className="mt-3 text-sm">No hay borradores en este filtro.</p>
      )}
      {data && data.total > 1000 && (
        <p className="text-xs">
          Se muestran hasta 1.000 borradores; usa los filtros del banco para
          continuar.
        </p>
      )}
    </details>
  );
}
