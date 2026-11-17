"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban, BadgeCheck, Building2, ChevronLeft, ChevronRight, ClipboardList, Compass, Crown,
  FileSearch, FileText, FileWarning, Gavel, Landmark, ListChecks, Network, Pause, Play,
  RotateCcw, Scale, ShoppingBag, Stamp, User, UserCog, Users, Volume2, VolumeX,
  type LucideIcon,
} from "lucide-react";
import { buttonClasses } from "@/app/components/ui/button";
import type { EscenaVideo, FichaVideo } from "@/lib/cursos/videos";
import { cn } from "@/lib/utils";

// Iconos que el reproductor sabe pintar. Debe coincidir exactamente con ICONOS_VIDEO de lib/cursos/videos.ts
// (tests/cursos-videos.test.ts lo exige): el guion nombra iconos por su cadena y aquí se resuelven.
export const ICONOS_COMPONENTES: Record<string, LucideIcon> = {
  Landmark, Scale, ShoppingBag, Building2, Users, Crown, UserCog, User,
  Compass, Network, BadgeCheck, ClipboardList, FileSearch, FileWarning, FileText,
  Gavel, Stamp, Ban, ListChecks,
};

/** Sin voz disponible, cada escena dura lo mismo que una narración típica (9 s). */
const DURACION_SIN_VOZ = 9_000;

export function VideoAnimado({ escenas, modulo, titulo, minutos }: {
  escenas: readonly EscenaVideo[];
  modulo: string;
  titulo: string;
  minutos: number;
}) {
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [vozActiva, setVozActiva] = useState(true);
  const [montadas, setMontadas] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  const sintesis = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!sintesis) return;
    const leer = () => setVoces(sintesis.getVoices());
    leer();
    sintesis.addEventListener("voiceschanged", leer);
    return () => sintesis.removeEventListener("voiceschanged", leer);
  }, [sintesis]);

  // Voz en español: la peruana si está, si no una latinoamericana, si no cualquier «es».
  const vozEspañol = useMemo(() => {
    const es = voces.filter((v) => v.lang.toLowerCase().startsWith("es"));
    return (
      es.find((v) => v.lang.toLowerCase().startsWith("es-pe")) ??
      es.find((v) => ["es-419", "es-mx", "es-ar", "es-co", "es-us", "es-cl"].includes(v.lang.toLowerCase())) ??
      es[0] ??
      null
    );
  }, [voces]);

  const detener = useCallback(() => {
    sintesis?.cancel();
    if (temporizador.current !== undefined) {
      window.clearTimeout(temporizador.current);
      temporizador.current = undefined;
    }
  }, [sintesis]);

  // El corazón del video: mientras se reproduce, narra la escena actual y al terminar avanza sola.
  useEffect(() => {
    if (!reproduciendo) return;
    const escena = escenas[indice];
    const avanzar = () => {
      if (indice + 1 < escenas.length) {
        setMontadas(false);
        setIndice((i) => i + 1);
      } else setReproduciendo(false);
    };
    if (sintesis && vozActiva && escena) {
      const utterance = new SpeechSynthesisUtterance(escena.narracion);
      utterance.lang = "es-PE";
      if (vozEspañol) utterance.voice = vozEspañol;
      utterance.onend = avanzar;
      // Si la voz falla (sin voces instaladas, bloqueada por el sistema), la escena avanza con temporizador.
      utterance.onerror = () => {
        temporizador.current = window.setTimeout(avanzar, DURACION_SIN_VOZ);
      };
      sintesis.speak(utterance);
      return detener;
    }
    temporizador.current = window.setTimeout(avanzar, DURACION_SIN_VOZ);
    return detener;
  }, [reproduciendo, indice, vozActiva, vozEspañol, escenas, sintesis, detener]);

  // Entrada escalonada de las fichas: al cambiar de escena se ocultan (quien cambia la escena hace el reset)
  // y este efecto las revela en el siguiente fotograma; el retardo por ficha produce la cascada.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMontadas(true));
    return () => cancelAnimationFrame(raf);
  }, [indice]);

  useEffect(() => detener, [detener]);

  const escena = escenas[indice];
  const total = escenas.length;
  const irA = (destino: number) => {
    const destinoSeguro = Math.max(0, Math.min(total - 1, destino));
    if (destinoSeguro === indice) return;
    setMontadas(false);
    setIndice(destinoSeguro);
  };

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <div className="relative flex aspect-video flex-col justify-between bg-brand-soft p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Escena {indice + 1} de {total}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Módulo {modulo} · {minutos} min
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-3">
          <h3 className="m-0 text-center text-lg font-semibold text-ink sm:text-2xl">{escena.titulo}</h3>
          <div className="flex max-h-44 flex-wrap items-stretch justify-center gap-2 overflow-y-auto sm:gap-3">
            {escena.fichas.map((ficha, i) => (
              <FichaClave key={`${escena.titulo}-${ficha.nombre}`} ficha={ficha} montada={montadas} retraso={i * 130} />
            ))}
          </div>
        </div>

        <p className="m-0 text-center text-xs font-medium uppercase tracking-wide text-brand-dark">{escena.cinta}</p>
      </div>

      {/* Subtítulo: siempre visible, también sirve de transcripción cuando no hay voz. */}
      <p aria-live="polite" className="m-0 border-t border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink">
        {escena.narracion}
      </p>

      <div
        role="progressbar"
        aria-label={`Escena ${indice + 1} de ${total}`}
        aria-valuenow={indice + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        className="flex gap-1 px-5 pt-3"
      >
        {escenas.map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= indice ? "bg-brand" : "bg-line")} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <button
          type="button"
          className={cn(buttonClasses({ variant: "primary" }))}
          onClick={() => {
            if (reproduciendo) {
              detener();
              setReproduciendo(false);
            } else setReproduciendo(true);
          }}
        >
          {reproduciendo ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> {indice === total - 1 ? "Reproducir de nuevo" : "Reproducir"}</>}
        </button>
        <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={indice === 0} onClick={() => irA(indice - 1)}>
          <ChevronLeft size={16} aria-hidden /> <span className="sr-only">Escena anterior: </span>Anterior
        </button>
        <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={indice === total - 1} onClick={() => irA(indice + 1)}>
          Siguiente<ChevronRight size={16} aria-hidden />
        </button>
        <button
          type="button"
          className={buttonClasses({ variant: "secondary" })}
          onClick={() => {
            detener();
            irA(0);
            setReproduciendo(true);
          }}
        >
          <RotateCcw size={16} aria-hidden /> Reiniciar
        </button>
        {sintesis && (
          <button
            type="button"
            className={buttonClasses({ variant: "secondary" })}
            aria-pressed={!vozActiva}
            onClick={() => setVozActiva((v) => !v)}
          >
            {vozActiva ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
            Voz {vozActiva ? "activada" : "silenciada"}
          </button>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={titulo}>
          {sintesis ? "El audio usa la voz del navegador; los subtítulos acompañan cada escena." : "Tu navegador no ofrece voz: las escenas avanzan solas con el texto."}
        </span>
      </div>
    </figure>
  );
}

function FichaClave({ ficha, montada, retraso }: { ficha: FichaVideo; montada: boolean; retraso: number }) {
  const Icono = ICONOS_COMPONENTES[ficha.icono] ?? Users;
  return (
    <div
      style={{ transitionDelay: `${retraso}ms` }}
      className={cn(
        "flex w-28 flex-col items-center gap-1.5 rounded-xl border border-line bg-panel p-3 text-center transition-all duration-500 motion-reduce:transition-none sm:w-36 sm:gap-2 sm:p-4",
        montada ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-on-brand sm:size-10">
        <Icono size={20} aria-hidden />
      </span>
      <span className="text-xs font-semibold leading-tight text-ink sm:text-sm">{ficha.nombre}</span>
      <span className="text-[11px] leading-snug text-muted sm:text-xs">{ficha.rol}</span>
    </div>
  );
}
