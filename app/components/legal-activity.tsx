"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Bookmark, Briefcase, CheckCircle2, FileSearch, LoaderCircle, RefreshCw } from "lucide-react";
import { processTypeLabel } from "@/lib/legal-taxonomy";

type ActivityItem = {
  confidence?: string | null;
  createdAt: string;
  detail: string;
  href: string;
  id: string;
  origin: "chat" | "guardado" | "analiza" | "validar" | "expediente";
  processType?: string | null;
  sourceCount?: number;
  title: string;
};

const originLabels: Record<ActivityItem["origin"], string> = {
  analiza: "Analiza",
  chat: "Chat",
  expediente: "Expediente",
  guardado: "Guardado",
  validar: "Validar",
};

function originIcon(origin: ActivityItem["origin"]) {
  if (origin === "chat") return <Bot size={16} />;
  if (origin === "analiza") return <FileSearch size={16} />;
  if (origin === "validar") return <CheckCircle2 size={16} />;
  if (origin === "expediente") return <Briefcase size={16} />;
  return <Bookmark size={16} />;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function LegalActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<"all" | ActivityItem["origin"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar la actividad.");
        return;
      }
      setItems(payload.items ?? []);
    } catch {
      setError("No se pudo conectar con la actividad jurídica.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial activity load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.origin === filter)),
    [filter, items],
  );

  return (
    <div className="toolPanel legalActivity">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Actividad jurídica</p>
          <h2>Trabajo integrado</h2>
        </div>
        <Activity size={22} />
      </div>

      {/* Filtros sobre una única lista, no pestañas: ver [chat-history]. */}
      <div className="historyTabs" role="group" aria-label="Filtrar por origen">
        {(["all", "chat", "analiza", "validar", "expediente", "guardado"] as const).map((item) => (
          <button aria-pressed={filter === item} key={item} onClick={() => setFilter(item)} type="button">
            {item === "all" ? "Todo" : originLabels[item]}{" "}
            <span>{item === "all" ? items.length : items.filter((entry) => entry.origin === item).length}</span>
          </button>
        ))}
        <button className="secondaryButton compactButton" onClick={() => void load()} type="button">
          {loading ? <LoaderCircle size={15} /> : <RefreshCw size={15} />}
          Actualizar
        </button>
      </div>

      {error ? <p className="formMessage errorText">{error}</p> : null}
      {loading && items.length === 0 ? <div className="emptyState">Cargando actividad...</div> : null}
      {!loading && visible.length === 0 ? <div className="emptyState">Sin actividad para este filtro.</div> : null}

      <div className="activityTimeline">
        {visible.map((item) => (
          <article className="activityItem" data-origin={item.origin} key={item.id}>
            <div className="activityIcon">{originIcon(item.origin)}</div>
            <div>
              <div className="activityItemHead">
                <span>{originLabels[item.origin]}</span>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <div className="sourceMetaGrid">
                {item.confidence ? <span>Confianza {item.confidence}</span> : null}
                {item.processType ? <span>{processTypeLabel(item.processType) ?? item.processType}</span> : null}
                {typeof item.sourceCount === "number" ? <span>{item.sourceCount} fuente(s)</span> : null}
              </div>
              <Link className="secondaryButton compactButton" href={item.href}>
                Abrir contexto
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
