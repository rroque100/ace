"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Bot, Sparkles, Send } from "lucide-react";
import { ExpSlideOver } from "./slide-over-shell";
import type { ChatPanelProps } from "./types";
import { expBtnClass } from "./estilos";
import { cn } from "@/lib/utils";

export const ChatPanel = memo(function ChatPanel({ query, onClose, onAsk, searching, messages, onOpenExpediente }: ChatPanelProps) {
  const [draft, setDraft] = useState(query);
  const lastSyncedQueryRef = useRef(query);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (query !== lastSyncedQueryRef.current) {
      lastSyncedQueryRef.current = query;
      setDraft(query);
    }
  }, [query]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    const text = draft.trim();
    if (!text || searching) return;
    setDraft("");
    void onAsk(text);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const lastAi = [...messages].reverse().find((m) => m.role === "ai");
  const showSuggestion = !searching && lastAi && (!lastAi.sources || lastAi.sources.length === 0);

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      clasePanel="expChatPanel"
      etiquetaCerrar="Cerrar chat"
      onClose={onClose}
      subtitulo="Pregunta en lenguaje natural sobre los expedientes"
      titulo="Chat con IA"
    >
        <div className="tw flex flex-1 flex-col gap-3 overflow-auto bg-exp-line-soft p-4">
          {messages.length === 0 ? (
            <div className="px-5 py-10 text-center text-exp-muted">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-exp-brand text-white shadow-[0_4px_14px_rgba(15,118,110,0.25)]">
                <Bot size={24} />
              </div>
              <p className="my-1 text-sm text-exp-ink">Pregúntame lo que quieras sobre los expedientes archivados.</p>
              <p className="my-4 text-xs font-bold uppercase tracking-[0.5px] text-exp-muted">Ejemplos para empezar</p>
              <ul className="mx-auto max-w-[320px] list-none p-0 text-left text-[13px]">
                <li
                  className="mb-1.5 cursor-pointer rounded-lg border border-exp-line bg-exp-panel px-3 py-2 text-exp-ink-soft transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:text-exp-brand"
                  onClick={() => setDraft("¿Cuántos expedientes de contratación hay en 2024?")}
                >
                  ¿Cuántos expedientes de contratación hay en 2024?
                </li>
                <li
                  className="mb-1.5 cursor-pointer rounded-lg border border-exp-line bg-exp-panel px-3 py-2 text-exp-ink-soft transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:text-exp-brand"
                  onClick={() =>
                    setDraft("¿Dónde está el expediente de la licencia 2024-0345?")
                  }
                >
                  ¿Dónde está el expediente de la licencia 2024-0345?
                </li>
                <li
                  className="mb-1.5 cursor-pointer rounded-lg border border-exp-line bg-exp-panel px-3 py-2 text-exp-ink-soft transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:text-exp-brand"
                  onClick={() =>
                    setDraft("Resúmeme los expedientes de subgerencia de tránsito")
                  }
                >
                  Resúmeme los expedientes de subgerencia de tránsito
                </li>
              </ul>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid max-w-[90%] grid-cols-[32px_1fr] items-start gap-2.5",
                    m.role === "user" && "ml-auto",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                      m.role === "user" ? "bg-exp-ink-soft" : "bg-exp-brand",
                    )}
                  >
                    {m.role === "user" ? "Tú" : <Bot size={14} />}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed text-exp-ink shadow-exp-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "border-exp-ink-soft bg-exp-ink-soft text-white"
                        : "border-exp-line bg-exp-panel",
                    )}
                  >
                    <p className="m-0">{m.text}</p>
                    {m.warnings && m.warnings.length > 0 ? (
                      <p className="m-0 mt-2 rounded-lg border-l-[3px] border-l-exp-warning bg-exp-warning-soft px-2.5 py-1.5 text-xs text-[#78350f]">
                        {m.warnings.join(" ")}
                      </p>
                    ) : null}
                    {m.sources && m.sources.length > 0 ? (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {m.sources.map((s, j) => (
                          <button
                            key={j}
                            type="button"
                            className="flex w-full items-center gap-1.5 rounded-lg border border-exp-line bg-exp-panel px-2.5 py-1.5 text-left text-xs transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-brand-soft"
                            onClick={() => onOpenExpediente(s.expedienteId)}
                          >
                            <span className="shrink-0 rounded bg-exp-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{j + 1}</span>
                            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-exp-ink">{s.title}</span>
                            <span className="whitespace-nowrap text-[11px] text-exp-muted">{s.citation}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {searching ? (
                <div className="grid max-w-[90%] grid-cols-[32px_1fr] items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-exp-brand text-[11px] font-bold text-white">
                    <Bot size={14} />
                  </div>
                  <div className="rounded-xl border border-exp-line bg-exp-panel px-3.5 py-2.5 text-sm leading-relaxed text-exp-ink shadow-exp-sm">
                    <p className="m-0 inline-flex items-center gap-1.5 text-[13px] italic text-exp-muted after:ml-1 after:inline-block after:size-2 after:animate-exp-pulse after:rounded-full after:bg-exp-brand after:content-['']">
                      <Sparkles size={14} /> Pensando…
                    </p>
                  </div>
                </div>
              ) : null}
              {showSuggestion ? (
                <div className="flex items-start gap-2.5 rounded-exp border border-[#fde68a] bg-exp-warning-soft px-3.5 py-3 text-[13px] text-[#92400e] [&>svg]:mt-px [&>svg]:shrink-0 [&>svg]:text-exp-warning">
                  <Sparkles size={16} />
                  <div>
                    <strong className="mb-0.5 block font-bold text-[#78350f]">No encontré coincidencias claras</strong>
                    <p className="m-0 text-xs text-[#92400e]">
                      Prueba con otros términos, o sube un nuevo expediente desde la pestaña
                      Subir.
                    </p>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-exp-line bg-exp-panel px-3.5 py-3">
          <textarea
            ref={textareaRef}
            className="w-full resize-none rounded-exp border border-exp-line px-3 py-2.5 font-[inherit] text-sm leading-snug transition-colors duration-[120ms] ease-linear focus:border-exp-brand focus:shadow-[0_0_0_3px_rgba(15,118,110,0.10)] focus:outline-none disabled:cursor-not-allowed disabled:bg-exp-line-soft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu pregunta… (Enter envía, Shift+Enter nueva línea)"
            rows={2}
            disabled={searching}
          />
          <button
            type="button"
            className={expBtnClass("primary")}
            onClick={() => void submit()}
            disabled={!draft.trim() || searching}
          >
            <Send size={16} /> Preguntar
          </button>
        </div>
    </ExpSlideOver>
  );
});
