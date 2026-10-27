"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { WorkTarget } from "@/lib/chat-work-notes";
import type { DossierSource } from "@/lib/source-dossier";
const targets = [
  { type: "necesidad", label: "Necesidad", url: "/api/necesidades?limit=50" },
  { type: "expediente", label: "Expediente", url: "/api/processes?limit=50" },
  { type: "contrato_sie", label: "Contrato SIE", url: "/api/contratos-sie" },
  { type: "contrato_cp", label: "Contrato CP", url: "/api/contratos-cp" },
] as const;
export function SourceWorkLink({ documentIds }: { documentIds: string[] }) {
  const [open, setOpen] = useState(false),
    [type, setType] = useState<WorkTarget>("necesidad"),
    [options, setOptions] = useState<Array<{ id: string; label: string }>>([]),
    [id, setId] = useState(""),
    [page, setPage] = useState(1),
    [comment, setComment] = useState(""),
    [preview, setPreview] = useState<DossierSource[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  async function load(next: WorkTarget, p = 1) {
    setType(next);
    setPage(p);
    setId("");
    setPreview(null);
    setBusy(true);
    setError("");
    try {
      const t = targets.find((t) => t.type === next)!;
      const r = await fetch(
        t.url +
          (["necesidad", "expediente"].includes(next) ? `&page=${p}` : ""),
      );
      const data = await r.json();
      if (!r.ok)
        throw Error(data.error ?? "No se pudieron consultar los destinos.");
      const rows = Array.isArray(data)
        ? data
        : (data.necesidades ?? data.processes ?? []);
      setOptions(
        rows.map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: [
            x.codigo ?? x.nomenclature ?? x.numero_contrato,
            x.nombre ?? x.denominacion ?? x.summary ?? x.entity ?? x.id,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo consultar el destino.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(save: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/library/work-links${save ? "" : "?preview=1"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentIds,
            targetType: type,
            targetId: id,
            comment,
          }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (save) {
        setSaved(true);
        setPreview(null);
      } else setPreview(data.sources);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la referencia.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setSaved(false);
          void load(type);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="secondaryButton compactButton"
          disabled={!documentIds.length || documentIds.length > 20}
        >
          Vincular a mi trabajo
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent librarySourcesDialog tw max-h-[90dvh] overflow-y-auto space-y-4">
          <Dialog.Title className="text-lg font-bold">
            Reunir fuentes para mi trabajo
          </Dialog.Title>
          <Dialog.Description>
            Se guardan referencias personales. No se modifica ni se aprueba el
            procedimiento.
          </Dialog.Description>
          {saved ? (
            <p role="status">Referencias guardadas en las notas del destino.</p>
          ) : (
            <>
              <label className="grid gap-2">
                Tipo de destino
                <select
                  className="rounded-lg border p-2"
                  value={type}
                  disabled={busy}
                  onChange={(e) => void load(e.target.value as WorkTarget)}
                >
                  {targets.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                Registro
                <select
                  className="rounded-lg border p-2"
                  value={id}
                  disabled={busy}
                  onChange={(e) => {
                    setId(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Selecciona un registro</option>
                  {options.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {["necesidad", "expediente"].includes(type) ? (
                <div className="flex gap-3">
                  <button
                    disabled={busy || page === 1}
                    onClick={() => void load(type, page - 1)}
                  >
                    Anteriores
                  </button>
                  <span>Página {page}</span>
                  <button
                    disabled={busy || options.length < 50}
                    onClick={() => void load(type, page + 1)}
                  >
                    Siguientes
                  </button>
                </div>
              ) : null}
              <label className="grid gap-2">
                Comentario opcional
                <textarea
                  className="rounded-lg border p-2"
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              {preview ? (
                <section className="rounded-lg bg-slate-50 p-3">
                  <strong>Vista previa · pendiente de revisión</strong>
                  <ul>
                    {preview.map((s) => (
                      <li key={s.documentId}>
                        {s.title} · {s.version ?? "Versión no registrada"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <button
                className="primaryButton"
                disabled={busy || !id}
                onClick={() => void submit(Boolean(preview))}
              >
                {busy
                  ? "Preparando…"
                  : preview
                    ? "Guardar referencias"
                    : "Ver vista previa"}
              </button>
            </>
          )}
          {error ? <p role="alert">{error}</p> : null}
          <Dialog.Close asChild>
            <button className="secondaryButton" disabled={busy}>
              Cerrar
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
