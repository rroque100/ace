"use client";
import { useEffect, useState } from "react";
import type { WorkTarget } from "@/lib/chat-work-notes";
import type { DossierSource } from "@/lib/source-dossier";
import { PdfCiteButton } from "./pdf-cite-viewer";
export function SourceWorkLinksPanel({
  targetType,
  targetId,
}: {
  targetType: WorkTarget;
  targetId: string;
}) {
  const [open, setOpen] = useState(false),
    [links, setLinks] = useState<
      Array<{
        id: string;
        snapshot: DossierSource;
        comment: string;
        created_at: string;
      }>
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setBusy(true);
        setError("");
      }
    });
    void fetch(
      `/api/library/work-links?targetType=${targetType}&targetId=${targetId}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!controller.signal.aborted) setLinks(d.links ?? []);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar las referencias.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [open, targetId, targetType]);
  return (
    <details
      className="tw my-3 rounded-xl border border-line bg-panel p-4"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        Mis fuentes vinculadas · referencias personales
      </summary>
      <p className="my-2 text-sm text-muted">
        Conservan versión y procedencia. No modifican ni aprueban este
        procedimiento.
      </p>
      {busy ? (
        <p role="status">Consultando referencias…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !links.length ? (
        <p className="text-sm">
          No hay fuentes personales vinculadas a este registro.
        </p>
      ) : (
        links.map((link) => (
          <article
            className="my-3 space-y-2 border-t border-line pt-3"
            key={link.id}
          >
            <strong>{link.snapshot.title}</strong>
            <p className="text-sm">
              {link.snapshot.version ?? "Versión no registrada"} · Revisión
              pendiente ·{" "}
              {new Date(link.created_at).toLocaleDateString("es-PE")}
            </p>
            {link.comment ? (
              <p className="text-sm">Comentario personal: {link.comment}</p>
            ) : null}
            {link.snapshot.documentId ? (
              <PdfCiteButton
                documentId={link.snapshot.documentId}
                locator={link.snapshot.locator}
                label="Consultar fuente"
              />
            ) : null}
            {link.snapshot.sourceUrl ? (
              <a
                className="ml-3 text-sm underline"
                href={link.snapshot.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Fuente oficial
              </a>
            ) : null}
          </article>
        ))
      )}
    </details>
  );
}
