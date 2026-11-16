"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, BookOpen, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { buttonClasses } from "./ui/button";
import { COMPETENCIES } from "@/lib/exam-curriculum";
import type { ExamCoaching } from "@/lib/exam-coaching";
import { cn } from "@/lib/utils";

export type PreparationActivity = "practice" | "oece" | "review";
export function activityFromHash(hash: string): PreparationActivity {
  if (hash === "#oece-preparation-title") return "oece";
  if (hash === "#exam-review") return "review";
  return "practice";
}
export const ACTIVITY_TARGETS = {
  practice: "exam-custom-title",
  oece: "oece-preparation-title",
  review: "review-title",
} as const;

export function ExamTrainingNavigation({ activity, onChange }: {
  activity: PreparationActivity;
  onChange: (activity: PreparationActivity) => void;
}) {
  return <nav aria-label="Actividad de preparación" className="grid gap-2 sm:grid-cols-3">
    {[
      { id: "practice", label: "Practicar", detail: "Elige un tema y aprende a tu ritmo", icon: BookOpen },
      { id: "oece", label: "Simulacro OECE", detail: "72 preguntas · 120 minutos", icon: Clock3 },
      { id: "review", label: "Repasar errores", detail: "Refuerza lo que necesitas recordar", icon: RotateCcw },
    ].map(({ id, label, detail, icon: Icon }) => <button
      key={id} type="button" aria-pressed={activity === id} aria-controls={`preparation-${id}`}
      onClick={() => onChange(id as PreparationActivity)}
      className={cn("flex min-h-20 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
        activity === id ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-panel text-ink hover:border-brand/50")}
    >
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
      <span><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm text-muted">{detail}</span></span>
    </button>)}
  </nav>;
}

export type CoachingState = { data: ExamCoaching | null; error?: string; limited?: boolean };
export function ExamCoachingPanel({ state, onPractice }: {
  state: CoachingState;
  onPractice: (competency: string, topic: string) => void;
}) {
  const data = state.data;
  return <section aria-labelledby="preparation-overview" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Tu preparación · Ley 32069</p>
        <h2 id="preparation-overview" className="mt-2 text-xl font-semibold">Aprende, practica y comprueba tu avance</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Empieza con sesiones cortas, revisa el fundamento de tus errores y después prueba el simulacro completo.</p>
      </div>
      {data && <p className="rounded-lg bg-surface px-3 py-2 text-sm tabular-nums"><strong>{data.practiced}</strong> preguntas practicadas</p>}
    </div>
    {state.error ? <p role="status" className="border-t border-line px-5 py-4 text-sm text-muted">Tu avance no está disponible en este momento. Puedes preparar una práctica o consultar Historial.</p> : !data ?
      <p role="status" className="border-t border-line px-5 py-4 text-sm text-muted">Consultando tus resultados de estudio…</p> : <>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3 sm:px-6">
        {data.competencies.map(c => <div key={c.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 p-3 sm:block sm:p-4">
          <div><p className="text-xs font-semibold text-brand-dark">Competencia {c.code}</p>
          <h3 className="mt-1 text-sm font-semibold">{c.label}</h3></div>
          <p className="text-sm tabular-nums sm:mt-3">{c.total ? <><strong>{c.correct}/{c.total}</strong> correctas <span className="text-muted">· {c.accuracy}%</span></> : <span className="text-muted">Sin registro</span>}</p>
          {c.total > 0 && <progress className="mt-3 h-1.5 w-full accent-brand" max={100} value={c.accuracy ?? 0} aria-label={`Aciertos observados en ${c.label}`} />}
        </div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-brand-soft/40 px-5 py-4 sm:px-6">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">Siguiente paso sugerido</p>
          <p className="mt-1 font-medium">{data.recommendation.reason === "errors" ? `Refuerza ${data.recommendation.topic}` : data.practiced === 0 ? "Comienza con una práctica de 10 preguntas" : `Explora ${COMPETENCIES[data.recommendation.competency]?.toLocaleLowerCase("es") ?? "otra competencia"}`}</p>
          <p className="mt-1 text-xs text-muted">{data.recommendation.reason === "errors" ? "Prioridad según tus errores y omisiones registrados." : "Ajusta la dificultad y la cantidad antes de comenzar."}</p>
        </div>
        <button type="button" className={cn(buttonClasses({ variant: "primary" }), "w-full sm:w-auto")} onClick={() => onPractice(data.recommendation.competency, data.recommendation.topic)}>Preparar mi práctica <ArrowRight size={16} aria-hidden /></button>
      </div>
      <p className="px-5 py-3 text-xs leading-relaxed text-muted sm:px-6">Último resultado por pregunta en {state.limited ? "los últimos 100 intentos entregados" : "intentos entregados"} de Ley 32069. Los borradores no cuentan. Estos datos orientan el estudio; no predicen la aprobación del examen oficial.</p>
    </>}
  </section>;
}

export function ExamStartBriefing({ title, count, minutes, regime, selection, busy, error, onClose, onConfirm }: {
  title: string; count: number; minutes: number; regime: string; selection: string;
  busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="start-exam-title" aria-describedby="start-exam-description"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    className="tw m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-slate-950/60 sm:p-8">
    <div className="flex items-center gap-2 text-sm font-medium text-brand-dark"><ShieldCheck size={20} aria-hidden /> Antes de empezar</div>
    <h2 id="start-exam-title" className="mt-3 text-2xl font-semibold">{title}</h2>
    <p id="start-exam-description" className="mt-2 text-sm text-muted">Reserva este tiempo y comprueba tu configuración. El cronómetro empieza cuando confirmas.</p>
    <dl className="my-5 grid grid-cols-3 gap-2 rounded-xl bg-surface p-4 text-center">
      {[['Preguntas', count], ['Minutos', minutes], ['Ley', regime]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <p className="text-sm font-medium">{selection}</p>
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
      <li>Las preguntas se seleccionan al azar, sin repetir dentro del intento.</li>
      <li>Las respuestas y explicaciones se muestran al entregar.</li>
      <li>Puedes marcar dudas y volver a las preguntas antes de terminar.</li>
      <li>Al agotarse el tiempo, el intento se entrega; las preguntas sin responder cuentan como omitidas.</li>
      <li>Comprueba el estado de guardado antes de salir o cambiar de pregunta.</li>
    </ul>
    <p className="mt-4 text-xs text-muted">Simulación de entrenamiento de ACE, independiente de la certificación oficial.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" disabled={busy} className={buttonClasses({ variant: "secondary" })} onClick={onClose}>Volver a configurar</button>
      <button type="button" disabled={busy} className={buttonClasses({ variant: "primary" })} onClick={onConfirm}>{busy ? "Preparando examen…" : "Comenzar examen"}</button>
    </div>
  </dialog>;
}
