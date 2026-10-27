"use client";
import"./library-workspace.css";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Bookmark, Check, FolderPlus, LoaderCircle, X } from "lucide-react";

type SaveButtonProps = {
  itemType: "documento" | "articulo" | "mensaje";
  title: string;
  documentId?: string;
  articleId?: string;
  messageId?: string;
  label?: string;
  locator?: string;
  chunkId?: string;
};

type Folder = { id: string; name: string };

export function SaveButton({
  itemType,
  title,
  documentId,
  articleId,
  messageId,
  label = "Guardar",
  locator,
  chunkId,
}: SaveButtonProps) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    // Reset transient state and load folders when the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(false);
    setError("");
    fetch("/api/folders")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw Error(
            payload.error ?? "No se pudieron consultar las carpetas.",
          );
        return payload;
      })
      .then((payload) => setFolders(payload.folders ?? []))
      .catch(() => {
        setFolders([]);
        setError(
          "No se pudieron consultar las carpetas. Puedes reabrir este panel para reintentar.",
        );
      });
  }, [open]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      let targetFolder = folderId;
      if (!targetFolder && newFolder.trim()) {
        const created = await fetch("/api/folders", {
          body: JSON.stringify({ name: newFolder.trim() }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).then((response) => response.json());
        targetFolder = created.folder?.id ?? "";
        if (!targetFolder)
          throw Error(
            created.error ??
              "No se pudo crear la carpeta; la fuente aún no se guardó.",
          );
      }

      const response = await fetch("/api/saved", {
        body: JSON.stringify({
          articleId,
          carpetaId: targetFolder,
          documentId,
          locator,
          chunkId,
          itemType,
          messageId,
          note,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (response.ok) {
        setSaved(true);
        setNote("");
        setNewFolder("");
        setTimeout(() => setOpen(false), 900);
      } else {
        const payload = await response.json();
        throw Error(payload.error ?? "No se pudo guardar el pasaje.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar. Reintenta.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="secondaryButton compactButton" type="button">
          <Bookmark size={15} />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="dialogContent sourceSaveDialog" aria-describedby={undefined}>
          <div className="pdfViewerBar">
            <Dialog.Title>Guardar en carpeta</Dialog.Title>
            <Dialog.Close asChild>
              <button className="iconButton" type="button" aria-label="Cerrar guardado">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <p className="savedItemTitle">{title}</p>
          {error ? <p role="alert">{error}</p> : null}
          <p className="dialogHelp">
            Guarda esta fuente, pasaje o respuesta para organizarla por
            expediente, tema o revisión.
          </p>

          <label className="promptInput">
            <span>Carpeta</span>
            <select
              onChange={(event) => setFolderId(event.target.value)}
              value={folderId}
            >
              <option value="">Sin carpeta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>

          {!folderId ? (
            <label className="promptInput">
              <span>
                <FolderPlus size={13} /> O crear carpeta nueva
              </span>
              <input
                onChange={(event) => setNewFolder(event.target.value)}
                placeholder="Mi carpeta"
                value={newFolder}
              />
            </label>
          ) : null}

          <label className="promptInput">
            <span>Nota (opcional)</span>
            <textarea
              className="noteTextarea"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Usar como base para informe legal del expediente."
              value={note}
            />
          </label>

          <div className="dialogActions">
            <button
              className="primaryButton"
              disabled={saving}
              onClick={save}
              type="button"
            >
              {saving ? (
                <LoaderCircle size={16} />
              ) : saved ? (
                <Check size={16} />
              ) : (
                <Bookmark size={16} />
              )}
              {saved ? "Guardado" : saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
