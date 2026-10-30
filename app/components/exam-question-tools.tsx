"use client";
import { useEffect, useState } from "react";
import { REPORT_REASONS } from "@/lib/exam-preparation";
export function ExamQuestionTools({
  attemptId,
  questionId,
  active,
}: {
  attemptId: string;
  questionId: string;
  active: boolean;
}) {
  const [reason, setReason] =
      useState<keyof typeof REPORT_REASONS>("ambiguous"),
    [comment, setComment] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) return;
    const send = () => {
      if (document.visibilityState === "visible")
        void fetch(`/api/exams/${attemptId}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId }),
        }).catch(() => {});
    };
    send();
    const timer = setInterval(send, 15000);
    return () => clearInterval(timer);
  }, [attemptId, questionId, active]);
  async function report() {
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/exams/preparation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          attemptId,
          questionId,
          reason,
          comment,
        }),
      });
      const x = await r.json();
      if (!r.ok) throw Error(x.error);
      setStatus(
        "Reporte registrado para revisión editorial. Tu nota no se modifica automáticamente.",
      );
      setComment("");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      key={questionId}
      className="mt-5 rounded-xl border border-slate-200 p-3"
    >
      <summary className="cursor-pointer text-sm text-slate-600">
        ¿Hay un problema con esta pregunta?
      </summary>
      <label className="mt-3 block text-sm">
        Motivo
        <select
          className="mt-1 w-full rounded-lg border p-3"
          value={reason}
          onChange={(e) =>
            setReason(e.target.value as keyof typeof REPORT_REASONS)
          }
        >
          {Object.entries(REPORT_REASONS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Comentario opcional
        <textarea
          maxLength={2000}
          rows={2}
          className="mt-1 w-full rounded-lg border p-3"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        className="secondaryButton mt-3"
        onClick={() => void report()}
      >
        Enviar a revisión
      </button>
      {status && (
        <p role="status" className="mt-3 text-sm">
          {status}
        </p>
      )}
    </details>
  );
}
