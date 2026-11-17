"use client";

import { useEffect, useId, useState } from "react";
import { Heart, MessageSquare, Reply, SendHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_TEXTO_COMENTARIO, haceCuanto, iniciales, ordenarHilos, totalComentarios,
  type Comentario, type Hilo, type OrdenComentarios,
} from "@/lib/cursos/comentarios";

export type EstadoComentarios = { hilos: Hilo[]; estado: "ok" | "sin-migrar" | "error" };

const API = "/api/cursos/comentarios";

async function pedir<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const x = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok) throw new Error(x?.error ?? "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.");
  return x as T;
}

// Comentarios de la clase, con la disposición de la referencia: contador y orden arriba, caja para escribir, y cada
// comentario con su autor, cuándo, «me gusta» y respuestas de un nivel. El estado vive aquí: cada acción actualiza la
// lista al momento (optimista en «me gusta») sin recargar la página.
export function ComentariosClase({
  curso,
  clase,
  inicial,
  ahoraInicial,
}: {
  curso: string;
  clase: string;
  inicial: EstadoComentarios;
  /** Hora del servidor: el primer render del cliente usa la misma, así «Hace 3 min» no cambia al hidratar. */
  ahoraInicial: number;
}) {
  const [hilos, setHilos] = useState(inicial.hilos);
  const [orden, setOrden] = useState<OrdenComentarios>("recientes");
  const [ahora, setAhora] = useState(ahoraInicial);
  const [error, setError] = useState("");
  const idOrden = useId();

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const total = totalComentarios(hilos);

  async function comentar(texto: string, padreId: string | null) {
    const x = await pedir<{ comentario: Hilo }>(API, {
      method: "POST",
      body: JSON.stringify({ curso, clase, texto, padreId }),
    });
    setAhora(Date.now());
    setHilos((actual) =>
      padreId
        ? actual.map((h) => (h.id === padreId ? { ...h, respuestas: [...h.respuestas, x.comentario] } : h))
        : [{ ...x.comentario, respuestas: [] }, ...actual],
    );
  }

  function cambiar(id: string, cambio: (c: Comentario) => Comentario) {
    setHilos((actual) =>
      actual.map((h) =>
        h.id === id ? { ...h, ...cambio(h) } : { ...h, respuestas: h.respuestas.map((r) => (r.id === id ? cambio(r) : r)) },
      ),
    );
  }

  async function alternarMeGusta(c: Comentario) {
    const activo = !c.leGusta;
    const aplicar = (on: boolean) => (x: Comentario) => ({ ...x, leGusta: on, meGusta: x.meGusta + (on ? 1 : -1) });
    cambiar(c.id, aplicar(activo));
    setError("");
    try {
      await pedir(`${API}/${c.id}/me-gusta`, { method: "POST", body: JSON.stringify({ activo }) });
    } catch (e) {
      cambiar(c.id, aplicar(!activo));
      setError((e as Error).message);
    }
  }

  async function borrar(id: string) {
    setError("");
    try {
      await pedir(`${API}/${id}`, { method: "DELETE" });
      setHilos((actual) =>
        actual.filter((h) => h.id !== id).map((h) => ({ ...h, respuestas: h.respuestas.filter((r) => r.id !== id) })),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section aria-labelledby="titulo-comentarios" className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id="titulo-comentarios" className="m-0 flex items-center gap-2 text-base font-semibold text-ink">
          <MessageSquare size={18} aria-hidden className="text-brand" />
          Comentarios <span className="font-normal text-muted">({total})</span>
        </h2>
        {inicial.estado === "ok" && total > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted" htmlFor={idOrden}>
            <span className="sr-only">Ordenar comentarios</span>
            <select
              id={idOrden}
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenComentarios)}
              className="min-h-9 rounded-lg border border-line-strong bg-panel px-2 text-xs text-ink outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              <option value="recientes">Más recientes</option>
              <option value="populares">Más votados</option>
            </select>
          </label>
        )}
      </header>

      {inicial.estado !== "ok" ? (
        <p role="status" className="m-0 rounded-xl bg-info-soft px-3 py-2 text-sm leading-relaxed text-info">
          {inicial.estado === "sin-migrar"
            ? "Los comentarios aún no están disponibles: falta que Administración active esta función."
            : "No se pudieron cargar los comentarios. Recarga la página en un momento."}
        </p>
      ) : (
        <>
          <CajaComentario etiqueta="Escribe tu comentario o aporte" boton="Comentar" onEnviar={(t) => comentar(t, null)} />
          {error && (
            <p role="alert" className="mb-0 mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          {total === 0 ? (
            <p className="mb-0 mt-4 text-sm leading-relaxed text-muted">
              Aún no hay comentarios. Comparte una duda, un resumen o un caso práctico de esta clase.
            </p>
          ) : (
            // En escritorio la lista se desplaza dentro del panel, como en la referencia, para no empujar el temario.
            <ol className="m-0 mt-4 list-none space-y-5 p-0 lg:max-h-[34rem] lg:overflow-y-auto lg:pr-1">
              {ordenarHilos(hilos, orden).map((h) => (
                <li key={h.id}>
                  <ItemComentario c={h} ahora={ahora} onMeGusta={alternarMeGusta} onBorrar={borrar} onResponder={(t) => comentar(t, h.id)} />
                  {h.respuestas.length > 0 && (
                    <ol className="mb-0 ml-4 mt-3 list-none space-y-3 border-l-2 border-line p-0 pl-4">
                      {h.respuestas.map((r) => (
                        <li key={r.id}>
                          <ItemComentario c={r} ahora={ahora} onMeGusta={alternarMeGusta} onBorrar={borrar} />
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function CajaComentario({
  etiqueta,
  boton,
  onEnviar,
  onCancelar,
  autoFocus,
}: {
  etiqueta: string;
  boton: string;
  onEnviar: (texto: string) => Promise<void>;
  onCancelar?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const limpio = texto.trim();

  async function enviar() {
    if (!limpio || enviando) return;
    setEnviando(true);
    setError("");
    try {
      await onEnviar(limpio);
      setTexto("");
      onCancelar?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2 focus-within:border-brand focus-within:shadow-[var(--shadow-focus)]">
        <textarea
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={limpio ? 3 : 1}
          maxLength={MAX_TEXTO_COMENTARIO}
          placeholder={etiqueta}
          autoFocus={autoFocus}
          // `!` a propósito: workspace.css (fuera de capa, gana a las utilidades) da a todo textarea fondo --panel,
          // min-height de 40px y sombra al enfocar. Aquí la caja exterior ya dibuja borde y foco; sin anularlo se
          // veía una segunda caja dentro, con otro fondo en modo oscuro.
          className="min-h-7! flex-1 resize-none border-0 bg-transparent! py-1 text-sm text-ink shadow-none! outline-none placeholder:text-placeholder"
        />
        <button
          type="submit"
          disabled={!limpio || enviando}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-brand outline-none hover:bg-brand-soft focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:text-placeholder disabled:hover:bg-transparent"
        >
          <SendHorizontal size={18} aria-hidden />
          <span className="sr-only">{boton}</span>
        </button>
      </div>
      {(limpio || onCancelar) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span>
            {texto.length}/{MAX_TEXTO_COMENTARIO} · Ctrl+Enter para enviar
          </span>
          {onCancelar && (
            <button type="button" onClick={onCancelar} className="rounded px-1 font-semibold text-muted hover:text-ink">
              Cancelar
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-0 mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function ItemComentario({
  c,
  ahora,
  onMeGusta,
  onBorrar,
  onResponder,
}: {
  c: Comentario;
  ahora: number;
  onMeGusta: (c: Comentario) => void;
  onBorrar: (id: string) => Promise<void>;
  onResponder?: (texto: string) => Promise<void>;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const largo = c.texto.length > 420;
  const accion = "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold outline-none focus-visible:shadow-[var(--shadow-focus)]";

  return (
    <article className="flex gap-3">
      <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
        {iniciales(c.autor)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-ink">{c.autor}</span>
          {c.propio && <span className="text-xs text-muted">(tú)</span>}
          <time dateTime={c.creado} className="text-xs text-muted">
            {haceCuanto(c.creado, ahora)}
          </time>
        </p>
        <p className={cn("mb-1 mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink", largo && !expandido && "line-clamp-5")}>
          {c.texto}
        </p>
        {largo && (
          <button type="button" onClick={() => setExpandido(!expandido)} className="mb-1 text-xs font-semibold text-brand hover:underline">
            {expandido ? "Ver menos" : "Ver comentario completo"}
          </button>
        )}

        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onMeGusta(c)}
            aria-pressed={c.leGusta}
            className={cn(accion, c.leGusta ? "text-danger" : "text-muted hover:text-ink")}
          >
            <Heart size={15} aria-hidden fill={c.leGusta ? "currentColor" : "none"} />
            <span className="sr-only">Me gusta · </span>
            {c.meGusta}
          </button>
          {onResponder && (
            <button type="button" onClick={() => setRespondiendo(!respondiendo)} className={cn(accion, "text-muted hover:text-ink")}>
              <Reply size={15} aria-hidden /> Responder
            </button>
          )}
          {c.puedeBorrar &&
            (confirmar ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                {c.propio ? "¿Eliminar tu comentario?" : "¿Eliminar este comentario?"}
                <Button size="sm" variant="ghost" destructive onClick={() => void onBorrar(c.id)}>
                  Sí, eliminar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmar(false)}>
                  No
                </Button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmar(true)} className={cn(accion, "text-muted hover:text-danger")}>
                <Trash2 size={15} aria-hidden /> Eliminar
              </button>
            ))}
        </div>

        {respondiendo && onResponder && (
          <div className="mt-2">
            <CajaComentario
              etiqueta={`Responder a ${c.autor}`}
              boton="Responder"
              onEnviar={onResponder}
              onCancelar={() => setRespondiendo(false)}
              autoFocus
            />
          </div>
        )}
      </div>
    </article>
  );
}
