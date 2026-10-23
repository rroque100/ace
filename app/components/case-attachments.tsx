"use client";
import { useEffect, useRef, useState } from "react";
type Item = {
  id: string;
  name: string;
  partial: boolean;
  pageCount: number | null;
  method: string;
};
export function CaseAttachments({
  sessionId,
  onSession,
  onChange,
  selected,
  onBusy,
  disabled = false,
}: {
  sessionId: string | null;
  onSession: (id: string) => void;
  onChange: (ids: string[]) => void;
  onBusy: (busy: boolean) => void;
  selected: string[];
  disabled?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [itemsSession, setItemsSession] = useState<string | null>(sessionId);
  const visibleItems = itemsSession === sessionId ? items : [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (sessionId)
      fetch(`/api/chat/attachments?sessionId=${sessionId}`)
        .then(async (r) => {
          const p = await r.json();
          if (!r.ok) throw new Error(p.error);
          if (!cancelled) {
            setItems(p.documents ?? []);
            setItemsSession(sessionId);
          }
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "No se pudieron recuperar los adjuntos; recarga para reintentar.",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  async function upload(file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("El máximo es 4 MiB por archivo.");
      const form = new FormData();
      form.set("file", file);
      if (sessionId) form.set("sessionId", sessionId);
      const r = await fetch("/api/chat/attachments", {
        method: "POST",
        body: form,
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      if (p.sessionId !== sessionId) onSession(p.sessionId);
      setItems((current) =>
        itemsSession === p.sessionId ? [p.document, ...current] : [p.document],
      );
      setItemsSession(p.sessionId);
      onChange([...selected, p.document.id].slice(-4));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el archivo.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <details className="legalWorkspacePanel">
      <summary>
        Documentos privados del caso{" "}
        {visibleItems.length ? `· ${visibleItems.length}` : ""}
      </summary>
      <p>
        PDF, PNG o JPEG · hasta 4 MiB. Selecciona hasta cuatro por consulta. Se
        guardan en esta conversación y no forman parte del corpus normativo.
      </p>
      <label className="legalAttachmentUpload">
        {busy
          ? "Leyendo y guardando el documento…"
          : "Añadir documento del caso"}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <small>
        Al adjuntar se procesa el contenido con el proveedor de IA configurado
        cuando es necesario leer imágenes o escaneos. Las imágenes siempre
        requieren revisión de la transcripción.
      </small>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="legalWorkspaceHistory">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <label className="legalWorkspaceCheck">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={
                  disabled ||
                  busy ||
                  (!selected.includes(item.id) && selected.length >= 4)
                }
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id);
                  onChange(ids);
                }}
              />
              <span>
                {item.name}
                <small>
                  {item.partial
                    ? "Lectura parcial · revisa el original"
                    : "Texto extraído · revisa el original"}
                  {item.pageCount ? ` · ${item.pageCount} páginas` : ""}
                </small>
              </span>
            </label>
            <a
              href={`/api/chat/attachments/${item.id}?sessionId=${sessionId}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir original
            </a>
          </li>
        ))}
      </ul>
      <p>
        {selected.length} seleccionado(s). Las citas C# corresponden al caso;
        las F# a fuentes oficiales.
      </p>
    </details>
  );
}
