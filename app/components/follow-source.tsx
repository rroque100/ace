"use client";
import { useState } from "react";
import type { DocumentSearchInput } from "@/lib/document-search";
export function FollowSource({
  documentId,
  search,
  label,
}: {
  documentId?: string;
  search?: DocumentSearchInput;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/library/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          search,
          label: label.slice(0, 200),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage("Seguimiento guardado. Revisa las novedades en Mis fuentes.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo seguir la fuente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="tw inline-flex flex-wrap items-center gap-2">
      <button
        className="secondaryButton compactButton"
        type="button"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy
          ? "Guardando…"
          : search
            ? "Guardar búsqueda y seguir novedades"
            : "Seguir documento"}
      </button>
      {message ? (
        <span role="status" className="max-w-sm text-xs text-slate-600">
          {message}
        </span>
      ) : null}
    </span>
  );
}
