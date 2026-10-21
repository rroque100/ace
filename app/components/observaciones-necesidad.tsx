"use client";

import { useState } from "react";
import { Check, CornerDownRight, MessageSquarePlus, RotateCcw, UserRound } from "lucide-react";
import type { ObservacionNecesidad } from "@/lib/necesidades";

/**
 * Observaciones POR CAMPO del requerimiento (D2). La DEC comenta un campo
 * concreto; el área usuaria lo subsana y lo marca resuelto. Sustituye al "un solo
 * texto de observación" por una ida-vuelta precisa y trazable.
 *
 * Presentacional: el estado (fetch/alta/resolver) vive en la ficha, que lo
 * comparte con el badge de cada campo.
 */
export function ObservacionesNecesidad({
  observaciones,
  campos,
  campoLabel,
  puedeGestionar,
  onAgregar,
  onResolver,
  onIrACampo,
}: {
  observaciones: ObservacionNecesidad[];
  /** Campos observables, para el desplegable de alta. */
  campos: { api: string; label: string }[];
  campoLabel: (api: string) => string;
  puedeGestionar: boolean;
  onAgregar: (campo: string, comentario: string) => Promise<void>;
  onResolver: (id: string, resuelto: boolean) => Promise<void>;
  onIrACampo: (api: string) => void;
}) {
  const [componiendo, setComponiendo] = useState(false);
  const [campo, setCampo] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const pendientes = observaciones.filter((o) => !o.resuelto);
  const resueltas = observaciones.filter((o) => o.resuelto);

  // Sin observaciones y sin permiso para crear, no se pinta nada.
  if (observaciones.length === 0 && !puedeGestionar) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

  async function enviar() {
    if (!campo || comentario.trim().length < 2) return;
    setEnviando(true);
    try {
      await onAgregar(campo, comentario.trim());
      setComentario("");
      setCampo("");
      setComponiendo(false);
    } finally {
      setEnviando(false);
    }
  }

  const item = (o: ObservacionNecesidad) => (
    <li className="obsItem" data-resuelto={o.resuelto ? "1" : undefined} key={o.id}>
      <div className="obsItemCuerpo">
        <button className="obsCampo" onClick={() => onIrACampo(o.campo)} type="button">
          <CornerDownRight size={11} aria-hidden /> {campoLabel(o.campo)}
        </button>
        <p className="obsComentario">{o.comentario}</p>
        <span className="obsMeta">
          <UserRound size={11} aria-hidden /> {o.autor_referencia ?? "—"} · {fmt(o.created_at)}
          {o.resuelto && o.resuelto_por ? ` · resuelto por ${o.resuelto_por}` : ""}
        </span>
      </div>
      {puedeGestionar ? (
        <button
          className="obsResolver"
          onClick={() => void onResolver(o.id, !o.resuelto)}
          title={o.resuelto ? "Reabrir la observación" : "Marcar como subsanada"}
          type="button"
        >
          {o.resuelto ? <RotateCcw size={13} /> : <Check size={13} />}
        </button>
      ) : null}
    </li>
  );

  return (
    <div className="obsPanel">
      <div className="obsPanelHead">
        <h3 className="panelTitle">Observaciones por campo</h3>
        {pendientes.length > 0 ? (
          <span className="obsPendientesBadge">{pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}</span>
        ) : observaciones.length > 0 ? (
          <span className="obsPendientesBadge" data-ok="1">Todas subsanadas</span>
        ) : null}
        {puedeGestionar ? (
          <button className="obsAgregarBtn" onClick={() => setComponiendo((v) => !v)} type="button">
            <MessageSquarePlus size={13} /> Observar un campo
          </button>
        ) : null}
      </div>

      {componiendo ? (
        <div className="obsComposer">
          <select onChange={(e) => setCampo(e.target.value)} value={campo}>
            <option value="">— Elige el campo a observar —</option>
            {campos.map((c) => (
              <option key={c.api} value={c.api}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Qué debe subsanar el área usuaria en ese campo…"
            rows={2}
            value={comentario}
          />
          <div className="obsComposerActions">
            <button
              className="primaryButton compactButton"
              disabled={enviando || !campo || comentario.trim().length < 2}
              onClick={() => void enviar()}
              type="button"
            >
              Añadir observación
            </button>
            <button className="secondaryButton compactButton" onClick={() => setComponiendo(false)} type="button">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {pendientes.length > 0 ? <ul className="obsLista">{pendientes.map(item)}</ul> : null}
      {resueltas.length > 0 ? (
        <details className="obsResueltas">
          <summary>Subsanadas ({resueltas.length})</summary>
          <ul className="obsLista">{resueltas.map(item)}</ul>
        </details>
      ) : null}
    </div>
  );
}
