"use client";

import { useState } from "react";
import {
  Captions, Maximize, PictureInPicture2, Play, SkipForward, Video, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// MAQUETA del reproductor, mientras no haya vídeos propios de las clases. Reproduce la disposición de un reproductor de
// curso (portada, botón central, barra de progreso y controles) para validar el diseño de la página, pero no simula una
// reproducción: al pulsar «play» explica que el vídeo está en preparación y remite al resumen. Los controles van
// deshabilitados y lo dicen, para que nadie crea que falla.
//
// Cuando una clase tenga `video` en el catálogo, la página pinta el iframe real en lugar de esto.
export function ReproductorMaqueta({ modulo, titulo, minutos }: { modulo: string; titulo: string; minutos: number }) {
  const [aviso, setAviso] = useState(false);
  const duracion = `${minutos}:00`;
  const control = "inline-flex size-9 items-center justify-center rounded-lg text-muted disabled:cursor-not-allowed";
  const sinVideo = "Disponible cuando se publique el vídeo de la clase";

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <div className="relative flex aspect-video flex-col justify-between bg-brand-soft p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            <Video size={14} aria-hidden /> Vista previa del reproductor
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAviso(true)}
          aria-describedby={aviso ? "aviso-video" : undefined}
          className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-on-brand shadow-card outline-none transition-transform hover:scale-105 focus-visible:shadow-[var(--shadow-focus)] sm:size-20"
        >
          <Play size={30} aria-hidden className="translate-x-0.5" fill="currentColor" />
          <span className="sr-only">Reproducir el vídeo de la clase</span>
        </button>

        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-brand">Módulo {modulo}</p>
          <p className="mb-0 mt-1 max-w-xl text-xl font-semibold leading-tight text-ink sm:text-2xl">{titulo}</p>
        </div>

        {aviso && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/90 p-6">
            <p id="aviso-video" role="status" className="m-0 max-w-sm text-center text-[15px] leading-relaxed text-ink">
              <span className="mb-1 block font-semibold">El vídeo de esta clase está en preparación.</span>
              Mientras tanto, estudia el resumen y la base legal, que tienen el mismo contenido.
              <button
                type="button"
                onClick={() => setAviso(false)}
                className="mt-3 block w-full rounded-xl px-3 py-2 text-sm font-semibold text-brand outline-none hover:bg-brand-soft focus-visible:shadow-[var(--shadow-focus)]"
              >
                Entendido
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Barra de controles: solo maqueta, sin comportamiento. */}
      <figcaption className="border-t border-line px-2 pb-2 pt-1 sm:px-3">
        <div className="mx-1 my-2 h-1 overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full w-0 rounded-full bg-brand" />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={control} onClick={() => setAviso(true)} aria-label="Reproducir">
            <Play size={18} aria-hidden />
          </button>
          <button type="button" className={control} disabled title={sinVideo} aria-label="Saltar 10 segundos (no disponible)">
            <SkipForward size={18} aria-hidden />
          </button>
          <span className="px-2 text-xs tabular-nums text-muted">0:00 / {duracion}</span>
          <span className="flex-1" />
          <button type="button" className={cn(control, "hidden sm:inline-flex")} disabled title={sinVideo} aria-label="Volumen (no disponible)">
            <Volume2 size={18} aria-hidden />
          </button>
          <button type="button" className={control} disabled title={sinVideo} aria-label="Subtítulos (no disponible)">
            <Captions size={18} aria-hidden />
          </button>
          <span className="hidden px-1 text-xs font-semibold text-muted sm:inline" aria-hidden>
            1x
          </span>
          <button type="button" className={cn(control, "hidden sm:inline-flex")} disabled title={sinVideo} aria-label="Imagen en imagen (no disponible)">
            <PictureInPicture2 size={18} aria-hidden />
          </button>
          <button type="button" className={control} disabled title={sinVideo} aria-label="Pantalla completa (no disponible)">
            <Maximize size={18} aria-hidden />
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
