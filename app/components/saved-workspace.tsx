"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { Bookmark, ExternalLink, FolderClosed, Inbox, Save, Trash2 } from "lucide-react";
import { S } from "./saved-workspace-estilos";
import { C } from "@/app/components/estilos-comunes";

type Folder = { id: string; name: string };
type SavedItem = {
  id: string;
  carpeta_id: string | null;
  item_type: string;
  document_id: string | null;
  article_id: string | null;
  message_id: string | null;
  metadata?: Record<string, unknown> | null;
  title: string;
  note: string | null;
  created_at: string;
};

const typeLabels: Record<string, string> = {
  analisis: "Análisis",
  articulo: "Artículo",
  documento: "Documento",
  mensaje: "Respuesta",
  validacion: "Validación",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sourceCount(metadata?: Record<string, unknown> | null) {
  const legal = metadata?.legal as Record<string, unknown> | undefined;
  const legalSources = legal?.sources;
  if (Array.isArray(legalSources)) return legalSources.length;
  if (Array.isArray(metadata?.sources)) return metadata.sources.length;
  return 0;
}

function itemContext(item: SavedItem) {
  const metadata = item.metadata ?? {};
  const inferred = metadata.inferredContext as Record<string, unknown> | undefined;
  const legal = metadata.legal as Record<string, unknown> | undefined;
  const assessment = legal?.assessment as Record<string, unknown> | undefined;
  const parts = [
    stringValue(metadata.origin),
    stringValue(metadata.processType) || stringValue(inferred?.procedureType),
    stringValue(assessment?.confidence) ? `confianza ${stringValue(assessment?.confidence)}` : stringValue(metadata.confidence),
    sourceCount(metadata) ? `${sourceCount(metadata)} fuente(s)` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function itemQuestion(item: SavedItem) {
  const metadata = item.metadata ?? {};
  return (
    stringValue(metadata.question) ||
    stringValue((metadata.plan as Record<string, unknown> | undefined)?.intent) ||
    stringValue((metadata.inferredContext as Record<string, unknown> | undefined)?.query)
  );
}

function itemHref(item: SavedItem) {
  if (item.document_id) {
    return `/api/documents/${item.document_id}`;
  }
  if (item.item_type === "mensaje") {
    return "/historial";
  }
  if (item.item_type === "validacion") {
    return "/validar";
  }
  return null;
}

export function SavedWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [foldersRes, itemsRes] = await Promise.all([
      fetch("/api/folders").then((response) => response.json()),
      fetch("/api/saved").then((response) => response.json()),
    ]);
    setFolders(foldersRes.folders ?? []);
    setItems(itemsRes.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with saved items and folders when the workspace mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  const visible = useMemo(() => {
    if (selected === "all") return items;
    if (selected === "none") return items.filter((item) => !item.carpeta_id);
    return items.filter((item) => item.carpeta_id === selected);
  }, [items, selected]);

  async function saveNote(id: string) {
    await fetch("/api/saved", {
      body: JSON.stringify({ id, note: drafts[id] ?? "" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    void reload();
  }

  async function remove(id: string) {
    await fetch(`/api/saved?id=${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className={C.normGrid}>
      <aside className={C.normList} aria-label="Carpetas">
        <button className={`${C.normCard} ${selected === "all" ? "active" : ""}`} onClick={() => setSelected("all")} type="button">
          <strong>
            <Inbox size={15} /> Todo
          </strong>
          <span className={C.normCardMeta}>{items.length} elemento(s)</span>
        </button>
        <button className={`${C.normCard} ${selected === "none" ? "active" : ""}`} onClick={() => setSelected("none")} type="button">
          <strong>Sin carpeta</strong>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className={`${C.normCard} ${selected === folder.id ? "active" : ""}`}
            onClick={() => setSelected(folder.id)}
            type="button"
          >
            <strong>
              <FolderClosed size={15} /> {folder.name}
            </strong>
            <span className={C.normCardMeta}>
              {items.filter((item) => item.carpeta_id === folder.id).length} elemento(s)
            </span>
          </button>
        ))}
      </aside>

      <section className={C.normDetail} aria-label="Elementos guardados">
        {loading ? (
          <div className={C.emptyState}>
            <span>Cargando...</span>
          </div>
        ) : visible.length === 0 ? (
          <div className={C.emptyState}>
            <Bookmark size={20} />
            <strong>Nada guardado aquí</strong>
            <span>Usa Guardar en búsquedas, normas o respuestas del chat.</span>
          </div>
        ) : (
          <div className={C.documentList}>
            {visible.map((item) => {
              const href = itemHref(item);
              return (
                <article className={C.sourceItem} key={item.id}>
                  <div className={C.sourceItemHeader}>
                    <div>
                      <span>{typeLabels[item.item_type] ?? item.item_type}</span>
                      <strong>{item.title}</strong>
                      {itemContext(item) ? <small>{itemContext(item)}</small> : null}
                    </div>
                    <button className="inline-grid size-10 place-items-center cursor-pointer rounded-full border border-solid border-line box-border bg-panel text-brand transition-colors hover:bg-brand-soft" onClick={() => remove(item.id)} type="button" aria-label="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {itemQuestion(item) ? (
                    <p className={C.savedItemTitle}>
                      <strong>Contexto:</strong> {itemQuestion(item)}
                    </p>
                  ) : null}
                  {sourceCount(item.metadata) ? (
                    <div className={C.sourceMetaGrid}>
                      <span>{sourceCount(item.metadata)} fuente(s) usadas</span>
                      {stringValue(item.metadata?.processType) ? <span>{stringValue(item.metadata?.processType)}</span> : null}
                    </div>
                  ) : null}
                  <textarea
                    className={S.noteTextarea_savedNote}
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Nota personal..."
                    value={drafts[item.id] ?? item.note ?? ""}
                  />
                  <div className={C.sourceActions}>
                    <button className={buttonClasses({ variant: "secondary", size: "sm" })} onClick={() => saveNote(item.id)} type="button">
                      <Save size={15} />
                      Guardar nota
                    </button>
                    {href ? (
                      <a className={buttonClasses({ variant: "secondary", size: "sm" })} href={href} rel="noreferrer" target="_blank">
                        <ExternalLink size={15} />
                        Abrir
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
