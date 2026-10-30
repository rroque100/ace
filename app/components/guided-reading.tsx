"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GUIDED_ACTIONS } from "@/lib/guided-reading";
export function GuidedReading({
  documentId,
  locator,
  page,
  sha256,
}: {
  documentId: string;
  locator?: string;
  page?: number;
  sha256?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function run(action: string) {
    setBusy(action);
    setError("");
    try {
      const r = await fetch("/api/library/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, action, locator, page, sha256 }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.push(d.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el Chat.");
    } finally {
      setBusy("");
    }
  }
  return (
    <details className="tw my-3 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-teal-900">
        Consultar con IA conservando esta fuente
      </summary>
      <p className="my-3 text-xs text-slate-600">
        Explicación asistida con citas. Solo «Relacionar» amplía la búsqueda; el
        documento inicial se conserva. Revisarás la pregunta antes de enviarla.
      </p>
      <div className="flex flex-wrap gap-2">
        {GUIDED_ACTIONS.filter(
          (a) => a.id !== "explain" || locator || page,
        ).map((a) => (
          <button
            type="button"
            key={a.id}
            disabled={Boolean(busy)}
            onClick={() => void run(a.id)}
            className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            {busy === a.id ? "Preparando…" : a.label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
    </details>
  );
}
