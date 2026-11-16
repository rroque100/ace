"use client";

import { useRef, useState } from "react";
import { BookOpen, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContenidoClase } from "@/lib/cursos/tipos";

type Referencia = { texto: string; href: string | null };

// Pestañas Resumen | Base legal bajo el reproductor. Los enlaces a la norma llegan ya resueltos desde el servidor:
// `href` es null cuando la cuenta no puede abrir el lector de normas (un alumno sin Centro Jurídico), y entonces la
// referencia se muestra como texto en vez de como un enlace que acabaría en un rechazo.
export function PestanasClase({ contenido, referencias }: { contenido: ContenidoClase; referencias: Referencia[] }) {
  const [activa, setActiva] = useState<"resumen" | "base">("resumen");
  const lista = useRef<HTMLDivElement>(null);
  const pestanas = [
    { id: "resumen" as const, label: "Resumen", icono: BookOpen },
    { id: "base" as const, label: "Base legal", icono: Scale },
  ];

  return (
    <section className="rounded-2xl border border-line bg-panel shadow-card">
      <div
        ref={lista}
        role="tablist"
        aria-label="Contenido de la clase"
        className="flex gap-1 border-b border-line px-2 pt-2"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const i = pestanas.findIndex((p) => p.id === activa);
          const n = e.key === "Home" ? 0 : e.key === "End" ? pestanas.length - 1 : (i + 1) % pestanas.length;
          setActiva(pestanas[n].id);
          lista.current?.querySelectorAll<HTMLButtonElement>("button")[n]?.focus();
        }}
      >
        {pestanas.map(({ id, label, icono: Icono }) => (
          <button
            key={id}
            id={`pestana-${id}`}
            type="button"
            role="tab"
            aria-selected={activa === id}
            aria-controls={`panel-${id}`}
            tabIndex={activa === id ? 0 : -1}
            onClick={() => setActiva(id)}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold outline-none",
              "focus-visible:shadow-[var(--shadow-focus)]",
              activa === id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icono size={16} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div id="panel-resumen" role="tabpanel" aria-labelledby="pestana-resumen" hidden={activa !== "resumen"} className="p-5 sm:p-6">
        {!contenido.verificada && (
          <p className="mb-5 mt-0 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            Contenido en revisión: aún no se han contrastado todas sus cifras con la norma. Consulta la base legal antes de
            darlo por bueno.
          </p>
        )}
        <div className="space-y-6">
          {contenido.resumen.map((bloque) => (
            <div key={bloque.pregunta}>
              <h3 className="mb-2 mt-0 text-base font-semibold text-ink">{bloque.pregunta}</h3>
              {bloque.parrafos.map((p) => (
                <p key={p} className="mb-3 mt-0 text-[15px] leading-relaxed text-ink last:mb-0">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-7 rounded-xl bg-surface p-4">
          <h3 className="mb-3 mt-0 text-sm font-semibold uppercase tracking-wide text-brand">Para el examen</h3>
          <ul className="m-0 space-y-2 pl-5">
            {contenido.puntosClave.map((p) => (
              <li key={p} className="text-[15px] leading-relaxed text-ink">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div id="panel-base" role="tabpanel" aria-labelledby="pestana-base" hidden={activa !== "base"} className="p-5 sm:p-6">
        <p className="mb-4 mt-0 text-sm text-muted">
          Texto vigente de la Ley 32069 y de su Reglamento con el que se contrastó esta clase.
        </p>
        <ul className="m-0 list-none space-y-2 p-0">
          {referencias.map((r) => (
            <li key={r.texto}>
              {r.href ? (
                <a href={r.href} className="inline-flex min-h-11 items-center gap-2 font-medium text-brand underline">
                  <Scale size={16} aria-hidden />
                  {r.texto}
                </a>
              ) : (
                <span className="inline-flex min-h-11 items-center gap-2 text-ink">
                  <Scale size={16} aria-hidden className="text-muted" />
                  {r.texto}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
