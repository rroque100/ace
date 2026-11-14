"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { S } from "./case-attachments-estilos";
import { C } from "@/app/components/estilos-comunes";
type Item = {
  id: string;
  name: string;
  partial: boolean;
  pageCount: number | null;
  method: string;
  mime: string;
};
export type CaseAttachmentsHandle = { uploadFiles: (files: File[]) => void };
const FORMATOS = ["application/pdf", "image/png", "image/jpeg"];
type CaseAttachmentsProps = {
  sessionId: string | null;
  onSession: (id: string) => void;
  onChange: (ids: string[]) => void;
  onBusy: (busy: boolean) => void;
  selected: string[];
  disabled?: boolean;
  /** Abre el panel desde fuera (la pantalla inicial del chat). Sin esta prop, el panel es autónomo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Notifica los adjuntos seleccionados (con mime) para miniaturas fuera del panel. */
  onSelectionChange?: (items: Item[]) => void;
};
const CaseAttachments = forwardRef<CaseAttachmentsHandle, CaseAttachmentsProps>(function CaseAttachments({
  sessionId,
  onSession,
  onChange,
  selected,
  onBusy,
  disabled = false,
  open,
  onOpenChange,
  /** Notifica los adjuntos seleccionados (con mime) para miniaturas fuera del panel. */
  onSelectionChange,
}: CaseAttachmentsProps, ref) {
  const [items, setItems] = useState<Item[]>([]);
  const [itemsSession, setItemsSession] = useState<string | null>(sessionId);
  const visibleItems = useMemo(() => itemsSession === sessionId ? items : [], [items, itemsSession, sessionId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pendingUploads = useRef(0);
  // Selección en espejo: con varias subidas concurrentes (pegar varias imágenes a
  // la vez), cada una añade SOBRE la lista más reciente y no se pisan entre sí.
  const selectionRef = useRef<string[]>(selected);
  useEffect(() => {
    selectionRef.current = selected;
  }, [selected]);
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(visibleItems.filter((item) => selected.includes(item.id)));
  }, [selected, visibleItems, onSelectionChange]);
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
  const upload = useCallback(
    async (file: File) => {
      pendingUploads.current += 1;
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
        const next = [...selectionRef.current, p.document.id].slice(-6);
        selectionRef.current = next;
        onChange(next);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo cargar el archivo.",
        );
      } finally {
        pendingUploads.current = Math.max(0, pendingUploads.current - 1);
        const stillBusy = pendingUploads.current > 0;
        setBusy(stillBusy);
        onBusy(stillBusy);
        if (input.current) input.current.value = "";
      }
    },
    // `itemsSession` entra en el cierre de `setItems` para no perder adjuntos si la sesión cambia mientras sube.
    [sessionId, onSession, onChange, itemsSession, onBusy],
  );
  useImperativeHandle(
    ref,
    () => ({
      // Subida programática (paste / drag & drop): mismo flujo que el input file,
      // incluida la auto-selección del recién subido para esta consulta.
      uploadFiles(files: File[]) {
        if (busy || disabled) return;
        for (const file of files) {
          if (!FORMATOS.includes(file.type)) continue;
          void upload(file);
        }
      },
    }),
    [busy, disabled, upload],
  );
  // `open` solo se pasa cuando el llamador lo controla: un `open={undefined}` dejaría el panel cerrado en
  // cada render y el usuario no podría abrirlo a mano.
  return (
    <details
      className={C.legalWorkspacePanel}
      {...(open === undefined ? {} : { open })}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary>
        Adjuntar o elegir documentos{" "}
        {visibleItems.length ? `· ${visibleItems.length}` : ""}
      </summary>
      <p>
        PDF, PNG o JPEG · hasta 4 MiB. Selecciona hasta seis por consulta. Se
        guardan en esta conversación y no forman parte del corpus normativo. En
        documentos largos se leen las páginas relacionadas con tu pregunta y la
        cita indica cuáles.
      </p>
      <label className={S.legalAttachmentUpload}>
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
      <ul className={C.legalWorkspaceHistory}>
        {visibleItems.map((item) => (
          <li key={item.id}>
            <label className={C.legalWorkspaceCheck}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={
                  disabled ||
                  busy ||
                  (!selected.includes(item.id) && selected.length >= 6)
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
        {selected.length} seleccionado(s). Los documentos seleccionados se usarán en tu pregunta. Las citas C# corresponden al caso;
        las F# a fuentes oficiales.
      </p>
    </details>
  );
});
export { CaseAttachments };
