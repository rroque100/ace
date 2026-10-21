"use client";

import { Check, CircleDashed, Dot, XCircle } from "lucide-react";
import { construirPasosFlujo, ramaFlujo } from "@/lib/necesidad-flujo";

const FECHA = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : null;

/**
 * Stepper del flujo del requerimiento (C): dónde está y desde cuándo, de un
 * vistazo, para los tres actores. Los desvíos (observada / no objeción) se
 * anclan en "En revisión" con una nota; la anulación se muestra como término.
 */
export function FlujoStepper({
  status,
  createdAt,
  hitos,
}: {
  status: string;
  createdAt: string | null;
  hitos: Record<string, string>;
}) {
  const pasos = construirPasosFlujo(status, createdAt, hitos);
  const rama = ramaFlujo(status);

  return (
    <div className="flujoStepper" aria-label="Estado del requerimiento">
      <ol className="flujoPasos">
        {pasos.map((p, i) => (
          <li className="flujoPaso" data-estado={p.estado} key={p.state}>
            {i > 0 ? <span className="flujoLinea" data-previo={pasos[i - 1].estado} aria-hidden /> : null}
            <span className="flujoNodo" aria-hidden>
              {p.estado === "done" ? <Check size={13} /> : p.estado === "current" ? <Dot size={20} /> : <CircleDashed size={13} />}
            </span>
            <span className="flujoPasoTexto">
              <span className="flujoPasoLabel">{p.label}</span>
              {FECHA(p.fecha) ? <span className="flujoPasoFecha">{FECHA(p.fecha)}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {rama ? (
        <p className={`flujoRama flujoRama-${rama.tipo}`}>
          {rama.tipo === "anulada" ? <XCircle size={13} aria-hidden /> : <CircleDashed size={13} aria-hidden />}
          <span>{rama.label}</span>
        </p>
      ) : null}
    </div>
  );
}
