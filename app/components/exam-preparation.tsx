"use client";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  COMPETENCIES,
  CURRICULUM_SOURCE,
} from "@/lib/exam-curriculum";
import { reviewPriority } from "@/lib/exam-learning-policy";
import type { ExamPreparation } from "@/lib/exam-preparation";
import { S } from "./exam-preparation-estilos";
import { C } from "@/app/components/estilos-comunes";
export function ExamPreparationPanel({
  onStart,
  busy,
  activeAttempt = false,
  isAdmin,
  setAttempts,
}: {
  onStart: (profile: "oece" | "review" | "balotario", id?: string) => void;
  busy: boolean;
  activeAttempt?: boolean;
  isAdmin: boolean;
  setAttempts: Array<{
    setId: string;
    result: { correct: number; total: number };
  }>;
}) {
  const [data, setData] = useState<ExamPreparation | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/exams/preparation", { signal: c.signal, cache: "no-store" })
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
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm"
      >
        No se pudo consultar la cobertura: {error}. Puedes usar la práctica
        personalizada.
      </p>
    );
  if (!data)
    return (
      <p role="status" className="text-sm text-muted">
        Consultando cobertura del temario…
      </p>
    );
  const missing = data.coverage.filter((c) => c.published < c.quota),
    published = data.coverage.reduce((n, c) => n + c.published, 0),
    drafts = data.coverage.reduce((n, c) => n + c.drafts, 0);
  const actionsDisabled = busy || activeAttempt;
  return (
    <section
      className={S.examPreparation}
      aria-labelledby="oece-preparation-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
            Preparación con el temario del OECE
          </p>
          <h2
            id="oece-preparation-title"
            tabIndex={-1}
            className="mt-1 scroll-mt-6 text-xl font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            Simulacro completo OECE
          </h2>
          <p className="mt-2 text-sm text-muted">
            72 preguntas · 120 minutos · Ley 32069. Entrenamiento independiente;
            no otorga certificación.
          </p>
        </div>
        <a
          className={buttonClasses({ variant: "secondary" })}
          target="_blank"
          rel="noreferrer"
          href={CURRICULUM_SOURCE}
        >
          Ver temario oficial
        </a>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">Cobertura editorial del banco</h3>
        <p className="mt-1 text-xs text-muted">
          Preguntas publicadas por competencia; estas cifras no representan tu avance personal.
        </p>
      </div>
      <div className={S.examCoverage}>
        {["1", "2", "3"].map((code) => {
          const rows = data.coverage.filter((c) => c.competency === code),
            required = rows.reduce((n, c) => n + c.quota, 0),
            available = rows.reduce((n, c) => n + c.published, 0),
            shortfall = rows.reduce(
              (n, c) => n + Math.max(0, c.quota - c.published),
              0,
            );
          return (
            <div key={code} className={S.examCoverageCard}>
              <p className={S.examCompetencyLabel}>Competencia {code}</p>
              <p className="text-sm font-semibold">{COMPETENCIES[code]}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="text-muted">preguntas por simulacro</dt>
                  <dd className="order-first font-semibold tabular-nums text-ink">{required}</dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="text-muted">disponibles en el banco</dt>
                  <dd className="order-first font-semibold tabular-nums text-ink">{available}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted">
                {rows.length === 0
                  ? "Sin datos de cobertura."
                  : shortfall > 0
                    ? `Faltan ${shortfall} preguntas publicadas para cubrir los cupos por subcompetencia.`
                    : "Cupos de las subcompetencias informadas cubiertos."}
              </p>
            </div>
          );
        })}
      </div>
      <div className={S.examPreparationActions}>
        <span className={S.examStatus}>
          {data.coverage.length !== 30 || missing.length ? "En preparación" : "Disponible"}
        </span>
        <button
          disabled={actionsDisabled || data.coverage.length !== 30 || missing.length > 0}
          aria-describedby={actionsDisabled ? "oece-attempt-notice" : undefined}
          className={buttonClasses({ variant: "primary" })}
          onClick={() => onStart("oece")}
        >
          Iniciar simulacro completo OECE
        </button>
        <button
          disabled={actionsDisabled}
          aria-describedby={actionsDisabled ? "oece-attempt-notice" : undefined}
          className={buttonClasses({ variant: "secondary" })}
          onClick={() => onStart("review")}
        >
          Repasar mis errores
        </button>
      </div>
      {actionsDisabled && (
        <p id="oece-attempt-notice" role="status" className="text-sm text-muted">
          Continúa o finaliza tu intento en curso antes de iniciar otro.
        </p>
      )}
      {missing.length > 0 && (
        <details className={C.examDisclosure}>
          <summary>
            ¿Qué falta para comenzar? ·{" "}
            {missing.reduce(
              (n, c) => n + Math.max(0, c.quota - c.published),
              0,
            )}{" "}
            preguntas publicadas pendientes
          </summary>
          <p className="mt-3 text-sm">
            El perfil requiere cubrir cada subcompetencia; tener 72 borradores
            no lo habilita.
          </p>
          <ul className="mt-3 space-y-3">
            {reviewPriority(data.coverage).map((c) => (
              <li
                key={c.code}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span>
                  {c.code} · {c.label}: faltan {c.missing}
                </span>
                {isAdmin && (
                  <Link
                    className={buttonClasses({ variant: "secondary" })}
                    href={"/simulador/banco?subcompetency=" + c.code}
                  >
                    Revisar pendientes
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted">
        {missing.length
          ? `En preparación: faltan preguntas revisadas en ${missing.length} subcompetencias. No se completan cupos con repeticiones.`
          : data.coverage.length !== 30
            ? "La cobertura informada aún no incluye las treinta subcompetencias requeridas."
            : "Las treinta cuotas están cubiertas con preguntas publicadas."}
      </p>
      <details className={C.examDisclosure}>
        <summary className="cursor-pointer text-sm font-semibold">
          Cobertura y pendientes por subcompetencia
        </summary>
        <p className="my-3 text-xs text-muted">
          Temario: 25/04/2025. {published} publicadas para este perfil
          {isAdmin ? ` · ${drafts} borradores con clasificación propuesta` : ""}
          . Meta editorial: 360 revisadas; la meta no representa disponibilidad.
        </p>
        <ul className="divide-y divide-line">
          {data.coverage.map((c) => (
            <li
              key={c.code}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span className="min-w-0">
                {c.code} · {c.label}
              </span>
              <span className="text-xs text-muted">
                {c.published} disponibles en el banco · {c.quota} por simulacro
                {c.published < c.quota ? ` · faltan ${c.quota - c.published}` : " · cupo cubierto"}
                {isAdmin ? ` · ${c.drafts} borradores · meta ${c.target}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <Link className={cn(buttonClasses({ variant: "secondary" }), "mt-3")} href="/simulador/banco">
            Revisar el banco y sus fuentes
          </Link>
        )}
      </details>
      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Biblioteca de simulaciones · cinco balotarios
        </summary>
        <p className="mt-3 text-sm text-muted">
          Cada edición exige las 360 preguntas revisadas y conserva la revisión
          usada por sus cinco conjuntos. Si cambia una pregunta, el conjunto
          requiere comprobación.
        </p>
        {data.balotarios.length ? (
          <ul className="mt-3 space-y-2">
            {data.balotarios.map((b) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 [&>button]:w-full sm:[&>button]:w-auto"
                key={b.id}
              >
                <span className="text-sm">
                  Balotario {b.slot} · {b.eligible}/72 disponibles · edición{" "}
                  {b.edition}
                  {b.created_at && (
                    <span className="mt-1 block text-xs text-muted">
                      Publicación de la edición:{" "}
                      {new Date(b.created_at).toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted">
                    {setAttempts.filter((a) => a.setId === b.id).length}{" "}
                    intentos entregados ·{" "}
                    {setAttempts.some((a) => a.setId === b.id)
                      ? `Mejor resultado: ${Math.max(...setAttempts.filter((a) => a.setId === b.id).map((a) => a.result?.correct ?? 0))}/72`
                      : `Sin resultado todavía`}
                  </span>
                </span>
                <button
                  className={buttonClasses({ variant: "secondary" })}
                  disabled={actionsDisabled || b.eligible !== 72}
                  aria-describedby={actionsDisabled ? "oece-attempt-notice" : undefined}
                  onClick={() => onStart("balotario", b.id)}
                >
                  Rendir balotario {b.slot}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map((slot) => (
              <div
                className="rounded-xl border border-line p-4"
                key={slot}
              >
                <h3 className="font-semibold">Balotario {slot}</h3>
                <p className="mt-2 text-sm text-muted">
                  72 preguntas · 120 minutos
                </p>
                <span className={cn(S.examStatus, "mt-3")}>
                  En preparación · sin edición publicada
                </span>
              </div>
            ))}
          </div>
        )}
      </details>
    </section>
  );
}
