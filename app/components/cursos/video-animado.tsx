"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban, BadgeCheck, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Compass, Crown,
  FileSearch, FileText, FileWarning, Gavel, Landmark, ListChecks, Network, Pause, Play,
  RotateCcw, Scale, ShoppingBag, Stamp, User, UserCog, Users, Volume2, VolumeX, XCircle,
  type LucideIcon,
} from "lucide-react";
import { buttonClasses } from "@/app/components/ui/button";
import { esQuiz, type EscenaVideo, type FichaVideo } from "@/lib/cursos/videos";
import { cn } from "@/lib/utils";

// Iconos que el reproductor sabe pintar. Debe coincidir exactamente con ICONOS_VIDEO de lib/cursos/videos.ts
// (tests/cursos-videos.test.ts lo exige): el guion nombra iconos por su cadena y aquí se resuelven.
export const ICONOS_COMPONENTES: Record<string, LucideIcon> = {
  Landmark, Scale, ShoppingBag, Building2, Users, Crown, UserCog, User,
  Compass, Network, BadgeCheck, ClipboardList, FileSearch, FileWarning, FileText,
  Gavel, Stamp, Ban, ListChecks,
};

/** Velocidades de narración disponibles, en orden. */
const VELOCIDADES: readonly number[] = [0.75, 1, 1.25, 1.5];
/** Pausa media por carácter hablado a velocidad normal (~15 caracteres por segundo). */
const MS_POR_CARACTER = 66;

export function VideoAnimado({ escenas, modulo, titulo, minutos }: {
  escenas: readonly EscenaVideo[];
  modulo: string;
  titulo: string;
  minutos: number;
}) {
  const [escena, setEscena] = useState(0);
  const [segmento, setSegmento] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [volumen, setVolumen] = useState(100);
  const [vozActiva, setVozActiva] = useState(true);
  const [respuesta, setRespuesta] = useState<number | null>(null);
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

  // La voz más natural disponible en español: peruana → latinoamericana → cualquier «es»; dentro de cada
  // grupo, las voces «Natural»/«Online» del navegador suenan mucho mejor que las sintéticas locales.
  const vozEspañol = useMemo(() => {
    const es = voces.filter((v) => v.lang.toLowerCase().startsWith("es"));
    const grupos = [
      (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith("es-pe"),
      (v: SpeechSynthesisVoice) => ["es-419", "es-mx", "es-ar", "es-co", "es-us", "es-cl"].includes(v.lang.toLowerCase()),
      () => true,
    ];
    for (const grupo of grupos) {
      const naturales = es.filter(grupo).filter((v) => /natural|online/i.test(v.name));
      if (naturales.length) return naturales[0];
      const cualquiera = es.filter(grupo);
      if (cualquiera.length) return cualquiera[0];
    }
    return null;
  }, [voces]);

  const detener = useCallback(() => {
    sintesis?.cancel();
    if (temporizador.current !== undefined) {
      window.clearTimeout(temporizador.current);
      temporizador.current = undefined;
    }
  }, [sintesis]);

  const total = escenas.length;
  const actual = escenas[escena];
  const esContenido = !esQuiz(actual);

  /** Salta a una escena (y a su primer segmento), reseteando la comprobación si la tiene. */
  const irA = useCallback((destino: number) => {
    const seguro = Math.max(0, Math.min(total - 1, destino));
    setRespuesta(null);
    setSegmento(0);
    setEscena(seguro);
  }, [total]);

  /** Avanza al siguiente segmento, o a la siguiente escena cuando termina la actual. */
  const avanzar = useCallback(() => {
    if (esContenido && segmento + 1 < actual.guion.length) {
      setSegmento((s) => s + 1);
      return;
    }
    if (escena + 1 < total) irA(escena + 1);
    else setReproduciendo(false);
  }, [esContenido, segmento, actual, escena, total, irA]);

  // ── Motor de narración ──────────────────────────────────────────────────────
  // Cada vuelta del efecto narra exactamente lo que toca: el segmento actual de la escena de contenido,
  // o la pregunta/aclaración de la comprobación. Pausar cancela; reanudar repite el segmento en curso.
  useEffect(() => {
    if (!reproduciendo) return;
    let texto: string;
    if (esQuiz(actual)) {
      if (respuesta === null) texto = actual.pregunta;
      else texto = `${actual.opciones[respuesta].correcta ? "¡Muy bien!" : "Mmm, no."} ${actual.aclaracion}`;
    } else {
      texto = actual.guion[segmento].texto;
    }
    const habla = sintesis && vozActiva;
    if (habla) {
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-PE";
      utterance.rate = velocidad;
      utterance.volume = volumen / 100;
      if (vozEspañol) utterance.voice = vozEspañol;
      utterance.onend = () => {
        // La comprobación sin responder no avanza sola: espera el clic del alumno.
        if (esQuiz(actual) && respuesta === null) return;
        avanzar();
      };
      // Si la voz falla (sin voces instaladas, bloqueada), el segmento avanza con temporizador.
      utterance.onerror = () => {
        temporizador.current = window.setTimeout(() => {
          if (esQuiz(actual) && respuesta === null) return;
          avanzar();
        }, duracionEstimada(texto, velocidad));
      };
      sintesis.speak(utterance);
      return detener;
    }
    // Sin voz (apagada o no disponible): la pregunta espera el clic; el resto avanza por tiempo.
    if (esQuiz(actual) && respuesta === null) return;
    temporizador.current = window.setTimeout(avanzar, duracionEstimada(texto, velocidad));
    return detener;
  }, [reproduciendo, escena, segmento, respuesta, velocidad, volumen, vozActiva, vozEspañol, actual, sintesis, detener, avanzar]);

  // Reanudar la comprobación ya respondida: el efecto de arriba no reacciona a `respuesta` cuando la voz
  // está apagada, así que el temporizador de la aclaración se programa al responder.
  useEffect(() => {
    if (!esQuiz(actual) || respuesta === null || !reproduciendo) return;
    if (sintesis && vozActiva) return;
    temporizador.current = window.setTimeout(() => avanzar(), duracionEstimada(actual.aclaracion, velocidad));
    return detener;
  }, [respuesta, actual, reproduciendo, sintesis, vozActiva, velocidad, avanzar, detener]);

  // Entrada escalonada de fichas: al cambiar de escena se ocultan (quien cambia la escena hace el reset)
  // y este efecto las revela en el siguiente fotograma; el retardo por ficha produce la cascada.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMontadas(true));
    return () => cancelAnimationFrame(raf);
  }, [escena]);

  useEffect(() => detener, [detener]);

  // Atajos de teclado: espacio reproduce o pausa, las flechas cambian de escena.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && ["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        alternarReproduccion();
      } else if (e.code === "ArrowLeft") irA(escena - 1);
      else if (e.code === "ArrowRight") irA(escena + 1);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena, reproduciendo, detener]);

  function alternarReproduccion() {
    if (reproduciendo) {
      detener();
      setReproduciendo(false);
    } else setReproduciendo(true);
  }

  /** Clic en una ficha: el narrador repite su fragmento desde el principio. */
  function escucharFicha(indiceFicha: number) {
    if (!esContenido) return;
    const destino = actual.guion.findIndex((s) => s.ficha === indiceFicha);
    if (destino < 0) return;
    setSegmento(destino);
    setReproduciendo(true);
  }

  const fichaActiva = esContenido ? actual.guion[segmento]?.ficha : undefined;
  const subtitulado = esQuiz(actual)
    ? respuesta === null
      ? actual.pregunta
      : actual.aclaracion
    : actual.guion[segmento].texto;
  const alPulsarOpcion = (indice: number) => {
    if (respuesta !== null) return;
    setRespuesta(indice);
  };

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <div className="relative flex aspect-video flex-col justify-between overflow-hidden bg-brand-soft p-5 sm:p-7">
        {/* Ambiente sutil: dos focos que respiran detrás del escenario. */}
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-panel/40 blur-3xl motion-reduce:hidden sm:size-64" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 size-56 rounded-full bg-panel/30 blur-3xl motion-reduce:hidden sm:size-72" />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Escena {escena + 1} de {total}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Módulo {modulo} · {minutos} min
          </span>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 py-3">
          <h3 className="m-0 text-center text-lg font-semibold text-ink sm:text-2xl">{actual.titulo}</h3>

          {esContenido ? (
            <div className="flex max-h-44 flex-wrap items-stretch justify-center gap-2 overflow-y-auto sm:gap-3">
              {actual.fichas.map((ficha, i) => (
                <FichaClave
                  key={`${actual.titulo}-${ficha.nombre}`}
                  ficha={ficha}
                  montada={montadas}
                  activa={fichaActiva === i}
                  retraso={i * 130}
                  onClick={() => escucharFicha(i)}
                />
              ))}
            </div>
          ) : (
            <div className="flex w-full max-w-lg flex-col gap-2">
              {actual.opciones.map((opcion, i) => (
                <OpcionClave
                  key={opcion.texto}
                  texto={opcion.texto}
                  indice={i}
                  montada={montadas}
                  respondida={respuesta !== null}
                  elegida={respuesta === i}
                  correcta={opcion.correcta}
                  retraso={i * 130}
                  onElegir={() => alPulsarOpcion(i)}
                />
              ))}
              {respuesta !== null && (
                <p className={cn("m-0 rounded-xl px-4 py-2 text-sm font-medium", actual.opciones[respuesta].correcta ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                  {actual.opciones[respuesta].correcta ? "Correcto." : "La correcta es otra: mira la explicación."}
                </p>
              )}
            </div>
          )}
        </div>

        <p className="relative m-0 text-center text-xs font-medium uppercase tracking-wide text-brand-dark">{actual.cinta}</p>
      </div>

      {/* Subtítulo del fragmento en curso, también transcripción cuando no hay voz. */}
      <p aria-live="polite" className="m-0 border-t border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink">
        {subtitulado}
      </p>

      {/* Progreso: una barra por escena, clicable para saltar. */}
      <div className="flex gap-1 px-5 pt-3" role="group" aria-label="Ir a una escena">
        {escenas.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir a la escena ${i + 1}: ${escenas[i].titulo}`}
            aria-current={i === escena}
            onClick={() => irA(i)}
            className={cn(
              "h-1.5 flex-1 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:shadow-[var(--shadow-focus)]",
              i === escena ? "bg-brand" : i < escena ? "bg-brand/50" : "bg-line",
            )}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <button type="button" className={buttonClasses({ variant: "primary" })} onClick={alternarReproduccion}>
          {reproduciendo ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> {escena === total - 1 ? "Reproducir" : "Reproducir"}</>}
        </button>
        <button
          type="button"
          className={buttonClasses({ variant: "secondary" })}
          onClick={() => setVelocidad((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length])}
          aria-label={`Velocidad de la voz: ${velocidad} veces. Pulsa para cambiarla.`}
        >
          {velocidad}×
        </button>
        <span className="inline-flex items-center gap-2">
          <Volume2 size={16} aria-hidden className="shrink-0 text-muted" />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumen}
            onChange={(e) => setVolumen(Number(e.target.value))}
            aria-label="Volumen de la voz"
            className="h-1.5 w-24 cursor-pointer accent-brand"
          />
        </span>
        {sintesis && (
          <button
            type="button"
            className={buttonClasses({ variant: "secondary" })}
            aria-pressed={!vozActiva}
            onClick={() => setVozActiva((v) => !v)}
          >
            {vozActiva ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
            <span className="sr-only">Voz </span>{vozActiva ? "activada" : "silenciada"}
          </button>
        )}
        <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={escena === 0} onClick={() => irA(escena - 1)}>
          <ChevronLeft size={16} aria-hidden /> <span className="sr-only">Escena anterior: </span>Anterior
        </button>
        <button type="button" className={buttonClasses({ variant: "secondary" })} disabled={escena === total - 1} onClick={() => irA(escena + 1)}>
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
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={titulo}>
          {sintesis
            ? "Voz del navegador, velocidad y volumen a tu gusto. Clic en una tarjeta para volver a escucharla; espacio pausa."
            : "Tu navegador no ofrece voz: las escenas avanzan solas con el texto."}
        </span>
      </div>
    </figure>
  );
}

/** Duración aproximada de un fragmento sin voz: caracteres por segundo, ajustada por la velocidad. */
function duracionEstimada(texto: string, velocidad: number) {
  return Math.max(1600, Math.min(12_000, (texto.length * MS_POR_CARACTER) / velocidad));
}

function FichaClave({ ficha, montada, activa, retraso, onClick }: {
  ficha: FichaVideo;
  montada: boolean;
  activa: boolean;
  retraso: number;
  onClick: () => void;
}) {
  const Icono = ICONOS_COMPONENTES[ficha.icono] ?? Users;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Escuchar de nuevo: ${ficha.nombre}`}
      style={{ transitionDelay: `${retraso}ms` }}
      className={cn(
        "flex w-28 cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center outline-none transition-all duration-500",
        "focus-visible:shadow-[var(--shadow-focus)] motion-reduce:transition-none sm:w-36 sm:gap-2 sm:p-4",
        montada ? "translate-y-0 rotate-0 scale-100 opacity-100" : "translate-y-4 -rotate-2 scale-90 opacity-0",
        activa ? "border-brand bg-brand-soft/60 shadow-card ring-1 ring-brand" : "border-line bg-panel",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 sm:size-10", activa ? "scale-110 bg-brand text-on-brand" : "bg-brand text-on-brand")}>
        <Icono size={20} aria-hidden />
      </span>
      <span className="text-xs font-semibold leading-tight text-ink sm:text-sm">{ficha.nombre}</span>
      <span className="text-[11px] leading-snug text-muted sm:text-xs">{ficha.rol}</span>
    </button>
  );
}

function OpcionClave({ texto, indice, montada, respondida, elegida, correcta, retraso, onElegir }: {
  texto: string;
  indice: number;
  montada: boolean;
  respondida: boolean;
  elegida: boolean;
  correcta: boolean;
  retraso: number;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      disabled={respondida}
      aria-label={`Opción ${indice + 1}: ${texto}`}
      style={{ transitionDelay: `${retraso}ms` }}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm outline-none transition-all duration-500",
        "focus-visible:shadow-[var(--shadow-focus)] motion-reduce:transition-none",
        montada ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        respondida
          ? correcta
            ? "border-success bg-success-soft text-ink"
            : elegida
              ? "border-danger bg-danger-soft text-ink"
              : "border-line bg-panel opacity-60"
          : "cursor-pointer border-line bg-panel text-ink hover:border-brand",
      )}
    >
      {respondida && (correcta ? <CheckCircle2 size={18} aria-hidden className="shrink-0 text-success" /> : elegida ? <XCircle size={18} aria-hidden className="shrink-0 text-danger" /> : null)}
      <span className="min-w-0 flex-1">{texto}</span>
    </button>
  );
}
