"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, History, LoaderCircle, MessageSquareText, NotebookText, RefreshCw, X } from "lucide-react";

type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: unknown[];
  model: string | null;
  metadata: {
    assessment?: {
      confidence?: "alta" | "media" | "baja";
      queryUsed?: string;
      sufficient?: boolean;
    };
    confidence?: "alta" | "media" | "baja";
    feedback?: "correct" | "incorrect";
    feedbackNote?: string | null;
    note?: string;
    question?: string;
  };
  created_at: string;
};

type HistorySession = {
  id: string;
  title: string | null;
  messageCount: number;
  messages: HistoryMessage[];
  sourceCount: number;
  created_at: string;
  updated_at: string;
};

type HistoryResponse = {
  error?: string;
  sessions: HistorySession[];
};

function confidenceClass(confidence?: "alta" | "media" | "baja") {
  if (confidence === "alta") {
    return "confidencePill high";
  }

  if (confidence === "media") {
    return "confidencePill medium";
  }

  return "confidencePill low";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function firstUserQuestion(messages: HistoryMessage[]) {
  return messages.find((message) => message.role === "user")?.content ?? "Consulta sin pregunta";
}

function lastAssistantMessage(messages: HistoryMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant");
}

export function ChatHistory() {
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "notes">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "alta" | "media" | "baja">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const totalSources = useMemo(
    () => sessions.reduce((total, session) => total + session.sourceCount, 0),
    [sessions],
  );
  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const assistantMessages = session.messages.filter((message) => message.role === "assistant");
        const assistant = lastAssistantMessage(session.messages);
        const confidence = assistant?.metadata.assessment?.confidence ?? assistant?.metadata.confidence ?? "baja";
        const text = `${firstUserQuestion(session.messages)} ${assistant?.content ?? ""}`.toLowerCase();

        if (filter === "correct") {
          if (!assistantMessages.some((message) => message.metadata.feedback === "correct")) return false;
        }

        if (filter === "incorrect") {
          if (!assistantMessages.some((message) => message.metadata.feedback === "incorrect")) return false;
        }

        if (filter === "notes") {
          if (!assistantMessages.some((message) => Boolean(message.metadata.note))) return false;
        }

        if (confidenceFilter !== "all" && confidence !== confidenceFilter) return false;
        if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;

        return true;
      }),
    [confidenceFilter, filter, query, sessions],
  );
  const correctCount = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total +
          session.messages.filter(
            (message) => message.role === "assistant" && message.metadata.feedback === "correct",
          ).length,
        0,
      ),
    [sessions],
  );
  const incorrectCount = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total +
          session.messages.filter(
            (message) => message.role === "assistant" && message.metadata.feedback === "incorrect",
          ).length,
        0,
      ),
    [sessions],
  );
  const notesCount = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total +
          session.messages.filter((message) => message.role === "assistant" && message.metadata.note).length,
        0,
      ),
    [sessions],
  );

  async function loadHistory() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat/sessions", { cache: "no-store" });
      const payload = (await response.json()) as HistoryResponse;

      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar el historial.");
        return;
      }

      setSessions(payload.sessions);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial sync with the history API when the panel mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory();
  }, []);

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h2>Historial de consultas</h2>
        </div>
        <History size={22} />
      </div>

      <div className="historyStats">
        <div>
          <span>Sesiones</span>
          <strong>{sessions.length}</strong>
        </div>
        <div>
          <span>Fuentes guardadas</span>
          <strong>{totalSources}</strong>
        </div>
        <button className="secondaryButton compactButton" onClick={() => void loadHistory()} type="button">
          {loading ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}
          Actualizar
        </button>
      </div>

      {/* Filtros, no pestañas: estrechan una lista que sigue siendo la misma.
          `aria-pressed` dice lo que de verdad hacen; `role="tab"` prometía un
          panel asociado que nunca existió. */}
      <div className="historyTabs" role="group" aria-label="Filtrar conversaciones">
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")} type="button">
          Todas <span>{sessions.length}</span>
        </button>
        <button aria-pressed={filter === "correct"} onClick={() => setFilter("correct")} type="button">
          <Check size={14} /> Correctas <span>{correctCount}</span>
        </button>
        <button aria-pressed={filter === "incorrect"} onClick={() => setFilter("incorrect")} type="button">
          <X size={14} /> Incorrectas <span>{incorrectCount}</span>
        </button>
        <button aria-pressed={filter === "notes"} onClick={() => setFilter("notes")} type="button">
          <NotebookText size={14} /> Notas <span>{notesCount}</span>
        </button>
      </div>

      <div className="historyFilters">
        <label>
          <span>Buscar</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pregunta, tema o texto de respuesta"
            value={query}
          />
        </label>
        <label>
          <span>Confianza</span>
          <select
            onChange={(event) => setConfidenceFilter(event.target.value as typeof confidenceFilter)}
            value={confidenceFilter}
          >
            <option value="all">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </label>
      </div>

      <div className="documentList">
        <div className="listHeader">
          <div>
            <strong>Sesiones recientes</strong>
            <small>Preguntas, respuestas y fuentes persistidas</small>
          </div>
          <span>{filteredSessions.length}</span>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
        {loading && sessions.length === 0 ? (
          <div className="emptyState">Cargando historial...</div>
        ) : null}
        {!loading && sessions.length === 0 ? (
          <div className="emptyState">Aun no hay consultas guardadas.</div>
        ) : null}

        {filteredSessions.map((session) => {
          const assistant = lastAssistantMessage(session.messages);
          const confidence =
            assistant?.metadata.assessment?.confidence ?? assistant?.metadata.confidence;

          return (
            <article className="historyItem" key={session.id}>
              <div className="historyItemHeader">
                <div>
                  <span>{formatDate(session.updated_at)}</span>
                  <strong>{session.title ?? firstUserQuestion(session.messages)}</strong>
                </div>
                {assistant ? (
                  <span className={confidenceClass(confidence)}>Confianza {confidence ?? "baja"}</span>
                ) : null}
              </div>
              <p>{firstUserQuestion(session.messages)}</p>
              {assistant?.metadata.question ? (
                <p>
                  <strong>Pregunta original:</strong> {assistant.metadata.question}
                </p>
              ) : null}
              {assistant ? <p className="historyAnswer">{assistant.content}</p> : null}
              <div className="sourceMetaGrid">
                <span>{session.messageCount} mensaje(s)</span>
                <span>{session.sourceCount} fuente(s)</span>
                {assistant?.metadata.feedback === "correct" ? <span>Respuesta correcta</span> : null}
                {assistant?.metadata.feedback === "incorrect" ? <span>Respuesta incorrecta</span> : null}
                {assistant?.model ? <span>{assistant.model}</span> : null}
                {assistant?.metadata.assessment?.queryUsed ? (
                  <span>Busqueda {assistant.metadata.assessment.queryUsed}</span>
                ) : null}
              </div>
              {assistant?.metadata.note ? (
                <div className="historyNote">
                  <NotebookText size={15} />
                  <p>{assistant.metadata.note}</p>
                </div>
              ) : null}
              <details>
                <summary>
                  <MessageSquareText size={15} />
                  Ver mensajes
                </summary>
                <div className="historyMessages">
                  {session.messages.map((message) => (
                    <div key={message.id}>
                      <strong>{message.role === "user" ? "Usuario" : "Asistente"}</strong>
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
