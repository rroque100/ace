"use client";
import { useEffect, useState } from "react";
import { CORPUS_ANSWER_TYPES } from "@/lib/official-corpus";
import { documentTypeLabel } from "@/lib/legal-taxonomy";
import type { ExtendedLegalFilters } from "@/lib/legal-workspace-filters";
import{LIBRARY_COLLECTIONS}from"@/lib/library-workspace";

export function ExtendedLegalFilterControls({
  value,
  onChange, hideRegime = false,
}: {
  hideRegime?: boolean;
  value: ExtendedLegalFilters;
  onChange: (value: ExtendedLegalFilters) => void;
}) {
  return (
    <details className="legalWorkspacePanel">
      <summary>
        {hideRegime ? "Varios tipos y años" : "Régimen, varios tipos y años"}
        {[
          value.regime,
          value.documentTypes?.length,
          value.years?.length,
        ].filter(Boolean).length
          ? ` · ${[value.regime, value.documentTypes?.length, value.years?.length].filter(Boolean).length} grupos activos`
          : ""}
      </summary>
      <div className="legalWorkspaceGrid">
        <label>Materia<select value={value.collection??""} onChange={e=>onChange({...value,collection:e.target.value as ExtendedLegalFilters["collection"]})}><option value="">Todas las materias</option>{LIBRARY_COLLECTIONS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>Entidad contratante o solicitante<input value={value.contractingEntity??""} maxLength={200} placeholder="Nombre registrado en la fuente" onChange={e=>onChange({...value,contractingEntity:e.target.value})}/></label>
        <label>RUC de la entidad<input value={value.ruc??""} inputMode="numeric" maxLength={11} placeholder="11 dígitos; no se deduce" onChange={e=>onChange({...value,ruc:e.target.value})}/></label>
        {!hideRegime ? <label>
          Régimen revisado
          <select
            value={value.regime ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                regime: e.target.value as ExtendedLegalFilters["regime"],
              })
            }
          >
            <option value="">Todos los regímenes</option>
            <option value="32069">Ley 32069</option>
            <option value="30225">Ley 30225</option>
            <option value="especial">Régimen especial</option>
            <option value="no_determinado">Sin régimen revisado</option>
          </select>
        </label> : null}
        <label>
          Tipos de documento · puedes seleccionar varios
          <select
            multiple
            size={5}
            value={value.documentTypes ?? []}
            onChange={(e) =>
              onChange({
                ...value,
                documentTypes: Array.from(
                  e.target.selectedOptions,
                  (o) => o.value,
                ),
              })
            }
          >
            {CORPUS_ANSWER_TYPES.map((type) => (
              <option value={type} key={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Años registrados, separados por coma
          <input
            key={(value.years ?? []).join(",")}
            defaultValue={(value.years ?? []).join(", ")}
            placeholder="2024, 2025"
            onChange={(event) => event.currentTarget.setCustomValidity("")}
            onBlur={(event) => {
              const years = event.currentTarget.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              if (
                years.every((item) => /^(19|20|21)\d{2}$/.test(item)) &&
                years.length <= 12
              ) {
                event.currentTarget.setCustomValidity("");
                onChange({ ...value, years: [...new Set(years.map(Number))] });
              } else {
                event.currentTarget.setCustomValidity(
                  "Introduce hasta 12 años válidos, separados por coma.",
                );
                event.currentTarget.reportValidity();
              }
            }}
          />
          <small>
            Se aplica al salir del campo. Dentro de cada grupo se acepta
            cualquiera de los valores.
          </small>
        </label>
        <label className="legalWorkspaceCheck">
          <input
            type="checkbox"
            checked={Boolean(value.includeUnknownRegime)}
            onChange={(e) =>
              onChange({ ...value, includeUnknownRegime: e.target.checked })
            }
          />
          Incluir también documentos sin régimen revisado
        </label>
      </div>
      <p>
        El año no confirma régimen ni vigencia. Los metadatos sin revisión se
        muestran como desconocidos.
      </p>
      <button
        type="button"
        className="buttonSecondary"
        onClick={() => onChange({})}
      >
        Limpiar estos filtros
      </button>
    </details>
  );
}

type SearchEntry = {
  id: string;
  title: string;
  created_at: string;
  metadata: { query: string; filters: Record<string, unknown>; topK?: number; searchMode?: "literal"|"all_words"|"semantic"; sort?: "relevance"|"newest"|"oldest"; pageSize?: 5|10|20 };
};
export function LegalSearchHistory({
  revision,
  onRestore,
}: {
  revision: number;
  onRestore: (entry: SearchEntry["metadata"]) => void;
}) {
  const [items, setItems] = useState<SearchEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search/history", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItems(data.searches ?? []);
        setError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setError(
            "No se pudo cargar tu historial. Reabre la página para reintentar.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <details className="legalWorkspacePanel">
      <summary>
        Mis búsquedas recientes {items.length ? `· ${items.length}` : ""}
      </summary>
      <p>
        Privadas. La fecha corresponde a la consulta, no a la publicación del
        documento.
      </p>
      {loading ? (
        <p role="status">Cargando historial…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : items.length ? (
        <ul className="legalWorkspaceHistory">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {new Date(item.created_at).toLocaleString("es-PE")}
                </small>
              </div>
              <button
                className="buttonSecondary"
                type="button"
                onClick={() => onRestore(item.metadata)}
              >
                Recuperar consulta y filtros
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Las búsquedas completadas aparecerán aquí.</p>
      )}
    </details>
  );
}

export function LegalChatRecent() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat/sessions", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const p = await r.json();
        setSessions(p.sessions ?? []);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <details className="legalWorkspacePanel">
      <summary>Mis consultas</summary>
      {error ? (
        <p>
          No se pudo cargar el historial. Puedes reabrir la página para
          reintentar.
        </p>
      ) : sessions.length ? (
        <ul className="legalWorkspaceHistory">
          {sessions.map((session) => (
            <li key={session.id}>
              <a href={`/chat?sessionId=${session.id}`}>
                {session.title || "Consulta jurídica"}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>Tus consultas guardadas aparecerán aquí.</p>
      )}
    </details>
  );
}
