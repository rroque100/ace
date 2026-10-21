"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Info } from "lucide-react";
import type { LiteralExpediente } from "@/lib/expediente-contenido";
import type { NivelControl, TarjetaControl } from "@/lib/torre-control";
import { cuantasBloquean } from "@/lib/torre-control";
import { hitoLabel } from "@/lib/procurement-fases";

const ICONO: Record<NivelControl, typeof Info> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  stop: AlertTriangle,
  mute: CircleDashed,
};

// Fondo/borde de la tarjeta y color de su etiqueta según el nivel. Mapa JS (no
// variantes data-[...]) para pintar los `color-mix` y colorear la etiqueta/valor
// sin depender de selectores descendientes con clase.
const CARD_TONO: Record<NivelControl, string> = {
  stop: "bg-[color-mix(in_srgb,var(--danger)_7%,var(--panel))] border-[color-mix(in_srgb,var(--danger)_40%,var(--line))]",
  warn: "bg-[color-mix(in_srgb,var(--warning)_8%,var(--panel))] border-[color-mix(in_srgb,var(--warning)_38%,var(--line))]",
  ok: "",
  mute: "bg-surface",
};
const LABEL_TONO: Record<NivelControl, string> = {
  stop: "text-danger",
  warn: "text-warning",
  ok: "text-success",
  mute: "text-muted",
};

const PILL = "rounded-full px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap";
const IR = "self-start cursor-pointer p-0 !text-[11.5px] !font-semibold text-brand underline focus-visible:rounded-[3px] focus-visible:shadow-[var(--focus)] focus-visible:outline-none";

/**
 * Estado del expediente, antes de las diez fases.
 *
 * Al abrir un expediente lo primero que aparecía era el paso 1. Pero ninguna de
 * las contradicciones reales vive dentro de UN paso: el valor estimado lo fija
 * A5, la línea de corte la usa A2, la certificación la comprueba A7 y la fecha
 * requerida vive en la Necesidad. Cada paso estaba "correcto" por separado y el
 * expediente entero no.
 *
 * Son tarjetas y no una lista de avisos porque cada una es una PAREJA de datos
 * que se contradicen, y hay que ver los dos juntos: "S/ 285,924 frente a
 * S/ 90,000" se entiende sin leer.
 */
export function TorreControl({
  tarjetas,
  faltan,
  onAbrirPaso,
}: {
  tarjetas: TarjetaControl[];
  /**
   * Literales del Art. 54.2 aún incumplidos para aprobar el expediente (A8).
   * Antes solo se veían al abrir A8; subirlos aquí muestra desde arriba qué
   * pasos completar y por qué, sin cazar el dato dentro del último paso.
   */
  faltan?: LiteralExpediente[];
  /** Abre el paso que resuelve la tarjeta. */
  onAbrirPaso?: (code: string) => void;
}) {
  const bloquean = cuantasBloquean(tarjetas);
  const pendientes = faltan ?? [];

  return (
    <section aria-label="Estado del expediente" className="mb-4 grid gap-3 rounded-[10px] border border-line bg-panel p-3.5">
      <header className="flex flex-wrap items-center justify-between gap-2 [&>h3]:m-0 [&>h3]:!text-[14px]">
        <h3>Estado del expediente</h3>
        {bloquean > 0 ? (
          <span className={`${PILL} bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-danger`}>
            {bloquean === 1 ? "1 cosa bloquea" : `${bloquean} cosas bloquean`}
          </span>
        ) : (
          <span className={`${PILL} bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-success`}>Sin contradicciones</span>
        )}
      </header>

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {tarjetas.map((t) => {
          const Icono = ICONO[t.nivel];
          return (
            <article className={`flex flex-col gap-1.5 rounded-[8px] border px-3 py-[11px] ${CARD_TONO[t.nivel]}`} key={t.clave}>
              <p className={`m-0 flex items-center gap-[5px] text-[10.5px] uppercase tracking-[0.06em] ${LABEL_TONO[t.nivel]}`}>
                <Icono size={12} /> {t.etiqueta}
              </p>
              <p className={`m-0 text-[18px] font-[650] tracking-[-0.02em] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere] ${t.nivel === "stop" ? "text-danger" : ""}`}>{t.valor}</p>
              <p className="m-0 text-[11.5px] leading-[1.45] text-muted">{t.nota}</p>
              {/* Solo hay botón si hay algo que resolver: en una tarjeta
                  conforme sería una invitación a tocar lo que ya está bien. */}
              {t.paso && onAbrirPaso && (t.nivel === "stop" || t.nivel === "warn") ? (
                <button className={IR} onClick={() => onAbrirPaso(t.paso!)} type="button">
                  Ir a {hitoLabel(t.paso)}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* Qué falta para aprobar el expediente (Art. 54.2). Si no falta nada, no
          se pinta: la píldora "Sin contradicciones" ya lo dice. */}
      {pendientes.length > 0 ? (
        <div className="mt-3 border-t border-line pt-2.5">
          <p className="m-0 mb-1.5 flex items-center gap-[5px] text-[11.5px] font-bold uppercase tracking-[0.02em] text-muted">
            <AlertTriangle size={12} /> Para aprobar el expediente falta (Art. 54.2):
          </p>
          <ul className="m-0 grid list-none gap-[5px] p-0">
            {pendientes.map((f) => (
              // El 54.2.c real agrupa DOS logros verificables por separado
              // (estrategia + interacción con el mercado, ver
              // lib/expediente-contenido.ts) — mismo `literal` a propósito,
              // así que la key no puede ser solo el literal (mismo patrón
              // defensivo que ya usa fase-panel.tsx).
              <li className="flex items-baseline justify-between gap-2.5 text-[12.5px]" key={`${f.literal}-${f.etiqueta}`}>
                <span>
                  <strong>{f.literal}</strong> · {f.etiqueta}
                  {f.detalle ? <span className="text-muted"> — {f.detalle}</span> : null}
                </span>
                {f.paso && onAbrirPaso ? (
                  <button
                    className={IR}
                    onClick={() => onAbrirPaso(f.paso!)}
                    type="button"
                  >
                    Ir a {hitoLabel(f.paso)}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
