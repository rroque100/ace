"use client";
import { useState } from "react";
import { type ResearchBrief as Brief } from "@/lib/research-brief";
export function ResearchBrief({
  folder,
  onSaved,
}: {
  folder: Brief & { id: string; name: string };
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(f: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: folder.id,
          name: folder.name,
          research_question: f.get("question"),
          research_objective: f.get("objective"),
          research_notes: f.get("notes"),
          research_status: f.get("status"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        "Investigación guardada. Puedes seleccionar sus fuentes y preparar el informe.",
      );
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      open
      className="tw my-4 rounded-2xl border border-teal-200 bg-white p-5"
    >
      <summary className="cursor-pointer text-lg font-semibold text-teal-900">
        Investigación · {folder.name}
      </summary>
      <p className="my-3 text-sm text-slate-600">
        Pregunta, fuentes y notas personales. Este espacio no aprueba ni
        modifica un expediente de contratación.
      </p>
      <form action={save} className="grid gap-4">
        <label className="text-sm font-semibold">
          Pregunta de trabajo
          <textarea
            name="question"
            defaultValue={folder.research_question}
            maxLength={3000}
            rows={2}
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Objetivo
          <textarea
            name="objective"
            defaultValue={folder.research_objective}
            maxLength={3000}
            rows={2}
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Notas personales
          <textarea
            name="notes"
            defaultValue={folder.research_notes}
            maxLength={15000}
            rows={3}
            className="mt-2 w-full rounded-lg border p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Estado
          <select
            name="status"
            defaultValue={folder.research_status}
            className="ml-3 rounded-lg border p-3 font-normal"
          >
            <option value="draft">Borrador</option>
            <option value="review">En revisión</option>
            <option value="closed">Cerrado</option>
          </select>
        </label>
        <div>
          <button className="primaryButton" disabled={busy}>
            {busy ? "Guardando…" : "Guardar investigación"}
          </button>
        </div>
      </form>
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </details>
  );
}
