"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { TarjetaCoherencia } from "@/lib/necesidad-coherencia";
import { S } from "./coherencia-necesidad-estilos";
import { C } from "@/app/components/estilos-comunes";

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
    <section aria-label="Coherencia del requerimiento" className={S.cohNec}>
      <header className={S.cohNecHead}>
        <ShieldAlert size={15} aria-hidden />
        <h3 className={C.panelTitle}>Coherencia del requerimiento</h3>
        {hay ? (
          <span className={S.cohNecPill} data-stop={bloquean > 0 ? "true" : undefined}>
            {tarjetas.length === 1 ? "1 cosa que revisar" : `${tarjetas.length} cosas que revisar`}
          </span>
        ) : (
          <span className={S.cohNecPill_cohNecPillOk}>
            <CheckCircle2 size={12} aria-hidden /> Sin contradicciones
          </span>
        )}
      </header>

      {hay ? (
        <div className={S.cohNecGrid}>
          {tarjetas.map((t) => (
            <article className={t.nivel === "stop" ? S["cohNecCard_cohNecCard-stop"] : S.cohNecCard} key={t.clave}>
              <p className={S.cohNecLabel}>
                <AlertTriangle size={12} aria-hidden /> {t.etiqueta}
              </p>
              <p className={S.cohNecValor}>{t.valor}</p>
              <p className={S.cohNecNota}>{t.nota}</p>
              {onIrACampo ? (
                <button className={S.cohNecIr} onClick={() => onIrACampo(t.campo)} type="button">
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
