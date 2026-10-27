"use client";
import { markdownAHtmlSeguro } from "@/lib/markdown-seguro";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { WorkTarget, workNoteSnapshot } from "@/lib/chat-work-notes";
import { SourceWorkLinksPanel } from "./source-work-links-panel";
import { PdfCiteButton } from "./pdf-cite-viewer";
type Note = {
  id: string;
  message_id: string;
  snapshot: ReturnType<typeof workNoteSnapshot>;
  comment: string;
  created_at: string;
};
export function WorkNotesPanel({
  targetType,
  targetId,
}: {
  targetType: WorkTarget;
  targetId: string | null | undefined;
}) {
  const [open, setOpen] = useState(false),
    [notes, setNotes] = useState<Note[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!open || !targetId) return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setLoading(true);
        setNotes([]);
      }
    });
    void fetch(
      `/api/chat/work-notes?targetType=${targetType}&targetId=${targetId}`,
      { cache: "no-store", signal: abort.signal },
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error);
        if (!abort.signal.aborted) {
          setNotes(payload.notes ?? []);
          setError("");
        }
      })
      .catch((cause) => {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron abrir las notas",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [open, targetId, targetType]);
  if (!targetId) return null;
  return (
    <>
      <details
        className="tw my-3 rounded-xl border border-line bg-panel p-4"
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer font-semibold">
          Mis notas del Chat · apoyo pendiente de revisión
        </summary>
        <p className="text-sm text-muted">
          Son personales y conservan su procedencia. No son documentos aprobados
          del procedimiento.
        </p>
        {loading ? (
          <p role="status">Consultando notas…</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : !notes.length ? (
          <p>No hay notas personales guardadas para este registro.</p>
        ) : (
          notes.map((note) => (
            <article className="my-3 border-t border-line pt-3" key={note.id}>
              <strong>{note.snapshot.question}</strong>
              <small className="block">
                Pendiente de revisión ·{" "}
                {new Date(note.created_at).toLocaleDateString("es-PE")}
              </small>
              <details>
                <summary>Leer nota y fuentes</summary>
                <div
                  className="chatNoteText"
                  dangerouslySetInnerHTML={{
                    __html: markdownAHtmlSeguro(note.snapshot.answer),
                  }}
                />
                <ul>
                  {note.snapshot.sources.map((source) => (
                    <li key={source.number}>
                      <span>
                        [F{source.number}] {String(source.title)} ·{" "}
                        {source.locatorLabel
                          ? String(source.locatorLabel)
                          : source.pageStart
                            ? `Página ${source.pageStart}`
                            : "Ubicación pendiente"}
                      </span>
                      <PdfCiteButton
                        documentId={String(source.documentId)}
                        page={
                          typeof source.pageStart === "number"
                            ? source.pageStart
                            : null
                        }
                        locator={
                          typeof source.locator === "string"
                            ? source.locator
                            : null
                        }
                        label="Leer fuente"
                      />
                    </li>
                  ))}
                </ul>
                {note.comment ? (
                  <p>Comentario personal: {note.comment}</p>
                ) : null}
              </details>
              <Link
                href={
                  note.snapshot.sessionId
                    ? `/chat?sessionId=${note.snapshot.sessionId}`
                    : "/historial"
                }
              >
                Consultar historial del Chat
              </Link>
            </article>
          ))
        )}
      </details>
      <SourceWorkLinksPanel targetType={targetType} targetId={targetId} />
    </>
  );
}
