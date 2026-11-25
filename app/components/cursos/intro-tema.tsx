// Tarjeta de introducción de la clase: sustituye la maqueta del reproductor cuando la clase no tiene
// video animado. Lee el contenido existente (resumen, temas del examen) y lo presenta como una portada
// útil: qué preguntas responde la clase, cuánto pesa y cuánto tiempo lleva. No simula un reproductor.
//
// "use client" solo por el scroll suave al resumen; todo lo demás es pintar datos.

"use client";

import { ArrowDown, Clock, GraduationCap, Target } from "lucide-react";
import type { ContenidoClase } from "@/lib/cursos/tipos";
import type { TemaExamen } from "@/lib/cursos/temario-examen";
import { buttonClasses } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export function IntroTema({ modulo, titulo, minutos, contenido, temas }: {
  modulo: string;
  titulo: string;
  minutos: number;
  contenido: ContenidoClase;
  temas: readonly TemaExamen[];
}) {
  const preguntas = contenido.resumen.map((b) => b.pregunta);
  const casos = contenido.casuisticas?.length ?? 0;

  function irAlResumen() {
    document.getElementById("pestana-resumen")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <div className="relative flex aspect-video flex-col justify-between overflow-hidden bg-brand-soft p-6 sm:p-8">
        {/* Mismos focos suaves del video: ambiente sin simular reproducción. */}
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-panel/40 blur-3xl motion-reduce:hidden sm:size-64" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 size-56 rounded-full bg-panel/30 blur-3xl motion-reduce:hidden sm:size-72" />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            <GraduationCap size={14} aria-hidden /> Módulo {modulo}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            <Clock size={14} aria-hidden /> ≈{minutos} min de estudio
          </span>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4">
          <h3 className="m-0 text-center text-xl font-semibold text-ink sm:text-2xl">{titulo}</h3>
          {temas.length > 0 && (
            <p className="m-0 inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-sm text-brand-dark">
              <Target size={15} aria-hidden /> Tema {temas[0].code} · {temas[0].label} · {temas[0].quota} pregunta{temas[0].quota > 1 ? "s" : ""} del examen
            </p>
          )}
          {preguntas.length > 0 && (
            <ul className="m-0 mt-1 list-none space-y-1.5 p-0 text-center">
              {preguntas.slice(0, 3).map((p, i) => (
                <li key={p} className="flex items-center justify-center gap-2 text-sm text-muted">
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full bg-panel text-[10px] font-bold text-brand", i === 0 && "animate-pulse")}>
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
              {preguntas.length > 3 && (
                <li className="text-xs text-muted">… y {preguntas.length - 3} más</li>
              )}
            </ul>
          )}
        </div>

        <div className="relative flex items-center justify-center gap-2">
          <button type="button" className={buttonClasses({ variant: "primary" })} onClick={irAlResumen}>
            Estudiar el resumen <ArrowDown size={16} aria-hidden />
          </button>
          {casos > 0 && (
            <span className="text-xs font-medium text-muted">
              Con {casos} casos tipo examen
            </span>
          )}
        </div>
      </div>
    </figure>
  );
}
