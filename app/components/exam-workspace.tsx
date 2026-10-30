"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExamPreparationPanel } from "./exam-preparation";
import { ExamQuestionTools } from "./exam-question-tools";
import type { PublicExam, ExamResult } from "@/lib/exam-policy";
import { remainingSeconds } from "@/lib/exam-policy";
type Dashboard = {
  available: Array<{
    regime: string;
    topic: string;
    published: number;
    drafts: number;
  }>;
  active: { id: string; mode: string; preview: boolean; count: number } | null;
  history: Array<{
    id: string;
    mode: string;
    preview: boolean;
    state: string;
    regime: string;
    question_count: number;
    started_at: string;
    result: ExamResult | null;
  }>;
};
const field =
  "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20";
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const x = await r.json();
  if (!r.ok) throw Error(x.error ?? "No se pudo completar la operación.");
  return x;
}
export function ExamWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [dash, setDash] = useState<Dashboard | null>(null),
    [exam, setExam] = useState<PublicExam | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [index, setIndex] = useState(0),
    [mode, setMode] = useState<"practice" | "exam">("practice"),
    [regime, setRegime] = useState("32069"),
    [topic, setTopic] = useState(""),
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
  const accept = useCallback((x: PublicExam) => {
    setExam(x);
    setClockOffset(Date.parse(x.serverNow) - Date.now());
    setTick(Date.now());
  }, []);
  const open = useCallback(
    async (id: string) => {
      setBusy(true);
      setError("");
      try {
        const x = await read<PublicExam>(`/api/exams/${id}`);
        accept(x);
        setIndex(0);
        const u = new URL(location.href);
        u.searchParams.set("attempt", id);
        u.hash = "";
        history.replaceState(null, "", u);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [accept],
  );
  useEffect(() => {
    const controller = new AbortController();
    const id = new URL(location.href).searchParams.get("attempt");
    Promise.all([
      read<Dashboard>("/api/exams", { signal: controller.signal }),
      id
        ? read<PublicExam>(`/api/exams/${id}`, { signal: controller.signal })
        : Promise.resolve(null),
    ])
      .then(([d, x]) => {
        setDash(d);
        if (x) {
          accept(x);
          const n = Number(location.hash.replace("#q=", ""));
          setIndex(
            Number.isInteger(n) && n > 0
              ? Math.min(n - 1, x.attempt.questions.length - 1)
              : 0,
          );
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [accept]);
  useEffect(() => {
    if (exam?.attempt.state !== "active" || !exam.attempt.deadline_at) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exam?.attempt.state, exam?.attempt.deadline_at]);
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
  const available =
    dash?.available
      .filter((x) => x.regime === regime && (!topic || x.topic === topic))
      .reduce(
        (n, x) => n + Number(x.published) + (preview ? Number(x.drafts) : 0),
        0,
      ) ?? 0;
  async function start(
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
              : { profile, mode, count, minutes, regime, topic, preview },
        ),
      });
      await open(x.id);
    } catch (e) {
      setError((e as Error).message);
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
      accept(
        await read<PublicExam>(`/api/exams/${exam.attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...p, revision: exam.attempt.revision }),
        }),
      );
      setPending(null);
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
    <div className="tw mx-auto max-w-7xl space-y-6 pb-8 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Aprender · practicar · comprobar
          </p>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Preguntas propias de ACE, con fuentes oficiales. Entrenamiento
            independiente de una certificación oficial.
          </p>
        </div>
        {isAdmin && (
          <Link className="secondaryButton" href="/simulador/banco">
            Revisar banco de preguntas
          </Link>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <p>{error}</p>
          {pending && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => void save(pending)}
              >
                Reintentar guardado
              </button>
              <button
                className="secondaryButton"
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
              className="secondaryButton"
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
            <p className="text-sm text-slate-600">
              {a.preview
                ? "Revisión de borradores · no incluido en estadísticas"
                : a.mode === "practice"
                  ? "Práctica con explicación"
                  : "Simulacro con tiempo"}{" "}
              · Ley {a.regime}
            </p>
          </div>
          {a.profile === "review" && a.review_context && (
            <p className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
              Repaso con versiones actuales: {a.review_context.updated}{" "}
              preguntas actualizadas desde tu respuesta anterior ·{" "}
              {a.review_context.unavailable} preguntas anteriores retiradas o
              sin fuente actual disponible. Al responder correctamente y
              finalizar, la pregunta deja de aparecer entre tus errores.
            </p>
          )}
          {a.result && a.state === "submitted" && (
            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
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
                    className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm"
                  >
                    {t.topic}: {t.correct}/{t.total}
                  </span>
                ))}
              </div>
            </section>
          )}
          {a.state === "cancelled" && (
            <p className="rounded-xl border p-4">
              Intento cancelado, conservado en tu historial sin calificación.
            </p>
          )}
          {q && (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600">
                  <span>
                    Pregunta {index + 1} de {a.questions.length}
                  </span>
                  <span
                    className="font-mono font-semibold text-teal-800"
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
                <p className="mt-3 text-xs text-teal-800">
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
                      className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-teal-700 ${q.correctOption === o.id ? "border-teal-600 bg-teal-50" : q.correctOption && answer?.option === o.id ? "border-amber-300 bg-amber-50" : (pending?.questionId === q.id ? pending.option : answer?.option) === o.id ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <input
                        className="mt-1 h-4 w-4 accent-teal-700"
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
                <ExamQuestionTools
                  key={q.id}
                  attemptId={a.id}
                  questionId={q.id}
                  active={a.state === "active"}
                />
                <p
                  role="status"
                  className="my-3 min-h-5 text-xs text-slate-600"
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
                  <section className="my-5 rounded-xl border border-teal-200 bg-slate-50 p-4">
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
                        className="mt-4 border-t border-slate-200 pt-4"
                      >
                        <p className="text-xs font-semibold">
                          {s.title} · artículo {s.article} · páginas{" "}
                          {s.pageStart}
                          {s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {s.version}
                        </p>
                        <blockquote className="my-3 border-l-2 border-teal-400 pl-3 text-sm leading-relaxed">
                          {s.quote}
                        </blockquote>
                        <div className="flex flex-wrap gap-2">
                          <a
                            className="secondaryButton"
                            href={`/api/documents/${s.documentId}#page=${s.pageStart}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Leer PDF
                          </a>
                          <Link
                            className="secondaryButton"
                            href={`/normas?documentId=${s.documentId}`}
                          >
                            Ver en Normativa
                          </Link>
                          <button
                            className="secondaryButton"
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
                        </div>
                      </div>
                    ))}
                  </section>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    className="secondaryButton"
                    disabled={busy || Boolean(pending) || index === 0}
                    onClick={() => jump(index - 1)}
                  >
                    Anterior
                  </button>
                  {a.state === "active" && (
                    <button
                      className="secondaryButton"
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
                    className="primaryButton"
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
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-5">
                <h2 className="font-semibold">Tu recorrido</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {answered} de {a.questions.length} respondidas
                </p>
                <progress
                  className="mt-2 h-2 w-full accent-teal-700"
                  value={answered}
                  max={a.questions.length}
                  aria-label="Preguntas respondidas"
                />
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-sm font-medium">
                    Navegar por preguntas
                  </summary>
                  <div className="mt-3 grid grid-cols-5 gap-2">
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
                          className={`min-h-11 rounded-lg border text-sm font-semibold ${n === index ? "border-teal-800 ring-2 ring-teal-700" : ans?.option ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"}`}
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
                      className="primaryButton w-full"
                      disabled={busy || Boolean(pending)}
                      onClick={() => setConfirmation("submit")}
                    >
                      Terminar y ver resultado
                    </button>
                    <button
                      className="secondaryButton w-full"
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-300 bg-teal-50 p-5">
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
                  className="primaryButton"
                  onClick={() => void open(dash.active!.id)}
                >
                  Continuar intento
                </button>
              </div>
            )}
            <ExamPreparationPanel
              busy={busy}
              isAdmin={isAdmin}
              onStart={(profile, id) => void start(profile, id)}
            />
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-semibold">
                  Práctica y simulacro personalizados
                </h2>
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
                      className={`cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-teal-600 ${mode === m.id ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
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
                      <span className="mt-2 block text-sm text-slate-600">
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
                        setRegime(e.target.value);
                        setTopic("");
                      }}
                    >
                      <option value="32069">Ley 32069</option>
                      <option value="30225">Ley 30225</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Tema
                    <select
                      className={field}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    >
                      <option value="">Todos los temas disponibles</option>
                      {dash.available
                        .filter((x) => x.regime === regime)
                        .map((x) => (
                          <option key={x.topic} value={x.topic}>
                            {x.topic}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Número de preguntas
                    <input
                      className={field}
                      type="number"
                      min={1}
                      max={72}
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
                      onChange={(e) => setPreview(e.target.checked)}
                    />
                    Probar borradores del banco (solo administración)
                  </label>
                )}
                <p className="mt-4 text-sm text-slate-600">
                  {available} preguntas{" "}
                  {preview
                    ? "disponibles para revisión"
                    : "publicadas y con fuente comprobable"}{" "}
                  en esta selección. Cada pregunta se utiliza una vez por
                  intento.
                </p>
                {!available && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    El banco de esta selección está en preparación.
                    {isAdmin
                      ? " Revisa los borradores y publica las preguntas antes de ofrecerlas a los usuarios."
                      : " Puedes volver cuando se publiquen preguntas revisadas."}
                  </p>
                )}
                <button
                  className="primaryButton mt-5"
                  disabled={
                    busy ||
                    Boolean(dash.active) ||
                    count < 1 ||
                    count > available ||
                    count > 72
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
                  <p className="mt-2 text-xs text-amber-900">
                    Elige hasta {available} preguntas o amplía el tema.
                  </p>
                )}
              </div>
              <aside className="rounded-2xl bg-slate-900 p-6 text-white">
                <p className="text-xs uppercase tracking-wider text-teal-200">
                  Aprendizaje con fundamento
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  Comprende la respuesta, encuentra su fuente.
                </h2>
                <ol className="mt-5 space-y-4 text-sm text-slate-200">
                  <li>1. Responde y marca tus dudas.</li>
                  <li>2. Revisa la explicación y el pasaje original.</li>
                  <li>3. Continúa el estudio en Normativa o Chat.</li>
                </ol>
                <p className="mt-6 border-t border-slate-700 pt-4 text-xs text-slate-300">
                  El examen y su corrección funcionan sin IA. El Chat es una
                  ayuda adicional.
                </p>
              </aside>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xl font-semibold">Mi progreso</h2>
              <p className="mt-1 text-sm text-slate-600">
                Últimos 20 intentos. Las revisiones de borradores se identifican
                por separado.
              </p>
              {!dash.history.length ? (
                <p className="mt-5 text-sm text-slate-600">
                  Tu primera práctica aparecerá aquí cuando termines.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
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
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
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
                        className="secondaryButton"
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
      {confirmation && (
        <dialog
          ref={dialog}
          aria-labelledby="exam-confirm"
          onCancel={() => setConfirmation(null)}
          className="tw m-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
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
              className="secondaryButton"
              onClick={() => setConfirmation(null)}
            >
              Volver
            </button>
            <button
              disabled={busy}
              className="primaryButton"
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
