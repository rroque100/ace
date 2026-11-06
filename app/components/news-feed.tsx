"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClasses } from "@/app/components/ui/button";
import { Bell, FileText, Plus, Star, Trash2 } from "lucide-react";
import { DOCUMENT_TYPES, PROCESS_TYPES, documentTypeLabel, processTypeLabel } from "@/lib/legal-taxonomy";

type FeedEvent = {
  id: string;
  event_type: string;
  document_id: string | null;
  document_type: string | null;
  process_type: string | null;
  source_entity: string | null;
  topic: string | null;
  title: string;
  summary: string | null;
  created_at: string;
  relevante: boolean;
};
type Follow = { id?: string; kind: string; value: string };

const eventLabels: Record<string, string> = {
  documento_nuevo: "Nuevo documento",
  modificatoria: "Modificatoria",
  vigencia: "Cambio de vigencia",
};

const followKinds = [
  { value: "process", label: "Proceso" },
  { value: "document_type", label: "Tipo documental" },
  { value: "entity", label: "Entidad" },
  { value: "topic", label: "Tema" },
];

function followLabel(follow: Follow) {
  if (follow.kind === "process") return `Proceso: ${processTypeLabel(follow.value) ?? follow.value}`;
  if (follow.kind === "document_type") return `Tipo: ${documentTypeLabel(follow.value)}`;
  if (follow.kind === "entity") return `Entidad: ${follow.value}`;
  return `Tema: ${follow.value}`;
}

export function NewsFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [kind, setKind] = useState("process");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlyRelevant, setOnlyRelevant] = useState(false);

  async function reload() {
    const payload = await fetch("/api/boletin").then((response) => response.json());
    setEvents(payload.events ?? []);
    setFollows(payload.follows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with the news API when the feed mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function addFollow() {
    if (!value.trim()) {
      return;
    }
    await fetch("/api/seguimientos", {
      body: JSON.stringify({ kind, value: value.trim() }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setValue("");
    const follows = await fetch("/api/seguimientos").then((response) => response.json());
    setFollows(follows.follows ?? []);
    void reload();
  }

  async function removeFollow(id?: string) {
    if (!id) {
      return;
    }
    await fetch(`/api/seguimientos?id=${id}`, { method: "DELETE" });
    setFollows((current) => current.filter((follow) => follow.id !== id));
    void reload();
  }

  const visible = useMemo(
    () => (onlyRelevant ? events.filter((event) => event.relevante) : events),
    [events, onlyRelevant],
  );

  return (
    <div className="newsGrid">
      <div className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Novedades</p>
            <h2>Boletín normativo</h2>
          </div>
          <Bell size={22} />
        </div>
        <div className="toolBody">
          <label className="vigenteToggle">
            <input checked={onlyRelevant} onChange={(event) => setOnlyRelevant(event.target.checked)} type="checkbox" />
            Solo relevantes para mí
          </label>
        </div>
        <div className="documentList">
          {loading ? (
            <div className="emptyState">
              <span>Cargando...</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="emptyState">
              <Bell size={20} />
              <span>Sin novedades. Aparecerán al indexar documentos.</span>
            </div>
          ) : (
            visible.map((event) => (
              <article className={`feedItem ${event.relevante ? "relevant" : ""}`} key={event.id}>
                <div className="feedItemHeader">
                  <span className="feedType">{eventLabels[event.event_type] ?? event.event_type}</span>
                  {event.relevante ? (
                    <span className="feedRelevant">
                      <Star size={13} /> Relevante
                    </span>
                  ) : null}
                </div>
                <strong>{event.title}</strong>
                <div className="feedMeta">
                  {event.document_type ? <span>{documentTypeLabel(event.document_type)}</span> : null}
                  {processTypeLabel(event.process_type) ? <span>{processTypeLabel(event.process_type)}</span> : null}
                  {event.source_entity ? <span>{event.source_entity}</span> : null}
                  <span>{new Date(event.created_at).toLocaleDateString("es-PE")}</span>
                </div>
                {event.summary ? <p>{event.summary}</p> : null}
                {event.document_id ? (
                  <a className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/api/documents/${event.document_id}`} rel="noreferrer" target="_blank">
                    <FileText size={15} />
                    Abrir PDF
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Seguimiento</p>
            <h2>Temas que sigo</h2>
          </div>
          <Star size={20} />
        </div>
        <div className="toolBody">
          <div className="followForm">
            <select onChange={(event) => setKind(event.target.value)} value={kind}>
              {followKinds.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {kind === "process" ? (
              <select onChange={(event) => setValue(event.target.value)} value={value}>
                <option value="">Selecciona...</option>
                {PROCESS_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : kind === "document_type" ? (
              <select onChange={(event) => setValue(event.target.value)} value={value}>
                <option value="">Selecciona...</option>
                {DOCUMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <input onChange={(event) => setValue(event.target.value)} placeholder={kind === "entity" ? "OECE" : "impedimentos"} value={value} />
            )}
            <button className={buttonClasses({ variant: "primary" })} onClick={addFollow} type="button">
              <Plus size={16} />
              Seguir
            </button>
          </div>

          <div className="followList">
            {follows.length === 0 ? (
              <span className="articleIndexEmpty">No sigues nada todavía.</span>
            ) : (
              follows.map((follow) => (
                <span className="followChip" key={follow.id ?? follow.kind + follow.value}>
                  {followLabel(follow)}
                  <button onClick={() => removeFollow(follow.id)} type="button" aria-label="Dejar de seguir">
                    <Trash2 size={13} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
