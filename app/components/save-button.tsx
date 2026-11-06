"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { buttonClasses } from "@/app/components/ui/button";
import { useEffect, useState } from "react";
import { Bookmark, Check, FolderPlus, LoaderCircle, X } from "lucide-react";

type SaveButtonProps = {
  itemType: "documento" | "articulo" | "mensaje";
  title: string;
  documentId?: string;
  articleId?: string;
  messageId?: string;
  label?: string;
};

type Folder = { id: string; name: string };

export function SaveButton({ itemType, title, documentId, articleId, messageId, label = "Guardar" }: SaveButtonProps) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Reset transient state and load folders when the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(false);
    fetch("/api/folders")
      .then((response) => response.json())
      .then((payload) => setFolders(payload.folders ?? []))
      .catch(() => setFolders([]));
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      let targetFolder = folderId;
      if (!targetFolder && newFolder.trim()) {
        const created = await fetch("/api/folders", {
          body: JSON.stringify({ name: newFolder.trim() }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).then((response) => response.json());
        targetFolder = created.folder?.id ?? "";
      }

      const response = await fetch("/api/saved", {
        body: JSON.stringify({
          articleId,
          carpetaId: targetFolder,
          documentId,
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
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={buttonClasses({ variant: "secondary", size: "sm" })} type="button">
          <Bookmark size={15} />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="dialogContent" aria-describedby={undefined}>
          <div className="pdfViewerBar">
            <Dialog.Title>Guardar en carpeta</Dialog.Title>
            <Dialog.Close asChild>
              <button className="iconButton" type="button">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <p className="savedItemTitle">{title}</p>
          <p className="dialogHelp">
            Guarda esta respuesta en una carpeta para organizarla por expediente, tema o revision.
          </p>

          <label className="promptInput">
            <span>Carpeta</span>
            <select onChange={(event) => setFolderId(event.target.value)} value={folderId}>
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
              <input onChange={(event) => setNewFolder(event.target.value)} placeholder="Mi carpeta" value={newFolder} />
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
            <button className={buttonClasses({ variant: "primary" })} disabled={saving} onClick={save} type="button">
              {saving ? <LoaderCircle size={16} /> : saved ? <Check size={16} /> : <Bookmark size={16} />}
              {saved ? "Guardado" : saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
