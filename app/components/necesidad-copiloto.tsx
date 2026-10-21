"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck, Copy, Loader, Send, Sparkles, WandSparkles, X } from "lucide-react";
import { markdownAHtmlSeguro } from "@/lib/markdown-seguro";
import type { CopilotoFuente } from "@/lib/necesidad-copiloto";

function MarkdownTexto({ content }: { content: string }) {
  if (!content?.trim()) return null;
  const html = markdownAHtmlSeguro(content);
  return (
    <div
      className="copilotoMsgTexto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-line [&_th]:border [&_th]:border-line [&_th]:bg-panel [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_td]:text-[12px] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_h1]:text-[14px] [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mb-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Copiloto IA del Requerimiento. Panel lateral que redacta y revisa los campos
// del requerimiento anclado a la guía oficial del tipo elegido (misma fuente que
// la guía inline). Consume /api/necesidades/copiloto (NDJSON en streaming) con
// la infra de chat existente.

export type CopilotoCampo = {
  key: string;
  label: string;
  valor: string;
  baseLegal?: string;
  seccion?: string;
  /** Molde del campo (estructura + ejemplo) para que la IA redacte con la forma
   *  que exige su artículo, no solo con el principio. */
  plantilla?: string;
  ejemplo?: string;
};

// Fuente normativa (Ley 32069 / Reglamento) o modelo de requerimiento que
// fundamenta la respuesta.
// El tipo se IMPORTA del servidor en vez de redeclararse aqui: era una copia
// que ya se habia quedado corta —le faltaban `documentId` y `rol`, que el
// backend si enviaba— y el panel no podia enlazar lo que citaba.
type Fuente = CopilotoFuente;

const TIPO_FUENTE_LABEL: Record<string, string> = {
  ley: "Ley",
  reglamento: "Reglamento",
  directiva: "Directiva",
  opinion: "Opinión",
  bases_integradas: "Modelo/Bases",
};

type Mensaje = {
  /** La búsqueda vectorial no respondió al generar esta respuesta. */
  degradada?: boolean;
  role: "user" | "assistant";
  content: string;
  // Para respuestas de "redactar": campo destino, para poder insertarlas.
  campoKey?: string;
  campoLabel?: string;
  // Fuentes normativas citadas (para respuestas del asistente).
  fuentes?: Fuente[];
  aviso?: string;
};

type Accion =
  | { accion: "revisar" }
  | { accion: "redactar"; campoObjetivo: CopilotoCampo }
  | { accion: "chat"; pregunta: string };

export function NecesidadCopiloto({
  abierto,
  onCerrar,
  tipoProcesoSeleccion,
  tipoObjeto,
  necesidadId,
  campos,
  faltantes = [],
  redactarSolicitud,
  onAplicarCampo,
}: {
  abierto: boolean;
  onCerrar: () => void;
  tipoProcesoSeleccion: string;
  tipoObjeto: string;
  necesidadId: string;
  /** Campos actualmente visibles del requerimiento (para contexto y redacción). */
  campos: CopilotoCampo[];
  /** Etiquetas de campos obligatorios aún vacíos (para priorizar en "revisar"). */
  faltantes?: string[];
  /** Orden externa de redactar un campo (desde el botón ✨ del propio campo). */
  redactarSolicitud?: { key: string; nonce: number } | null;
  /** Inserta el texto redactado en el campo de la ficha (mismo estado del padre). */
  onAplicarCampo: (key: string, valor: string) => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [parcial, setParcial] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pregunta, setPregunta] = useState("");
  const [campoRedactar, setCampoRedactar] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll al final cuando llega texto nuevo.
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [mensajes, parcial]);

  useEffect(() => {
    // Botón ✨ de un campo: redacta ese campo. El nonce dispara cada pulsación.
    if (!redactarSolicitud) return;
    const campo = campos.find((c) => c.key === redactarSolicitud.key);
    if (campo) void enviar({ accion: "redactar", campoObjetivo: campo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redactarSolicitud?.nonce]);

  if (!abierto) return null;

  const sinTipo = tipoProcesoSeleccion.trim() === "";

  async function enviar(peticion: Accion) {
    if (cargando) return;
    setCargando(true);
    setError(null);
    setParcial("");

    // Mensaje de usuario visible según la acción.
    const userMsg: Mensaje =
      peticion.accion === "revisar"
        ? { role: "user", content: "Revisar el requerimiento completo" }
        : peticion.accion === "redactar"
          ? {
              role: "user",
              content: `Redactar: ${peticion.campoObjetivo.label}`,
              campoKey: peticion.campoObjetivo.key,
              campoLabel: peticion.campoObjetivo.label,
            }
          : { role: "user", content: peticion.pregunta };
    setMensajes((m) => [...m, userMsg]);

    const body = {
      accion: peticion.accion,
      tipoProcesoSeleccion,
      tipoObjeto,
      necesidadId,
      camposLlenos: campos
        .filter((c) => c.valor.trim() !== "")
        .map((c) => ({ key: c.key, label: c.label, valor: c.valor })),
      ...(peticion.accion === "redactar"
        ? {
            campoObjetivo: {
              key: peticion.campoObjetivo.key,
              label: peticion.campoObjetivo.label,
              valor: peticion.campoObjetivo.valor,
              baseLegal: peticion.campoObjetivo.baseLegal ?? "",
              seccion: peticion.campoObjetivo.seccion ?? "",
              plantilla: peticion.campoObjetivo.plantilla ?? "",
              ejemplo: peticion.campoObjetivo.ejemplo ?? "",
            },
          }
        : {}),
      ...(peticion.accion === "revisar" ? { faltantes } : {}),
      ...(peticion.accion === "chat"
        ? {
            pregunta: peticion.pregunta,
            historial: mensajes
              .slice(-8)
              .map((m) => ({ role: m.role, content: m.content })),
          }
        : {}),
    };

    try {
      const res = await fetch("/api/necesidades/copiloto", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "No se pudo generar la respuesta.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acumulado = "";
      let fuentes: Fuente[] = [];
      // La búsqueda vectorial no respondió: lo citado sale del respaldo léxico.
      let degradada = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const linea = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!linea) continue;
          const ev = JSON.parse(linea) as {
            type: string;
            text?: string;
            error?: string;
            fuentes?: Fuente[];
            aviso?: string;
          };
          if (ev.type === "delta" && ev.text) {
            acumulado += ev.text;
            setParcial(acumulado);
          } else if (ev.type === "fuentes" && ev.fuentes) {
            fuentes = ev.fuentes;
          } else if (ev.type === "aviso" && ev.aviso === "busqueda-degradada") {
            degradada = true;
          } else if (ev.type === "error") {
            throw new Error(ev.error ?? "No se pudo generar la respuesta.");
          }
        }
      }

      const asistente: Mensaje = {
        degradada,
        role: "assistant",
        content: acumulado.trim(),
        ...(fuentes.length > 0 ? { fuentes } : {}),
        ...(peticion.accion === "redactar"
          ? { campoKey: peticion.campoObjetivo.key, campoLabel: peticion.campoObjetivo.label }
          : {}),
      };
      setMensajes((m) => [...m, asistente]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la respuesta.");
    } finally {
      setParcial("");
      setCargando(false);
    }
  }

  return (
    <aside className="copiloto" aria-label="Copiloto del requerimiento">
      <header className="copilotoHead">
        <span className="copilotoTitulo">
          <Sparkles size={15} /> Copiloto del requerimiento
        </span>
        <button className="iconButton" onClick={onCerrar} title="Cerrar" type="button">
          <X size={16} />
        </button>
      </header>

      <p className="copilotoSub">
        {sinTipo
          ? "Elige el tipo de proceso de selección para que el copiloto se ancle a su guía oficial."
          : `Anclado a la guía de: ${tipoProcesoSeleccion}.`}
      </p>

      {/* Acciones rápidas */}
      <div className="copilotoAcciones">
        <button
          className="secondaryButton compactButton"
          disabled={cargando}
          onClick={() => enviar({ accion: "revisar" })}
          type="button"
        >
          <ClipboardCheck size={13} /> Revisar requerimiento
        </button>
        <div className="copilotoRedactar">
          <select
            aria-label="Campo a redactar"
            disabled={cargando}
            onChange={(e) => setCampoRedactar(e.target.value)}
            value={campoRedactar}
          >
            <option value="">Redactar un campo…</option>
            {campos.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            className="secondaryButton compactButton"
            disabled={cargando || campoRedactar === ""}
            onClick={() => {
              const campo = campos.find((c) => c.key === campoRedactar);
              if (campo) enviar({ accion: "redactar", campoObjetivo: campo });
            }}
            type="button"
          >
            <WandSparkles size={13} /> Redactar
          </button>
        </div>
      </div>

      {/* Conversación */}
      <div className="copilotoLog" ref={logRef}>
        {mensajes.length === 0 && !parcial ? (
          <p className="copilotoVacio">
            Pide una revisión, redacta un campo o escribe una consulta sobre el requerimiento.
          </p>
        ) : null}

        {mensajes.map((m, i) => (
          <div className={`copilotoMsg ${m.role}`} key={i}>
            <MarkdownTexto content={m.content} />
            {/* Modo degradado a la vista. Sin este aviso, el respaldo lexico —un ilike
                con OR entre palabras y sin orden por relevancia— se presentaba como
                «fundamento normativo» y era indistinguible de una busqueda real. */}
            {m.degradada ? (
              <p className="copilotoDegradada" role="status">
                <AlertTriangle size={12} aria-hidden /> La búsqueda normativa está degradada: no se pudo
                consultar el índice vectorial. Las referencias, si las hay, salen de una coincidencia por
                palabras; puede que no haya ninguna. <strong>Verifica cada artículo antes de usarlo.</strong>
              </p>
            ) : null}
            {m.fuentes && m.fuentes.length > 0 ? (
              <div className="copilotoFuentes">
                <span className="copilotoFuentesLabel">Fundamento normativo:</span>
                {/* La cita se abre. Las normas van a /normas, que acepta `documentId` y
                    `article` y salta al articulo exacto; el PDF-modelo, a su descarga.
                    Una cita que no se puede comprobar obliga a creerle a la IA. */}
                {m.fuentes.map((f, j) => (
                  <a
                    className="copilotoFuente"
                    href={
                      f.rol === "norma"
                        ? `/normas?documentId=${encodeURIComponent(f.documentId)}${f.article ? `&article=${encodeURIComponent(f.article)}` : ""}`
                        : `/api/documents/${encodeURIComponent(f.documentId)}`
                    }
                    key={j}
                    rel="noreferrer"
                    target="_blank"
                    title={`${f.citation} — abrir ${f.rol === "norma" ? "en Normas" : "el modelo"}`}
                  >
                    {f.article ? `Art. ${f.article}` : f.citation.slice(0, 40)}
                    <em>{TIPO_FUENTE_LABEL[f.documentType] ?? f.documentType}</em>
                  </a>
                ))}
              </div>
            ) : null}
            {m.role === "assistant" ? (
              <div className="copilotoMsgAcc">
                <button
                  className="copilotoLink"
                  onClick={() => {
                    navigator.clipboard?.writeText(m.content);
                    setCopiado(i);
                    window.setTimeout(() => setCopiado((c) => (c === i ? null : c)), 1500);
                  }}
                  type="button"
                >
                  <Copy size={12} /> {copiado === i ? "Copiado" : "Copiar"}
                </button>
                {m.campoKey ? (
                  <button
                    className="copilotoLink"
                    onClick={() => onAplicarCampo(m.campoKey!, m.content)}
                    type="button"
                  >
                    <WandSparkles size={12} /> Insertar en «{m.campoLabel}»
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}

        {parcial ? (
          <div className="copilotoMsg assistant">
            <MarkdownTexto content={parcial} />
          </div>
        ) : null}

        {cargando && !parcial ? (
          <div className="copilotoMsg assistant">
            <div className="copilotoMsgTexto copilotoPensando">
              <Loader className="spin" size={13} /> Pensando…
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="copilotoError">{error}</p> : null}

      {/* Entrada libre */}
      <form
        className="copilotoInput"
        onSubmit={(e) => {
          e.preventDefault();
          const q = pregunta.trim();
          if (q.length < 3 || cargando) return;
          setPregunta("");
          enviar({ accion: "chat", pregunta: q });
        }}
      >
        <input
          disabled={cargando}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Pregunta o pide ayuda para redactar…"
          value={pregunta}
        />
        <button
          aria-label="Enviar"
          className="primaryButton compactButton"
          disabled={cargando || pregunta.trim().length < 3}
          type="submit"
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}
