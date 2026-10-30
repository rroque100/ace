"use client";
import { useEffect, useState, useCallback } from "react";
import { ExamEditorialQueue } from "./exam-learning";
import { EXAM_CURRICULUM } from "@/lib/exam-curriculum";
import {
  type ExamPreparation,
  REPORT_REASONS,
  metricLabel,
} from "@/lib/exam-preparation";
export function ExamEditorialPanel({
  onDrafts,
  onQuestion,
}: {
  onDrafts: () => void;
  onQuestion: (id: string) => void;
}) {
  const [data, setData] = useState<ExamPreparation | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("1.1"),
    [reportId, setReportId] = useState(""),
    [resolution, setResolution] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/exams/preparation", { cache: "no-store" });
    const x = await r.json();
    if (!r.ok) throw Error(x.error);
    setData(x);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/exams/preparation", { cache: "no-store", signal: c.signal })
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
  async function action(body: Record<string, unknown>, authoring = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        authoring ? "/api/exams/authoring" : "/api/exams/preparation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setNotice(x.message ?? "Operación registrada.");
      await load();
      onDrafts();
      if (body.action === "resolve") {
        setReportId("");
        setResolution("");
      }
    } catch (e) {
      setError((e as Error).message);
      void load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const published = data?.coverage.reduce((n, c) => n + c.published, 0) ?? 0,
    drafts = data?.coverage.reduce((n, c) => n + c.drafts, 0) ?? 0,
    ready =
      (data?.coverage.length === 30 &&
        data.coverage.every((c) => c.published >= c.target)) ??
      false;
  return (
    <section className="space-y-4 rounded-2xl border border-teal-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">
        Preparación del banco · meta de 360 revisadas
      </h2>
      <p className="text-sm text-slate-600">
        {published} publicadas y elegibles · {drafts} borradores con
        clasificación propuesta. Las preguntas de marco general sin
        subcompetencia no cuentan para este perfil.
      </p>
      {data && (
        <ExamEditorialQueue coverage={data.coverage} onQuestion={onQuestion} />
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm">
          {notice}
        </p>
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Preparar preguntas originales con asistencia de IA
        </summary>
        <p className="my-3 text-sm text-slate-600">
          Cada petición prepara hasta seis borradores usando pasajes del corpus
          oficial. Consume el proveedor configurado; no publica preguntas ni
          acredita revisión jurídica. Si faltan pasajes o cuota, la tarea queda
          identificada.
        </p>
        <label className="text-sm">
          Subcompetencia
          <select
            className="mt-1 w-full rounded-xl border p-3"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            {EXAM_CURRICULUM.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.label} · meta {s.target}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="secondaryButton mt-3"
          onClick={() => void action({ code, count: 6 }, true)}
        >
          {busy ? "Procesando…" : "Preparar siguiente lote de borradores"}
        </button>
        <ul className="mt-3 space-y-2 text-xs text-slate-600">
          {data?.authoring.slice(0, 5).map((b) => (
            <li key={b.id}>
              {b.subcompetency_code} · {b.state} · {b.created_count}/{b.target}{" "}
              guardados. {b.detail}
            </li>
          ))}
        </ul>
      </details>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Crear cinco balotarios de una edición
        </summary>
        <p className="my-3 text-sm text-slate-600">
          Se requieren cinco veces las treinta cuotas. Cada pregunta se usa una
          vez entre los cinco conjuntos. Las ediciones anteriores se conservan.
        </p>
        <button
          className="secondaryButton"
          disabled={busy || !ready}
          onClick={() => void action({ action: "assemble" })}
        >
          Crear edición con 360 preguntas revisadas
        </button>
        {!ready && (
          <p className="mt-2 text-xs text-slate-600">
            Faltan preguntas revisadas en una o más subcompetencias.
          </p>
        )}
      </details>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Reportes para revisión editorial ·{" "}
          {data?.reports.filter((r) => r.state === "open").length ?? 0} abiertos
        </summary>
        <ul className="mt-3 space-y-3">
          {data?.reports.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">
                {REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS] ??
                  r.reason}{" "}
                · revisión {r.question_revision}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                Pregunta: {r.question_id}
              </p>
              <p className="mt-2 whitespace-pre-wrap">
                {r.comment || "Sin comentario adicional."}
              </p>
              <button
                className="secondaryButton mt-2"
                onClick={() => onQuestion(r.question_id)}
              >
                Abrir pregunta reportada
              </button>
              {r.state === "open" ? (
                <button
                  className="secondaryButton mt-2"
                  onClick={() => {
                    setReportId(r.id);
                    setResolution("");
                  }}
                >
                  Registrar resolución
                </button>
              ) : (
                <p className="mt-2 text-xs">Revisado: {r.resolution}</p>
              )}
            </li>
          ))}
        </ul>
        {reportId && (
          <div className="mt-3 rounded-lg border border-teal-200 p-3">
            <label className="text-sm">
              Sustento de la revisión del reporte
              <textarea
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border p-3"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </label>
            <p className="my-2 text-xs">
              Resolver el reporte no publica ni modifica la pregunta. Usa su
              ficha para editarla o retirarla.
            </p>
            <button
              className="secondaryButton"
              disabled={busy || resolution.trim().length < 20}
              onClick={() =>
                void action({ action: "resolve", reportId, resolution })
              }
            >
              Guardar resolución
            </button>
          </div>
        )}
        {!data?.reports.length && (
          <p className="mt-3 text-sm text-slate-600">
            Todavía no hay reportes.
          </p>
        )}
      </details>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Medición de dificultad y discriminación
        </summary>
        <p className="my-3 text-xs text-slate-600">
          Solo primeras exposiciones por usuario y revisión, en simulacros
          completos comparables. Excluye borradores y prácticas con explicación.
          El tiempo activo es aproximado; las correlaciones no son una
          validación jurídica.
        </p>
        {data?.metrics.length ? (
          <ul className="space-y-3">
            {data.metrics.map((m) => (
              <li
                key={m.question_id + ":" + m.revision}
                className="rounded-lg border p-3 text-sm"
              >
                <p className="break-all text-xs">
                  {m.question_id} · revisión {m.revision}
                </p>
                <p className="mt-2">
                  {metricLabel(m.n)} · {m.n} usuarios ·{" "}
                  {Math.round(m.accuracy * 100)}% aciertos · {m.omitted}{" "}
                  omisiones
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Tiempo activo aproximado:{" "}
                  {m.active_seconds == null
                    ? "Sin medición suficiente"
                    : `${Math.round(m.active_seconds)} s (${m.timed_responses ?? 0} registros)`}{" "}
                  · Discriminación:{" "}
                  {m.discrimination == null
                    ? "No calculable con esta muestra"
                    : m.discrimination.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">
            Muestra insuficiente: todavía no hay simulacros completos
            comparables para medir el banco.
          </p>
        )}
      </details>
      <button
        className="secondaryButton"
        disabled={busy}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Actualizar cobertura y reportes
      </button>
    </section>
  );
}
