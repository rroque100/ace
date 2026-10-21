"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { TarjetaCoherencia } from "@/lib/necesidad-coherencia";

/**
 * Torre de coherencia de la Necesidad (adaptada de la torre de control del
 * expediente). Muestra las CONTRADICCIONES cruzadas —parejas de datos que no
 * cuadran entre sí— que la verificación "¿está lista?" no ve por mirar cada campo
 * por separado. Cada tarjeta lleva al campo que la resuelve.
 *
 * Si no hay contradicciones no desaparece: un "sin contradicciones" tranquiliza
 * tanto como una alerta avisa.
 */
export function CoherenciaNecesidad({
  tarjetas,
  onIrACampo,
}: {
  tarjetas: TarjetaCoherencia[];
  onIrACampo?: (api: string) => void;
}) {
  const bloquean = tarjetas.filter((t) => t.nivel === "stop").length;
  const hay = tarjetas.length > 0;

  return (
    <section aria-label="Coherencia del requerimiento" className="cohNec">
      <header className="cohNecHead">
        <ShieldAlert size={15} aria-hidden />
        <h3 className="panelTitle">Coherencia del requerimiento</h3>
        {hay ? (
          <span className="cohNecPill" data-stop={bloquean > 0 ? "true" : undefined}>
            {tarjetas.length === 1 ? "1 cosa que revisar" : `${tarjetas.length} cosas que revisar`}
          </span>
        ) : (
          <span className="cohNecPill cohNecPillOk">
            <CheckCircle2 size={12} aria-hidden /> Sin contradicciones
          </span>
        )}
      </header>

      {hay ? (
        <div className="cohNecGrid">
          {tarjetas.map((t) => (
            <article className={`cohNecCard cohNecCard-${t.nivel}`} key={t.clave}>
              <p className="cohNecLabel">
                <AlertTriangle size={12} aria-hidden /> {t.etiqueta}
              </p>
              <p className="cohNecValor">{t.valor}</p>
              <p className="cohNecNota">{t.nota}</p>
              {onIrACampo ? (
                <button className="cohNecIr" onClick={() => onIrACampo(t.campo)} type="button">
                  Ir al campo
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
