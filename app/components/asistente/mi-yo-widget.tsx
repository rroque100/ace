"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, FileText, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccionPropuesta } from "@/lib/mi-yo";

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RUTA_NECESIDAD = new RegExp(`^/necesidades/(${UUID_RE})(?:/|$)`, "i");
const RUTA_EXPEDIENTE = new RegExp(`^/expedientes/(${UUID_RE})(?:/|$)`, "i");

type MiYoContexto = { tipo: "necesidad" | "expediente"; id: string } | null;

// Deriva el registro abierto (si lo hay) de la URL actual: /necesidades/{id}
// o /expedientes/{id}. Es la única forma que tiene "Mi Yo" de saber a qué se
// refiere "esta necesidad" — el widget no comparte estado con el formulario.
function contextoDesdeRuta(pathname: string): MiYoContexto {
  const necesidad = pathname.match(RUTA_NECESIDAD);
  if (necesidad) return { tipo: "necesidad", id: necesidad[1] };
  const expediente = pathname.match(RUTA_EXPEDIENTE);
  if (expediente) return { tipo: "expediente", id: expediente[1] };
  return null;
}

type Mensaje = {
  role: "user" | "assistant";
  content: string;
  intent?: string | null;
  sources?: Array<{ title: string; citation: string; ubicacionResumen?: string }>;
  accionPropuesta?: AccionPropuesta;
  // Una vez confirmada o cancelada, la tarjeta deja de mostrar los botones —
  // evita doble ejecución con un segundo clic sobre el mismo mensaje.
  accionResuelta?: boolean;
};

// Botón flotante + panel del asistente único de ACE. Vive en <AppShell> (una
// sola vez, visible en cualquier módulo autenticado) y habla con /api/asistente/*,
// que a su vez reutiliza la lógica de legal-chat.ts, expedientes-archivo-search.ts
// y audit_logs — ver lib/mi-yo.ts.
export function MiYoWidget() {
  const [open, setOpen] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const contexto = useMemo(() => contextoDesdeRuta(pathname ?? ""), [pathname]);

  useEffect(() => {
    if (!open || cargado) return;
    setCargado(true);
    fetch("/api/asistente/historial")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { conversationId: string | null; messages: Mensaje[] } | null) => {
        if (!data) return;
        setConversationId(data.conversationId);
        setMensajes(data.messages ?? []);
      })
      .catch(() => {
        /* sin historial previo: se arranca en blanco, no es un error visible */
      });
  }, [open, cargado]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, enviando]);

  async function enviar(texto: string) {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    setInput("");
    setMensajes((prev) => [...prev, { role: "user", content: mensaje }]);
    setEnviando(true);
    try {
      const res = await fetch("/api/asistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: mensaje,
          conversationId: conversationId ?? undefined,
          contexto: contexto ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo responder");
      setConversationId(data.conversationId);
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, intent: data.intent, sources: data.sources, accionPropuesta: data.accionPropuesta },
      ]);
    } catch (error) {
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: `No pude responder: ${error instanceof Error ? error.message : "error desconocido"}` },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  // Marca la propuesta del mensaje `index` como resuelta (ya sea confirmada o
  // cancelada), para que la tarjeta deje de mostrar los botones.
  function marcarResuelta(index: number) {
    setMensajes((prev) => prev.map((m, i) => (i === index ? { ...m, accionResuelta: true } : m)));
  }

  function cancelarAccion(index: number) {
    marcarResuelta(index);
    setMensajes((prev) => [...prev, { role: "assistant", content: "Acción cancelada." }]);
  }

  async function confirmarAccion(index: number, propuesta: AccionPropuesta) {
    if (confirmando) return;
    marcarResuelta(index);
    setConfirmando(true);
    try {
      const res = await fetch("/api/asistente/accion/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: propuesta.tipo, parametros: propuesta.parametros, conversationId: conversationId ?? undefined }),
      });
      const data = await res.json();
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: res.ok ? data.mensaje : `No pude completarlo: ${data.error ?? "error desconocido"}` },
      ]);
    } catch (error) {
      setMensajes((prev) => [
        ...prev,
        { role: "assistant", content: `No pude completarlo: ${error instanceof Error ? error.message : "error desconocido"}` },
      ]);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="tw fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex h-[min(600px,80vh)] w-[min(380px,92vw)] flex-col overflow-hidden rounded-xl border border-line bg-canvas shadow-pop">
          <header className="flex shrink-0 items-center justify-between gap-2 bg-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <div>
                <p className="text-sm font-semibold leading-tight">Mi Yo</p>
                <p className="text-[11px] leading-tight text-white/80">Tu asistente en ACE</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar Mi Yo"
              className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X size={16} />
            </button>
          </header>

          {contexto ? (
            <p className="flex shrink-0 items-center gap-1.5 border-b border-line bg-brand-soft px-3 py-1.5 text-[11px] text-ink">
              <FileText size={12} className="shrink-0 text-brand" />
              Preguntando sobre {contexto.tipo === "necesidad" ? "esta necesidad" : "este expediente"}
            </p>
          ) : null}

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {mensajes.length === 0 ? (
              <p className="rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-muted">
                Hola, soy Mi Yo. Pregúntame sobre la normativa de contratación, busca en el archivo de expedientes,
                pídeme un resumen de lo último que hiciste en ACE, o dime &quot;crea una necesidad para...&quot; — te
                muestro la propuesta y tú confirmas antes de que se registre.
              </p>
            ) : null}
            {mensajes.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.role === "user" ? "bg-brand text-white" : "border border-line bg-panel text-ink",
                  )}
                >
                  {m.content}
                </p>
                {m.sources && m.sources.length > 0 ? (
                  <ul className="max-w-[85%] space-y-0.5 text-[11px] text-muted">
                    {m.sources.map((s, j) => (
                      <li key={j}>
                        · {s.title} ({s.citation}){s.ubicacionResumen ? ` — ${s.ubicacionResumen}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.accionPropuesta && !m.accionResuelta ? (
                  <div className="flex max-w-[85%] gap-2">
                    <button
                      type="button"
                      disabled={confirmando}
                      onClick={() => void confirmarAccion(i, m.accionPropuesta!)}
                      className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                    >
                      <Check size={12} /> Confirmar
                    </button>
                    <button
                      type="button"
                      disabled={confirmando}
                      onClick={() => cancelarAccion(i)}
                      className="rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink transition-opacity disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {enviando ? (
              <p className="flex w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-muted">
                <Loader2 size={13} className="animate-spin" /> Mi Yo está pensando...
              </p>
            ) : null}
          </div>

          <form
            className="flex shrink-0 gap-2 border-t border-line p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={enviando}
              className="flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={enviando || !input.trim()}
              aria-label="Enviar"
              className="flex shrink-0 items-center justify-center rounded-md bg-brand px-3 text-white transition-opacity disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar Mi Yo" : "Abrir Mi Yo"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-pop transition-transform hover:scale-105"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
