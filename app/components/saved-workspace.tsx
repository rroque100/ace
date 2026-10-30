"use client";
import"./library-workspace.css";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ExternalLink,
  FolderClosed,
  Inbox,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { DossierSource } from "@/lib/source-dossier";
import { SourceWorkLink } from "./source-work-link";
import{PdfCiteButton}from"./pdf-cite-viewer";
import {ResearchBrief} from './research-brief';
import type {ResearchBrief as Brief} from '@/lib/research-brief';
import {FollowWorkspace} from './follow-workspace';

type Folder = { id: string; name: string } & Brief;
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
  const inferred = metadata.inferredContext as
    Record<string, unknown> | undefined;
  const legal = metadata.legal as Record<string, unknown> | undefined;
  const assessment = legal?.assessment as Record<string, unknown> | undefined;
  const parts = [
    stringValue(metadata.origin),
    stringValue(metadata.processType) || stringValue(inferred?.procedureType),
    stringValue(assessment?.confidence)
      ? `confianza ${stringValue(assessment?.confidence)}`
      : stringValue(metadata.confidence),
    sourceCount(metadata) ? `${sourceCount(metadata)} fuente(s)` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function itemQuestion(item: SavedItem) {
  const metadata = item.metadata ?? {};
  return (
    stringValue(metadata.question) ||
    stringValue(
      (metadata.plan as Record<string, unknown> | undefined)?.intent,
    ) ||
    stringValue(
      (metadata.inferredContext as Record<string, unknown> | undefined)?.query,
    )
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
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>([]),
    [folderName, setFolderName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<DossierSource[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function reload() {
    try{
    const read=async(path:string)=>{const r=await fetch(path);const data=await r.json();if(!r.ok)throw Error(data.error??"No se pudieron consultar los guardados.");return data;};
    const [foldersRes, itemsRes] = await Promise.all([
      read("/api/folders"),
      read("/api/saved"),
    ]);
    setFolders(foldersRes.folders ?? []);
    setItems(itemsRes.items ?? []);
    setLoading(false);
    }catch(e){setLoading(false);setMessage(e instanceof Error?e.message:"No se pudieron consultar los guardados; reintenta.");}
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

  const chosenDocuments = [
    ...new Set(
      items
        .filter((item) => chosen.includes(item.id) && item.document_id)
        .map((item) => item.document_id!),
    ),
  ];
  async function folderAction(rename = false) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/folders", {
        method: rename ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          ...(rename ? { id: selected } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setFolderName("");
      await reload();
      setMessage(rename ? "Carpeta renombrada." : "Carpeta creada.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo guardar la carpeta.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, carpetaId: string) {
    setMessage("");
    try {
      const r = await fetch("/api/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, carpetaId: carpetaId || null }),
      });
      if (!r.ok) throw Error("No se pudo mover el elemento.");
      await reload();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo mover el elemento.",
      );
    }
  }
  async function exportSelection(format: "preview" | "csv" | "docx") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/saved/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chosen, format,folderId:folders.some(f=>f.id===selected)?selected:undefined }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.error);
      }
      if (format === "preview") {
        setPreview((await r.json()).sources);
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `fuentes-ace.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setBusy(false);
    }
  }
  async function chatSelection() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/search/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Ayúdame a estudiar estas fuentes seleccionadas. Distingue su contenido, versiones y los límites para aplicarlas a mi caso. Cita las páginas o bloques reales.",
          filters: {
            selectedDocumentIds: chosenDocuments,
            documentIds: chosenDocuments,
            expandCorpus: false,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      router.push(`/chat?sessionId=${d.sessionId}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo abrir el Chat.");
    } finally {
      setBusy(false);
    }
  }

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
    <div className="tw savedSourcesWorkspace min-w-0">
      <section className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold">Mis fuentes de trabajo</h2>
        <p className="text-sm text-slate-600">
          Reúne documentos, pasajes y respuestas. Las notas son personales y
          conservan su procedencia.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Nombre de carpeta
            <input
              className="rounded-lg border p-2"
              maxLength={120}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </label>
          <button
            className="secondaryButton"
            disabled={busy || !folderName.trim()}
            onClick={() => void folderAction()}
          >
            Crear carpeta
          </button>
          <button
            className="secondaryButton"
            disabled={
              busy ||
              !folderName.trim() ||
              !folders.some((f) => f.id === selected)
            }
            onClick={() => void folderAction(true)}
          >
            Renombrar carpeta actual
          </button>
        </div>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </section>
      <div className="normGrid">
        <aside className="normList" aria-label="Carpetas">
          <button
            className={`normCard ${selected === "all" ? "active" : ""}`}
            onClick={() => setSelected("all")}
            type="button"
          >
            <strong>
              <Inbox size={15} /> Todo
            </strong>
            <span className="normCardMeta">{items.length} elemento(s)</span>
          </button>
          <button
            className={`normCard ${selected === "none" ? "active" : ""}`}
            onClick={() => setSelected("none")}
            type="button"
          >
            <strong>Sin carpeta</strong>
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              className={`normCard ${selected === folder.id ? "active" : ""}`}
              onClick={() => setSelected(folder.id)}
              type="button"
            >
              <strong>
                <FolderClosed size={15} /> {folder.name}
              </strong>
              <span className="normCardMeta">
                {items.filter((item) => item.carpeta_id === folder.id).length}{" "}
                elemento(s)
              </span>
            </button>
          ))}
        </aside>

        <section className="normDetail" aria-label="Elementos guardados">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <input
                type="checkbox"
                checked={
                  Boolean(visible.length) &&
                  visible.every((i) => chosen.includes(i.id))
                }
                onChange={(e) => {
                  setChosen(
                    e.target.checked
                      ? visible.slice(0, 100).map((i) => i.id)
                      : [],
                  );
                  setPreview(null);
                }}
              />{" "}
              Seleccionar visibles · hasta 100
            </label>
            <span className="text-sm">{chosen.length} seleccionados</span>
            <button
              className="secondaryButton compactButton"
              disabled={busy || !chosen.length}
              onClick={() => void exportSelection("preview")}
            >
              Preparar exportación
            </button>
            <button
              className="secondaryButton compactButton"
              disabled={
                busy || !chosenDocuments.length || chosenDocuments.length > 8
              }
              onClick={() => void chatSelection()}
            >
              Consultar fuentes en Chat
            </button>
            <SourceWorkLink documentIds={chosenDocuments} />
            {chosenDocuments.length > 8 ? (
              <p className="text-sm">
                Elige hasta ocho documentos para una consulta; no se omitirán
                fuentes automáticamente.
              </p>
            ) : null}
          </div>
          <FollowWorkspace/>
          {folders.find(f=>f.id===selected)?<ResearchBrief key={selected} folder={folders.find(f=>f.id===selected)!} onSaved={()=>void reload()}/>:null}
          {preview ? (
            <section
              className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4"
              aria-label="Vista previa de exportación"
            >
              <strong>Relación de fuentes · vista previa</strong>
              <p className="my-2 text-sm">
                Comprueba versiones y pasajes. No equivale a una decisión
                jurídica aprobada.
              </p>
              <ul className="my-3 space-y-2">
                {preview.map((s, i) => (
                  <li key={i} className="text-sm">
                    <strong>{s.title}</strong> ·{" "}
                    {s.version ?? "Versión no registrada"} ·{" "}
                    {s.locatorLabel ?? "Documento completo"}
                    {s.quote ? <p className="line-clamp-3">{s.quote}</p> : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <button
                  className="secondaryButton"
                  disabled={busy}
                  onClick={() => void exportSelection("docx")}
                >
                  Descargar DOCX
                </button>
                <button
                  className="secondaryButton"
                  disabled={busy}
                  onClick={() => void exportSelection("csv")}
                >
                  Descargar CSV
                </button>
                <button onClick={() => setPreview(null)}>
                  Cerrar vista previa
                </button>
              </div>
            </section>
          ) : null}
          {loading ? (
            <div className="emptyState">
              <span>Cargando...</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="emptyState">
              <Bookmark size={20} />
              <strong>Nada guardado aquí</strong>
              <span>
                Usa Guardar en búsquedas, normas o respuestas del chat.
              </span>
            </div>
          ) : (
            <div className="documentList">
              {visible.map((item) => {
                const href = itemHref(item);
                return (
                  <article className="sourceItem" key={item.id}>
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        checked={chosen.includes(item.id)}
                        onChange={(e) => {
                          setChosen((current) =>
                            e.target.checked
                              ? [...current, item.id].slice(0, 100)
                              : current.filter((id) => id !== item.id),
                          );
                          setPreview(null);
                        }}
                      />{" "}
                      Seleccionar fuente
                    </label>
                    <div className="sourceItemHeader">
                      <div>
                        <span>
                          {typeLabels[item.item_type] ?? item.item_type}
                        </span>
                        <strong>{item.title}</strong>
                        {itemContext(item) ? (
                          <small>{itemContext(item)}</small>
                        ) : null}
                      </div>
                      <button
                        className="iconButton"
                        onClick={() => remove(item.id)}
                        type="button"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {itemQuestion(item) ? (
                      <p className="savedItemTitle">
                        <strong>Contexto:</strong> {itemQuestion(item)}
                      </p>
                    ) : null}
                    {item.metadata?.snapshot ? (
                      <div className="my-3 rounded-lg bg-slate-50 p-3 text-sm">
                        <p>
                          {String(
                            (item.metadata.snapshot as DossierSource).version ??
                              "Versión no registrada",
                          )}{" "}
                          ·{" "}
                          {String(
                            (item.metadata.snapshot as DossierSource)
                              .locatorLabel ?? "Documento completo",
                          )}
                        </p>
                        {(item.metadata.snapshot as DossierSource).quote ? (
                          <p className="mt-2 line-clamp-5 whitespace-pre-wrap">
                            {(item.metadata.snapshot as DossierSource).quote}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {sourceCount(item.metadata) ? (
                      <div className="sourceMetaGrid">
                        <span>
                          {sourceCount(item.metadata)} fuente(s) usadas
                        </span>
                        {stringValue(item.metadata?.processType) ? (
                          <span>{stringValue(item.metadata?.processType)}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <textarea
                      className="noteTextarea savedNote"
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder="Nota personal..."
                      value={drafts[item.id] ?? item.note ?? ""}
                    />
                    <div className="sourceActions">
                    {item.document_id?<PdfCiteButton documentId={item.document_id} page={(item.metadata?.snapshot as DossierSource|undefined)?.pageStart} locator={(item.metadata?.snapshot as DossierSource|undefined)?.locator} quote={(item.metadata?.snapshot as DossierSource|undefined)?.quote} label="Leer pasaje guardado"/>:null}
                      <label className="text-sm">
                        Mover a{" "}
                        <select
                          aria-label={`Carpeta de ${item.title}`}
                          value={item.carpeta_id ?? ""}
                          onChange={(e) => void move(item.id, e.target.value)}
                        >
                          <option value="">Sin carpeta</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondaryButton compactButton"
                        onClick={() => saveNote(item.id)}
                        type="button"
                      >
                        <Save size={15} />
                        Guardar nota
                      </button>
                      {href ? (
                        <a
                          className="secondaryButton compactButton"
                          href={href}
                          rel="noreferrer"
                          target="_blank"
                        >
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
    </div>
  );
}
