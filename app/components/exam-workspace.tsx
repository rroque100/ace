"use client";
import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { ExamActiveNotice } from "./exam-active-notice";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type SetAttempt,
  ExamLearningDashboard,
  ExamStudyReport,
  ExamTutor,
} from "./exam-learning";
import {
  resumeQuestionIndex,
  recoverPendingAnswer,
} from "@/lib/exam-learning-policy";
import { COMPETENCIES } from "@/lib/exam-curriculum";
import {
  EXAM_DIFFICULTIES,
  availableExamQuestions,
  examDifficultyLabel,
  type ExamAvailability,
  type ExamDifficulty,
} from "@/lib/exam-difficulty";
import { ExamPreparationPanel } from "./exam-preparation";
import {
  ACTIVITY_TARGETS, activityFromHash, ExamCoachingPanel, ExamStartBriefing,
  ExamTrainingNavigation, type CoachingState, type PreparationActivity,
} from "./exam-training";
import { ExamQuestionTools } from "./exam-question-tools";
import type { PublicExam, ExamResult } from "@/lib/exam-policy";
import { remainingSeconds } from "@/lib/exam-policy";
import { S } from "./exam-workspace-estilos";
import { cn } from "@/lib/utils";
import { C } from "@/app/components/estilos-comunes";
type Dashboard = {
  available: ExamAvailability[];
  active: { id: string; mode: string; preview: boolean; count: number } | null;
  history: Array<{
    id: string;
    mode: string;
    preview: boolean;
    state: string;
    regime: string;
    question_count: number;
    started_at: string;
    difficulty_filter?: string;
    result: ExamResult | null;
  }>;
};
const field =
  "w-full rounded-xl border border-line-strong bg-panel p-3 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const x = await r.json();
  if (!r.ok) throw Error(x.error ?? "No se pudo completar la operación.");
  return x;
}
export function ExamWorkspace({
  isAdmin,
  storageScope,
  centerEnabled,
  reviewAttemptId,
}: {
  isAdmin: boolean;
  storageScope: string;
  centerEnabled: boolean;
  reviewAttemptId?: string;
}) {
  const [activity, setActivity] = useState<PreparationActivity>("practice");
  const [coaching, setCoaching] = useState<CoachingState>({ data: null });
  const [startRequest, setStartRequest] = useState<{ profile: "custom" | "oece" | "balotario"; balotarioId?: string } | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null),
    [exam, setExam] = useState<PublicExam | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [index, setIndex] = useState(0),
    [mode, setMode] = useState<"practice" | "exam">("practice"),
    [regime, setRegime] = useState("32069"),
    [topic, setTopic] = useState(""),
    [competency, setCompetency] = useState(""),
    [difficulty, setDifficulty] = useState<ExamDifficulty>(""),
    [setAttempts, setSetAttempts] = useState<SetAttempt[]>([]),
    [positionNotice, setPositionNotice] = useState(""),
    [online, setOnline] = useState(true),
    [count, setCount] = useState(10),
    [minutes, setMinutes] = useState(120),
    [preview, setPreview] = useState(false),
    [tick, setTick] = useState(() => Date.now()),
    [clockOffset, setClockOffset] = useState(0),
    [confirmation, setConfirmation] = useState<"submit" | "cancel" | null>(
      null,
    ),
    [pending, setPending] = useState<{
      questionId: string;
      option: string | null;
      flagged: boolean;
    } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    expiryChecked = useRef("");
  const dashboard = useCallback(async () => {
    const x = await read<Dashboard>("/api/exams");
    setDash(x);
    return x;
  }, []);
  const restoreLocal = useCallback(
    (exam: PublicExam) => {
      const key = "ace-exam-pending:" + storageScope + ":" + exam.attempt.id;
      try {
        const stored = sessionStorage.getItem(key);
        if (stored && exam.attempt.state === "active") {
          const p = recoverPendingAnswer(stored, exam);
          if (p) {
            setPending(p);
            setError(
              "Recuperamos una respuesta pendiente de esta pestaña. Confirma si deseas reintentar su guardado.",
            );
            return p.questionId;
          }
        } else if (exam.attempt.state !== "active")
          sessionStorage.removeItem(key);
      } catch {
        /* Almacenamiento opcional: el servidor conserva las respuestas confirmadas. */
      }
    },
    [storageScope],
  );

  const accept = useCallback((x: PublicExam) => {
    setExam(x);
    setClockOffset(Date.parse(x.serverNow) - Date.now());
    setTick(Date.now());
  }, []);
  const open = useCallback(
    async (id: string, action?: "cancel") => {
      setBusy(true);
      setError("");
      try {
        const x = await read<PublicExam>(`/api/exams/${id}`);
        accept(x);
        const localQuestionId = restoreLocal(x);
        setIndex(
          resumeQuestionIndex(
            x.attempt.questions,
            "",
            localQuestionId ?? x.attempt.last_question_id,
          ),
        );
        const u = new URL(location.href);
        u.searchParams.set("attempt", id);
        u.hash = `q=${resumeQuestionIndex(x.attempt.questions, "", localQuestionId ?? x.attempt.last_question_id) + 1}`;
        history.replaceState(null, "", u);
        if (action === "cancel" && x.attempt.state === "active") {
          setConfirmation("cancel");
        }
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accept, restoreLocal],
  );
  useEffect(() => {
    if (reviewAttemptId) void Promise.resolve().then(() => open(reviewAttemptId));
  }, [reviewAttemptId, open]);
  useEffect(() => {
    const sync = () => setActivity(activityFromHash(location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    const id = new URL(location.href).searchParams.get("attempt");
    const [d, x] = await Promise.all([
      read<Dashboard>("/api/exams", { signal }),
      id
        ? read<PublicExam>(`/api/exams/${id}`, { signal })
        : Promise.resolve(null),
    ]);
    if (signal?.aborted) return;
        setDash(d);
        if (x) {
          accept(x);
          const localQuestionId = restoreLocal(x);
          setIndex(
            resumeQuestionIndex(
              x.attempt.questions,
              localQuestionId ? "" : location.hash,
              localQuestionId ?? x.attempt.last_question_id,
            ),
          );
        }
  }, [accept, restoreLocal]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadWorkspace(controller.signal)).catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [loadWorkspace]);
  useEffect(() => {
    if (exam?.attempt.state !== "active" || !exam.attempt.deadline_at) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exam?.attempt.state, exam?.attempt.deadline_at]);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    changed();
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    return () => {
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
    };
  }, []);
  const checkpointQuestionId = exam?.attempt.questions[index]?.id;
  useEffect(() => {
    const id = exam?.attempt.id;
    if (!id || !checkpointQuestionId || exam?.attempt.state !== "active")
      return;
    const controller = new AbortController();
    void fetch("/api/exams/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkpoint",
        attemptId: id,
        questionId: checkpointQuestionId,
      }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        setPositionNotice("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPositionNotice(
            "No se pudo guardar tu posición en el servidor. El enlace de esta pestaña conserva la pregunta.",
          );
      });
    return () => controller.abort();
  }, [exam?.attempt.id, exam?.attempt.state, checkpointQuestionId]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pending]);
  const seconds = remainingSeconds(
    exam?.attempt.deadline_at ?? null,
    tick + clockOffset,
  );
  useEffect(() => {
    if (
      seconds !== 0 ||
      exam?.attempt.state !== "active" ||
      expiryChecked.current === exam.attempt.id
    )
      return;
    expiryChecked.current = exam.attempt.id;
    read<PublicExam>(`/api/exams/${exam.attempt.id}`)
      .then(accept)
      .catch((e) => setError(e.message));
  }, [seconds, exam, accept]);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
  }, [confirmation]);
  const selection = { regime, competency, topic, difficulty, preview };
  const available = availableExamQuestions(dash?.available ?? [], selection);
  const difficultyOptions = EXAM_DIFFICULTIES.map((item) => ({
    ...item,
    count: availableExamQuestions(dash?.available ?? [], { ...selection, difficulty: item.value }),
  }));
  const topics = [...new Set((dash?.available ?? [])
    .filter((group) => group.regime === regime && (!competency || group.competency === competency))
    .map((group) => group.topic))].sort((a, b) => a.localeCompare(b, "es"));
  function selectActivity(next: PreparationActivity) {
    setActivity(next);
    const u = new URL(location.href);
    u.hash = next === "oece" ? "oece-preparation-title" : next === "review" ? "exam-review" : "exam-custom";
    history.replaceState(null, "", u);
    requestAnimationFrame(() => {
      const target = document.getElementById(ACTIVITY_TARGETS[next]);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
  }
  function updateFilters(changes: Partial<typeof selection>) {
    const next = { ...selection, ...changes };
    setRegime(next.regime);
    setCompetency(next.competency);
    setTopic(next.topic);
    setDifficulty(next.difficulty);
    setPreview(next.preview);
    const total = availableExamQuestions(dash?.available ?? [], next);
    if (total > 0) setCount(current => Math.min(current, total, 72));
  }
  function start(
    profile: "custom" | "oece" | "review" | "balotario" = "custom",
    balotarioId?: string,
  ) {
    if (dash?.active) {
      setError("Continúa o finaliza tu intento en curso antes de iniciar otro.");
      return;
    }
    setError("");
    if (profile === "oece" || profile === "balotario" || (profile === "custom" && mode === "exam")) {
      setStartRequest({ profile, balotarioId });
    } else void createAttempt(profile, balotarioId);
  }
  async function createAttempt(
    profile: "custom" | "oece" | "review" | "balotario" = "custom",
    balotarioId?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const x = await read<{ id: string }>("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          profile === "oece" || profile === "balotario"
            ? {
                profile,
                balotarioId,
                mode: "exam",
                count: 72,
                minutes: 120,
                regime: "32069",
                topic: "",
                preview: false,
              }
            : profile === "review"
              ? {
                  profile,
                  mode: "practice",
                  count: Math.min(72, Math.max(1, count)),
                  minutes: 120,
                  regime,
                  topic: "",
                  preview: false,
                }
              : {
                  profile,
                  mode,
                  count,
                  minutes,
                  regime,
                  topic,
                  preview,
                  competency,
                  difficulty,
                },
        ),
      });
      const loaded = await open(x.id);
      if (!loaded) await dashboard();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(p: {
    questionId: string;
    option: string | null;
    flagged: boolean;
  }) {
    if (!exam) return;
    setBusy(true);
    setError("");
    setPending(p);
    try {
      sessionStorage.setItem(
        "ace-exam-pending:" + storageScope + ":" + exam.attempt.id,
        JSON.stringify(p),
      );
    } catch {}
    try {
      accept(
        await read<PublicExam>(`/api/exams/${exam.attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, revision: exam.attempt.revision }),
        }),
      );
      setPending(null);
      try {
        sessionStorage.removeItem(
          "ace-exam-pending:" + storageScope + ":" + exam.attempt.id,
        );
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshAttempt() {
    if (!exam) return;
    setBusy(true);
    try {
      accept(await read<PublicExam>(`/api/exams/${exam.attempt.id}`));
      setPending(null);
      try {
        sessionStorage.removeItem(
          "ace-exam-pending:" + storageScope + ":" + exam.attempt.id,
        );
      } catch {}
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!exam || !confirmation) return;
    setBusy(true);
    setError("");
    try {
      accept(
        await read<PublicExam>(`/api/exams/${exam.attempt.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: confirmation }),
        }),
      );
      setConfirmation(null);
      await dashboard();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function studyTopic(topic: string, sourceRegime = "32069") {
    setExam(null);
    setMode("practice");
    setRegime(sourceRegime);
    setDifficulty("");
    const total = availableExamQuestions(dash?.available ?? [], { regime: sourceRegime, topic, competency: "", difficulty: "", preview: false });
    setCount(Math.max(1, Math.min(10, total || 10)));
    setCompetency("");
    setTopic(topic);
    setPreview(false);
    const u = new URL(location.href);
    u.searchParams.delete("attempt");
    history.replaceState(null, "", u);
    selectActivity("practice");
  }
  async function startScheduled(regime: string) {
    setBusy(true);
    setError("");
    try {
      const x = await read<{ id: string }>("/api/exams/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scheduled", regime }),
      });
      await open(x.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function jump(n: number) {
    setIndex(n);
    const u = new URL(location.href);
    u.hash = `q=${n + 1}`;
    history.replaceState(null, "", u);
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
    });
  }
  async function askSource(
    source: { documentId: string; quote: string },
    prompt: string,
    relatedDocumentIds: string[],
  ) {
    setBusy(true);
    try {
      const r = await read<{ sessionId: string }>("/api/search/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Ayúdame a estudiar esta pregunta de práctica: ${prompt}. Explica el fundamento usando solo las fuentes seleccionadas y cita documento y página. Si alguna afirmación requiere otra disposición, indica qué falta. Pasaje en el que quiero profundizar: ${source.quote}`,
          filters: {
            documentIds: [
              ...new Set([source.documentId, ...relatedDocumentIds]),
            ],
          },
        }),
      });
      location.assign(`/chat?sessionId=${r.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const a = exam?.attempt,
    q = a?.questions[index],
    answer = exam?.answers.find((x) => x.question_id === q?.id),
    answered = exam?.answers.filter((x) => x.option).length ?? 0;
  return (
    <div className={cn("tw", S.examWorkspace, "mx-auto max-w-7xl space-y-6 pb-8 text-ink")}>
      {exam && <div className={S.examWelcome}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
            Tu espacio de preparación
          </p>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Practica a tu ritmo, comprueba cada respuesta y vuelve a su fuente.
            Entrenamiento independiente de la certificación oficial.
          </p>
        </div>
        <div className={S.examWelcomeActions}>
          {!exam && (
            <a className={buttonClasses({ variant: "secondary" })} href="#exam-custom">
              Preparar práctica
            </a>
          )}
          {isAdmin && (
            <Link className={buttonClasses({ variant: "secondary" })} href="/simulador/banco">
              Gestionar preguntas
            </Link>
          )}
        </div>
      </div>}
      {!online && (
        <p
          role="status"
          className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm"
        >
          Sin conexión. Las respuestas confirmadas permanecen en el servidor;
          espera a reconectarte para guardar cambios.
        </p>
      )}
      {positionNotice && (
        <p role="status" className="text-xs text-muted">
          {positionNotice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm"
        >
          <p>{error}</p>
          {!dash && !exam && <button type="button" disabled={busy} className={cn(buttonClasses({ variant: "secondary" }), "mt-3")}
            onClick={() => {
              setBusy(true);
              setError("");
              void loadWorkspace().catch(e => setError((e as Error).message)).finally(() => setBusy(false));
            }}>{busy ? "Consultando…" : "Volver a cargar el simulador"}</button>}
          {pending && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className={buttonClasses({ variant: "secondary" })}
                disabled={busy}
                onClick={() => void save(pending)}
              >
                Reintentar guardado
              </button>
              <button
                className={buttonClasses({ variant: "secondary" })}
                disabled={busy}
                onClick={() => void refreshAttempt()}
              >
                Recuperar versión guardada
              </button>
            </div>
          )}
        </div>
      )}
      {!dash && !exam && !error && (
        <p role="status">Cargando tu espacio de práctica…</p>
      )}
      {exam && a ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              disabled={busy || Boolean(pending)}
              className={buttonClasses({ variant: "secondary" })}
              onClick={() => {
                setExam(null);
                const u = new URL(location.href);
                u.searchParams.delete("attempt");
                u.hash = "";
                history.replaceState(null, "", u);
                void dashboard();
              }}
            >
              Volver al simulador
            </button>
            <p className="text-sm text-muted">
              {a.preview
                ? "Revisión de borradores · no incluido en estadísticas"
                : a.mode === "practice"
                  ? "Práctica con explicación"
                  : "Simulacro con tiempo"}{" "}
              · Ley {a.regime}
              {a.difficulty_filter && ` · ${examDifficultyLabel(a.difficulty_filter)}`}
            </p>
          </div>
          {a.profile === "review" && a.review_context && (
            <p className="rounded-xl border border-brand/30 bg-brand-soft p-4 text-sm">
              Repaso con versiones actuales: {a.review_context.updated}{" "}
              preguntas actualizadas desde tu respuesta anterior ·{" "}
              {a.review_context.unavailable} preguntas anteriores retiradas o
              sin fuente actual disponible. Al responder correctamente y
              finalizar, la pregunta deja de aparecer entre tus errores.
            </p>
          )}
          {a.result && a.state === "submitted" && (
            <section className="rounded-2xl border border-brand/30 bg-brand-soft p-5">
              <h2 className="text-xl font-semibold">
                Resultado: {a.result.correct} de {a.result.total} correctas
              </h2>
              <p className="mt-2 text-sm">
                {a.result.incorrect} incorrectas · {a.result.omitted} sin
                responder. Revisa cada explicación y su fuente.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.result.topics.map((t) => (
                  <span
                    key={t.topic}
                    className="rounded-lg border border-brand/30 bg-panel px-3 py-2 text-sm"
                  >
                    {t.topic}: {t.correct}/{t.total}
                  </span>
                ))}
              </div>
            </section>
          )}
          {a.state === "submitted" && (
            <ExamStudyReport exam={exam} onTopic={studyTopic} />
          )}
          {a.state === "cancelled" && (
            <p className="rounded-xl border p-4">
              Intento cancelado, conservado en tu historial sin calificación.
            </p>
          )}
          {q && (
            <div className={S.examAttemptLayout}>
              <section className={S.examQuestionPanel}>
                <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
                  <span>
                    Pregunta {index + 1} de {a.questions.length}
                  </span>
                  <span
                    className="font-mono font-semibold text-brand-dark"
                    aria-label="Tiempo restante"
                  >
                    {a.state !== "active"
                      ? "Intento finalizado"
                      : seconds === null
                        ? "Sin límite de tiempo"
                        : `${Math.floor(seconds / 60)
                            .toString()
                            .padStart(
                              2,
                              "0",
                            )}:${(seconds % 60).toString().padStart(2, "0")}`}
                  </span>
                </div>
                <p className="mt-3 text-xs text-brand-dark">
                  {q.competency} · {q.topic}
                </p>
                <h2
                  ref={heading}
                  tabIndex={-1}
                  className="mt-3 scroll-mt-5 text-lg font-semibold leading-relaxed outline-none"
                >
                  {q.prompt}
                </h2>
                <fieldset
                  className="mt-5 space-y-3"
                  disabled={
                    busy ||
                    a.state !== "active" ||
                    (a.mode === "practice" && Boolean(answer?.option))
                  }
                >
                  <legend className="sr-only">
                    Selecciona una alternativa
                  </legend>
                  {q.options.map((o) => (
                    <label
                      key={o.id}
                      className={`${S.examAnswer} flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-brand ${q.correctOption === o.id ? "border-brand bg-brand-soft" : q.correctOption && answer?.option === o.id ? "border-warning/40 bg-warning-soft" : (pending?.questionId === q.id ? pending.option : answer?.option) === o.id ? "border-brand bg-brand-soft" : "border-line hover:bg-surface"}`}
                    >
                      <input
                        className="mt-1 h-4 w-4 accent-brand"
                        type="radio"
                        name={`answer-${q.id}`}
                        value={o.id}
                        checked={
                          (pending?.questionId === q.id
                            ? pending.option
                            : answer?.option) === o.id
                        }
                        onChange={() =>
                          void save({
                            questionId: q.id,
                            option: o.id,
                            flagged: answer?.flagged ?? false,
                          })
                        }
                      />
                      <span>
                        <strong className="mr-2">{o.id}.</strong>
                        {o.text.replace(/^[A-D][).:\-]\s+/, "")}
                        {q.correctOption &&
                          (q.correctOption === o.id ||
                            answer?.option === o.id) && (
                            <span className="mt-2 block text-xs font-semibold">
                              {q.correctOption === o.id
                                ? answer?.option === o.id
                                  ? "Tu respuesta · correcta"
                                  : "Alternativa correcta"
                                : "Tu respuesta · incorrecta"}
                            </span>
                          )}
                      </span>
                    </label>
                  ))}
                </fieldset>
                {q.correctOption && (
                  <ExamTutor
                    key={a.id + q.id}
                    attemptId={a.id}
                    questionId={q.id}
                  />
                )}
                <ExamQuestionTools
                  key={q.id}
                  attemptId={a.id}
                  questionId={q.id}
                  active={a.state === "active"}
                />
                <p
                  role="status"
                  className="my-3 min-h-5 text-xs text-muted"
                >
                  {a.state !== "active"
                    ? answer?.option
                      ? "Respuesta registrada en este intento."
                      : "Pregunta omitida en este intento."
                    : busy
                      ? "Guardando o consultando…"
                      : pending
                        ? "Hay una respuesta sin guardar."
                        : answer?.option
                          ? "Respuesta guardada."
                          : "Puedes dejarla pendiente y continuar."}
                </p>
                {q.correctOption && (
                  <section className="my-5 rounded-xl border border-brand/30 bg-surface p-4">
                    <h3 className="font-semibold">
                      {answer?.option === q.correctOption
                        ? "Respuesta correcta"
                        : answer?.option
                          ? "Revisa esta respuesta"
                          : "Pregunta sin responder"}{" "}
                      · Alternativa {q.correctOption}
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                      {q.explanation}
                    </p>
                    {q.optionRationales && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Por qué se acepta o descarta cada alternativa
                        </summary>
                        <ul className="mt-2 space-y-2 text-sm">
                          {Object.entries(q.optionRationales).map(
                            ([id, text]) => (
                              <li key={id}>
                                <strong>{id}.</strong> {text}
                              </li>
                            ),
                          )}
                        </ul>
                      </details>
                    )}
                    {q.sources?.map((s, i) => (
                      <div
                        key={s.chunkId + i}
                        className="mt-4 border-t border-line pt-4"
                      >
                        <p className="text-xs font-semibold">
                          {s.title} · artículo {s.article} · páginas{" "}
                          {s.pageStart}
                          {s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {s.version}
                        </p>
                        <blockquote className="my-3 border-l-2 border-brand pl-3 text-sm leading-relaxed">
                          {s.quote}
                        </blockquote>
                        <div className="flex flex-wrap gap-2">
                          <a
                            className={buttonClasses({ variant: "secondary" })}
                            href={`/api/exams/documents/${s.documentId}?attemptId=${a.id}#page=${s.pageStart}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Leer PDF
                          </a>
                          {centerEnabled && (
                            <Link
                              className={buttonClasses({ variant: "secondary" })}
                              href={`/normas?documentId=${s.documentId}`}
                            >
                              Ver en Normativa
                            </Link>
                          )}
                          {centerEnabled && (
                            <button
                              className={buttonClasses({ variant: "secondary" })}
                              disabled={busy}
                              onClick={() =>
                                void askSource(
                                  s,
                                  q.prompt,
                                  q.sources?.map((x) => x.documentId) ?? [],
                                )
                              }
                            >
                              Estudiar en Chat
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    className={buttonClasses({ variant: "secondary" })}
                    disabled={busy || Boolean(pending) || index === 0}
                    onClick={() => jump(index - 1)}
                  >
                    Anterior
                  </button>
                  {a.state === "active" && (
                    <button
                      className={buttonClasses({ variant: "secondary" })}
                      disabled={busy || Boolean(pending)}
                      onClick={() =>
                        void save({
                          questionId: q.id,
                          option: answer?.option ?? null,
                          flagged: !answer?.flagged,
                        })
                      }
                    >
                      {answer?.flagged ? "Quitar marca" : "Marcar para revisar"}
                    </button>
                  )}
                  <button
                    className={buttonClasses({ variant: "primary" })}
                    disabled={
                      busy ||
                      Boolean(pending) ||
                      index === a.questions.length - 1
                    }
                    onClick={() => jump(index + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </section>
              <aside className={S.examJourney}>
                <h2 className="font-semibold">Tu recorrido</h2>
                <p className="mt-2 text-sm text-muted">
                  {answered} de {a.questions.length} respondidas
                </p>
                <progress
                  className="mt-2 h-2 w-full accent-brand"
                  value={answered}
                  max={a.questions.length}
                  aria-label="Preguntas respondidas"
                />
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-sm font-medium">
                    Navegar por preguntas
                  </summary>
                  <div className={cn(S.examQuestionGrid, "mt-3", "grid", "grid-cols-5", "gap-2")}>
                    {a.questions.map((item, n) => {
                      const ans = exam.answers.find(
                        (x) => x.question_id === item.id,
                      );
                      return (
                        <button
                          key={item.id}
                          disabled={busy || Boolean(pending)}
                          aria-current={n === index ? "step" : undefined}
                          aria-label={`Pregunta ${n + 1}${ans?.option ? ", respondida" : ", pendiente"}${ans?.flagged ? ", marcada" : ""}`}
                          onClick={() => jump(n)}
                          className={`min-h-11 rounded-lg border text-sm font-semibold ${n === index ? "border-brand ring-2 ring-brand" : ans?.option ? "border-brand/30 bg-brand-soft" : "border-line bg-panel"}`}
                        >
                          {n + 1}
                          {ans?.flagged ? " ★" : ans?.option ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </details>
                {a.state === "active" && (
                  <div className="mt-5 space-y-2">
                    <button
                      className={cn(buttonClasses({ variant: "primary" }), "w-full")}
                      disabled={busy || Boolean(pending)}
                      onClick={() => setConfirmation("submit")}
                    >
                      Terminar y ver resultado
                    </button>
                    <button
                      className={cn(buttonClasses({ variant: "secondary" }), "w-full")}
                      disabled={busy || Boolean(pending)}
                      onClick={() => setConfirmation("cancel")}
                    >
                      Cancelar intento
                    </button>
                  </div>
                )}
              </aside>
            </div>
          )}
        </>
      ) : (
        dash && (
          <>
            {dash.active && (
              <div className={S.examResume}>
                <div>
                  <h2 className="font-semibold">
                    Tienes{" "}
                    {dash.active.preview
                      ? "una revisión de borradores"
                      : "un intento"}{" "}
                    en curso
                  </h2>
                  <p className="mt-1 text-sm">
                    {dash.active.count} preguntas ·{" "}
                    {dash.active.mode === "exam"
                      ? "El tiempo del simulacro sigue corriendo."
                      : "Puedes continuar tu práctica."}
                  </p>
                </div>
                <button
                  disabled={busy}
                  className={buttonClasses({ variant: "primary" })}
                  onClick={() => void open(dash.active!.id)}
                >
                  Continuar intento
                </button>
              </div>
            )}
            <ExamCoachingPanel state={coaching} onPractice={(code, topic) => {
              studyTopic(topic);
              setCompetency(code);
              const total = availableExamQuestions(dash.available, { regime: "32069", competency: code, topic, difficulty: "", preview: false });
              setCount(Math.max(1, Math.min(10, total || 10)));
            }} />
            <ExamTrainingNavigation activity={activity} onChange={selectActivity} />
            <div id="preparation-review" hidden={activity !== "review"}>
              <ExamLearningDashboard
                key={dash.history.map((h) => h.id).join()}
                busy={busy || Boolean(dash.active)}
                onSets={setSetAttempts}
                onCoaching={setCoaching}
                onScheduled={(r) => void startScheduled(r)}
                onOpen={(id) => void open(id)}
                onTopic={studyTopic}
              />
            </div>
            <div id="preparation-oece" hidden={activity !== "oece"}>
              <ExamPreparationPanel
                setAttempts={setAttempts}
                busy={busy}
                activeAttempt={Boolean(dash.active)}
                isAdmin={isAdmin}
                onStart={(profile, id) => start(profile, id)}
              />
            </div>
            <div id="preparation-practice" hidden={activity !== "practice"}>
            <section
              id="exam-custom"
              aria-labelledby="exam-custom-title"
              className={S.examCustomLayout}
            >
              <div className={S.examCustomPanel}>
                <h2 id="exam-custom-title" tabIndex={-1} className="text-xl font-semibold">
                  Configura tu sesión
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Practica con explicación inmediata o comprueba tus conocimientos con tiempo. Elige la dificultad que necesitas reforzar.
                </p>
                <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Modalidad</legend>
                  {[
                    {
                      id: "practice",
                      title: "Practicar",
                      text: "Aprende con una explicación después de cada respuesta.",
                    },
                    {
                      id: "exam",
                      title: "Simulacro personalizado",
                      text: "Responde con tiempo y revisa al terminar.",
                    },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`${S.examMode} cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-brand ${mode === m.id ? "border-brand bg-brand-soft" : "border-line"}`}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === m.id}
                          onChange={() => {
                            setMode(m.id as "exam" | "practice");
                            if (m.id === "exam") setPreview(false);
                          }}
                        />
                        {m.title}
                      </span>
                      <span className="mt-2 block text-sm text-muted">
                        {m.text}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Régimen
                    <select
                      className={field}
                      value={regime}
                      onChange={(e) => {
                        updateFilters({ regime: e.target.value, topic: "", competency: "" });
                      }}
                    >
                      <option value="32069">Ley 32069</option>
                      <option value="30225">Ley 30225</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Competencia
                    <select
                      className={field}
                      value={competency}
                      onChange={(e) => {
                        updateFilters({ competency: e.target.value, topic: "" });
                      }}
                    >
                      <option value="">Todas las competencias</option>
                      {Object.entries(COMPETENCIES).map(([code, label]) => (
                        <option value={code} key={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Tema
                    <select
                      className={field}
                      value={topic}
                      onChange={(e) => updateFilters({ topic: e.target.value })}
                    >
                      <option value="">Todos los temas disponibles</option>
                      {topics.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Dificultad
                    <select
                      className={field}
                      value={difficulty}
                      aria-describedby="difficulty-help"
                      onChange={(event) => {
                        updateFilters({ difficulty: event.target.value as ExamDifficulty });
                      }}
                    >
                      {difficultyOptions.map((item) => (
                        <option key={item.value} value={item.value} disabled={item.value !== "" && item.count === 0}>
                          {item.label} ({item.count})
                        </option>
                      ))}
                    </select>
                    <span id="difficulty-help" className="mt-1 block text-xs font-normal text-muted">
                      {difficulty ? "Nivel de las preguntas; no equivale al nivel de certificación." : "Mezcla de niveles disponibles, sin una proporción fija por dificultad."}
                    </span>
                  </label>
                  <label className={cn("text-sm font-medium", mode === "practice" && "sm:col-span-2")}>
                    Número de preguntas
                    <input
                      className={field}
                      type="number"
                      min={1}
                      max={Math.min(72, available || 72)}
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    />
                  </label>
                  {mode === "exam" && (
                    <label className="text-sm font-medium">
                      Duración
                      <select
                        className={field}
                        value={minutes}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                      >
                        {[10, 30, 60, 120, 180].map((n) => (
                          <option key={n} value={n}>
                            {n} minutos
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {isAdmin && mode === "practice" && (
                  <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preview}
                      onChange={(e) => updateFilters({ preview: e.target.checked })}
                    />
                    Probar borradores del banco (solo administración)
                  </label>
                )}
                <p className="mt-4 text-sm text-muted">
                  {available} preguntas{" "}
                  {preview
                    ? "disponibles para revisión"
                    : "publicadas y con fuente comprobable"}{" "}
                  en esta selección. Cada pregunta se utiliza una vez por
                  intento.
                </p>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Cantidades sugeridas">
                  {[10, 20, 30, 72].map(n => <button key={n} type="button" disabled={n > available || busy}
                    aria-pressed={count === n} onClick={() => setCount(n)}
                    className={cn("min-h-11 rounded-lg border px-3 text-sm font-medium", count === n ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-muted hover:text-ink")}>
                    {n} preguntas
                  </button>)}
                </div>
                {!available && (
                  <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
                    {difficulty
                      ? "No hay preguntas de esta dificultad con los filtros elegidos. Prueba otro nivel o amplía la selección."
                      : "El banco de esta selección está en preparación."}
                    {!difficulty && (isAdmin
                      ? " Revisa los borradores y publica las preguntas antes de ofrecerlas a los usuarios."
                      : " Puedes volver cuando se publiquen preguntas revisadas.")}
                  </p>
                )}
                {dash.active && (
                  <ExamActiveNotice
                    count={dash.active.count}
                    preview={dash.active.preview}
                    busy={busy}
                    onContinue={() => void open(dash.active!.id)}
                    onCancel={() => void open(dash.active!.id, "cancel")}
                  />
                )}
                <button
                  aria-describedby={dash.active ? "exam-active-description" : undefined}
                  className={cn(buttonClasses({ variant: "primary" }), "mt-5")}
                  disabled={
                    busy ||
                    Boolean(dash.active) ||
                    count < 1 ||
                    count > available ||
                    count > 72 ||
                    !Number.isInteger(count)
                  }
                  onClick={() => void start()}
                >
                  {busy
                    ? "Preparando…"
                    : preview
                      ? "Probar preguntas en borrador"
                      : mode === "practice"
                        ? "Empezar práctica"
                        : "Empezar simulacro"}
                </button>
                {count > available && available > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    Elige hasta {available} preguntas o amplía los filtros.
                  </p>
                )}
              </div>
              <aside className={S.examStudyGuide}>
                <p className="text-xs uppercase tracking-wider text-brand-dark">
                  Aprendizaje con fundamento
                </p>
                <h2 className="mt-3 text-xl font-semibold">Tu sesión de estudio</h2>
                <dl className="my-5 space-y-3 text-sm">
                  <div><dt className="text-muted">Modalidad</dt><dd className="mt-1 font-semibold">{mode === "practice" ? "Práctica con explicación" : "Simulacro personalizado"}</dd></div>
                  <div><dt className="text-muted">Configuración</dt><dd className="mt-1 font-semibold">{count} preguntas{mode === "exam" ? ` · ${minutes} minutos` : " · sin cronómetro"}</dd></div>
                  <div><dt className="text-muted">Dificultad</dt><dd className="mt-1 font-semibold">{examDifficultyLabel(difficulty)}</dd></div>
                  <div><dt className="text-muted">Competencia</dt><dd className="mt-1 font-semibold">{COMPETENCIES[competency] ?? "Todas las competencias"}</dd></div>
                </dl>
                <p>{mode === "practice" ? "Lee la explicación y el pasaje normativo después de cada respuesta. Termina la sesión para registrar tus resultados." : "Las claves se muestran al entregar. Puedes recorrer las preguntas y marcar las que quieras revisar."}</p>
                <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
                  El examen y su corrección funcionan sin IA. El Chat es una
                  ayuda adicional.
                </p>
              </aside>
            </section>
            </div>
            <section id="exam-history" className={C.examHistory}>
              <h2 className="text-xl font-semibold">Mis intentos</h2>
              <p className="mt-1 text-sm text-muted">
                Últimos 20 intentos. Las revisiones de borradores se identifican
                por separado.
              </p>
              {!dash.history.length ? (
                <p className="mt-5 text-sm text-muted">
                  Tu primera práctica aparecerá aquí cuando termines.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {dash.history.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <p className="font-medium">
                          {h.preview
                            ? "Revisión de borradores"
                            : h.mode === "exam"
                              ? "Simulacro"
                              : "Práctica"}{" "}
                          · Ley {h.regime}
                          {h.difficulty_filter && ` · ${examDifficultyLabel(h.difficulty_filter)}`}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {new Date(h.started_at).toLocaleString("es-PE", {
                            timeZone: "America/Lima",
                          })}{" "}
                          ·{" "}
                          {h.state === "cancelled"
                            ? "Cancelado, sin nota"
                            : `${h.result?.correct ?? 0}/${h.question_count} correctas`}
                        </p>
                      </div>
                      <button
                        className={buttonClasses({ variant: "secondary" })}
                        disabled={busy}
                        onClick={() => void open(h.id)}
                      >
                        Revisar intento
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )
      )}
      {startRequest && <ExamStartBriefing
        title={startRequest.profile === "custom" ? "Simulacro personalizado" : startRequest.profile === "balotario" ? "Examen del balotario" : "Simulacro completo OECE"}
        count={startRequest.profile === "custom" ? count : 72}
        minutes={startRequest.profile === "custom" ? minutes : 120}
        regime={startRequest.profile === "custom" ? regime : "32069"}
        selection={startRequest.profile === "custom"
          ? `${examDifficultyLabel(difficulty)} · ${topic || COMPETENCIES[competency] || "Todas las competencias"}`
          : "Distribución por temario: 25 actuaciones preparatorias, 22 selección y 25 ejecución contractual. Dificultad combinada."}
        busy={busy} error={error} onClose={() => { setStartRequest(null); setError(""); }}
        onConfirm={() => void createAttempt(startRequest.profile, startRequest.balotarioId).then(created => { if (created) setStartRequest(null); })}
      />}
      {confirmation && (
        <dialog
          ref={dialog}
          aria-labelledby="exam-confirm"
          onCancel={() => setConfirmation(null)}
          className="tw m-auto max-w-lg rounded-2xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-slate-950/50"
        >
          <h2 id="exam-confirm" className="text-xl font-semibold">
            {confirmation === "submit"
              ? "¿Terminar este intento?"
              : "¿Cancelar este intento?"}
          </h2>
          <p className="my-4 text-sm leading-relaxed">
            {confirmation === "submit"
              ? `Has respondido ${answered} de ${a?.questions.length ?? 0}. Las pendientes se registrarán como omitidas. Después podrás estudiar la resolución.`
              : "Se conservará el registro como cancelado y sin nota. Puedes empezar otro intento después."}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              disabled={busy}
              className={buttonClasses({ variant: "secondary" })}
              onClick={() => setConfirmation(null)}
            >
              Volver
            </button>
            <button
              disabled={busy}
              className={buttonClasses({ variant: "primary" })}
              onClick={() => void finish()}
            >
              {busy
                ? "Procesando…"
                : confirmation === "submit"
                  ? "Terminar y ver resultado"
                  : "Confirmar cancelación"}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
