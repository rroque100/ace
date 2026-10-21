"use client";

import { useEffect, useState } from "react";
import { History, UserRound } from "lucide-react";

type Evento = {
  fecha: string;
  actor: string;
  etiqueta: string;
  tono: string;
  sustento: string;
  mecanismo: string;
};

/**
 * Línea de tiempo del requerimiento: creación y transiciones del workflow (quién
 * y cuándo), leídas del registro de auditoría. Da trazabilidad a los tres actores
 * —área usuaria, DEC, ATE— sin abrir otra pantalla. Colapsada por defecto: se
 * ofrece el último hito y se despliega el resto a demanda.
 *
 * `recarga` se incrementa tras cada transición para que la línea se ponga al día.
 */
export function HistorialNecesidad({ necesidadId, recarga }: { necesidadId: string; recarga: number }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/necesidades/${necesidadId}/historial`, { cache: "no-store" });
        const data = await r.json();
        if (vivo && r.ok) setEventos(data.eventos ?? []);
      } catch {
        /* silencioso: sin historial la ficha sigue funcionando */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [necesidadId, recarga]);

  if (!eventos || eventos.length === 0) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const ultimo = eventos[eventos.length - 1];

  return (
    <div className="histNec">
      <button
        aria-expanded={abierto}
        className="histNecToggle"
        onClick={() => setAbierto((v) => !v)}
        type="button"
      >
        <History size={13} /> Historial ({eventos.length})
        {!abierto ? <span className="histNecUltimo">· último: {ultimo.etiqueta}</span> : null}
      </button>
      {abierto ? (
        <ol className="histNecLista">
          {eventos.map((e, i) => (
            <li className="histNecItem" data-tono={e.tono} key={i}>
              <span aria-hidden className="histNecPunto" />
              <div className="histNecCuerpo">
                <span className="histNecEtiqueta">{e.etiqueta}</span>
                <span className="histNecMeta">
                  <UserRound size={11} aria-hidden /> {e.actor} · {fmt(e.fecha)}
                </span>
                {e.sustento ? (
                  <p className="histNecSustento">
                    “{e.sustento}”{e.mecanismo ? ` — ${e.mecanismo}` : ""}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
