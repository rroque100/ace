"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban, BadgeCheck, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Compass, Crown,
  FileSearch, FileText, FileWarning, Gavel, Landmark, ListChecks, Network, Pause, Play,
  RotateCcw, Scale, ShoppingBag, Sparkles, Stamp, User, UserCog, Users, Volume2, VolumeX, XCircle,
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

// ── Sonidos sintetizados con Web Audio API: sin archivos, sin dependencias ────
type Ctx = AudioContext;

function crearContexto(): Ctx | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

function tono(ctx: Ctx, frecuencia: number, duracion: number, tipo: OscillatorType = "sine", volumen = 0.06) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volumen, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);
  osc.start();
  osc.stop(ctx.currentTime + duracion);
}

function sonarFicha(ctx: Ctx, indice: number) {
  // Nota ascendente por ficha: la primera suena más grave, la última más aguda.
  tono(ctx, 440 + indice * 60, 0.12, "sine", 0.05);
}
function sonarAcierto(ctx: Ctx) {
  tono(ctx, 523, 0.12, "sine", 0.07); // C5
  setTimeout(() => tono(ctx, 784, 0.15, "sine", 0.07), 110); // G5
}
function sonarFallo(ctx: Ctx) {
  tono(ctx, 220, 0.2, "square", 0.04);
}
function sonarEscena(ctx: Ctx) {
  tono(ctx, 320, 0.1, "triangle", 0.03);
}
function sonarClic(ctx: Ctx) {
  tono(ctx, 660, 0.06, "sine", 0.04);
}

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
  const [sonidos, setSonidos] = useState(true);
  const [respuesta, setRespuesta] = useState<number | null>(null);
  const [montadas, setMontadas] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);
  const audioRef = useRef<Ctx | null>(null);

  const sintesis = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!sintesis) return;
    const leer = () => setVoces(sintesis.getVoices());
    leer();
    sintesis.addEventListener("voiceschanged", leer);
    return () => sintesis.removeEventListener("voiceschanged", leer);
  }, [sintesis]);

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

  const reproducirSonido = useCallback((fn: (ctx: Ctx) => void) => {
    if (!sonidos) return;
    if (!audioRef.current) audioRef.current = crearContexto();
    if (audioRef.current) {
      if (audioRef.current.state === "suspended") void audioRef.current.resume();
      fn(audioRef.current);
    }
  }, [sonidos]);

  const total = escenas.length;
  const actual = escenas[escena];
  const esContenido = !esQuiz(actual);
  const fichaActiva = esContenido ? actual.guion[Math.min(segmento, actual.guion.length - 1)]?.ficha : undefined;
  const fichasConectadas = useMemo(() => {
    if (!esContenido || fichaActiva === undefined) return new Set<number>();
    const ficha = actual.fichas[fichaActiva];
    return new Set(ficha?.conecta ?? []);
  }, [esContenido, actual, fichaActiva]);

  const irA = useCallback((destino: number) => {
    const seguro = Math.max(0, Math.min(total - 1, destino));
    setRespuesta(null);
    setSegmento(0);
    setEscena(seguro);
    reproducirSonido(sonarEscena);
  }, [total, reproducirSonido]);

  const avanzar = useCallback(() => {
    if (esContenido && segmento + 1 < actual.guion.length) {
      const proximo = actual.guion[segmento + 1];
      if (proximo?.ficha !== undefined) reproducirSonido((ctx) => sonarFicha(ctx, proximo.ficha!));
      setSegmento((s) => s + 1);
      return;
    }
    if (escena + 1 < total) irA(escena + 1);
    else setReproduciendo(false);
  }, [esContenido, segmento, actual, escena, total, irA, reproducirSonido]);

  // ── Motor de narración ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!reproduciendo) return;
    let texto: string;
    if (esQuiz(actual)) {
      if (respuesta === null) texto = actual.pregunta;
      else texto = `${actual.opciones[respuesta].correcta ? "¡Muy bien!" : "Mmm, no."} ${actual.aclaracion}`;
    } else {
      const segmentoSeguro = Math.min(segmento, actual.guion.length - 1);
      texto = actual.guion[segmentoSeguro].texto;
    }
    const habla = sintesis && vozActiva;
    if (habla) {
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-PE";
      utterance.rate = velocidad;
      utterance.volume = volumen / 100;
      if (vozEspañol) utterance.voice = vozEspañol;
      utterance.onend = () => {
        if (esQuiz(actual) && respuesta === null) return;
        avanzar();
      };
      utterance.onerror = () => {
        temporizador.current = window.setTimeout(() => {
          if (esQuiz(actual) && respuesta === null) return;
          avanzar();
        }, duracionEstimada(texto, velocidad));
      };
      sintesis.speak(utterance);
      return detener;
    }
    if (esQuiz(actual) && respuesta === null) return;
    temporizador.current = window.setTimeout(avanzar, duracionEstimada(texto, velocidad));
    return detener;
  }, [reproduciendo, escena, segmento, respuesta, velocidad, volumen, vozActiva, vozEspañol, actual, sintesis, detener, avanzar]);

  useEffect(() => {
    if (!esQuiz(actual) || respuesta === null || !reproduciendo) return;
    if (sintesis && vozActiva) return;
    temporizador.current = window.setTimeout(() => avanzar(), duracionEstimada(actual.aclaracion, velocidad));
    return detener;
  }, [respuesta, actual, reproduciendo, sintesis, vozActiva, velocidad, avanzar, detener]);

  // Entrada escalonada de fichas.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMontadas(true));
    return () => cancelAnimationFrame(raf);
  }, [escena]);

  useEffect(() => detener, [detener]);

  // Atajos de teclado.
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
    } else {
      setReproduciendo(true);
      reproducirSonido(sonarClic);
    }
  }

  function escucharFicha(indiceFicha: number) {
    if (!esContenido) return;
    const destino = actual.guion.findIndex((s) => s.ficha === indiceFicha);
    if (destino < 0) return;
    setSegmento(destino);
    setReproduciendo(true);
    reproducirSonido((ctx) => sonarFicha(ctx, indiceFicha));
  }

  const subtitulado = esQuiz(actual)
    ? respuesta === null
      ? actual.pregunta
      : actual.aclaracion
    : actual.guion[Math.min(segmento, actual.guion.length - 1)].texto;

  function alPulsarOpcion(indice: number) {
    if (respuesta !== null || !esQuiz(actual)) return;
    setRespuesta(indice);
    const correcta = actual.opciones[indice].correcta;
    reproducirSonido(correcta ? sonarAcierto : sonarFallo);
  }

  // ── Panel de detalle: lo que la voz no alcanza a decir ──────────────────────
  const detalle = esContenido && fichaActiva !== undefined ? actual.fichas[fichaActiva] : null;
  const conectadasAlDetalle = esContenido && fichaActiva !== undefined
    ? (actual.fichas[fichaActiva]?.conecta ?? []).map((i) => actual.fichas[i]?.nombre).filter(Boolean)
    : [];

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      {/* ── Escenario ────────────────────────────────────────────────────────── */}
      <div className="relative flex aspect-video flex-col justify-between overflow-hidden bg-brand-soft p-5 sm:p-7">
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

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 py-2 sm:gap-4 sm:py-3">
          <h3 className="m-0 text-center text-base font-semibold text-ink sm:text-xl">{actual.titulo}</h3>

          {esContenido ? (
            <div className="flex max-h-36 flex-wrap items-stretch justify-center gap-1.5 overflow-y-auto sm:gap-2">
              {actual.fichas.map((ficha, i) => (
                <FichaClave
                  key={`${actual.titulo}-${ficha.nombre}`}
                  ficha={ficha}
                  montada={montadas}
                  estado={fichaActiva === i ? "activa" : fichasConectadas.has(i) ? "conectada" : "normal"}
                  retraso={i * 130}
                  onClick={() => escucharFicha(i)}
                />
              ))}
            </div>
          ) : (
            <div className="flex w-full max-w-lg flex-col gap-1.5 sm:gap-2">
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
            </div>
          )}
        </div>

        <p className="relative m-0 text-center text-xs font-medium uppercase tracking-wide text-brand-dark">{actual.cinta}</p>
      </div>

      {/* ── Panel de detalle: lo que la voz no dice, el panel lo muestra ──────── */}
      {esContenido && (
        <div className="border-t border-line bg-surface px-5 py-3">
          {detalle ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">{detalle.nombre}</span>
                {conectadasAlDetalle.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Users size={13} aria-hidden /> Se conecta con: {conectadasAlDetalle.join(" · ")}
                  </span>
                )}
              </div>
              {detalle.detalle && <p className="m-0 text-sm leading-relaxed text-muted">{detalle.detalle}</p>}
              {actual.examen && (
                <p className="m-0 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
                  <Sparkles size={14} aria-hidden /> El examen pregunta: {actual.examen}
                </p>
              )}
            </div>
          ) : actual.examen ? (
            <p className="m-0 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
              <Sparkles size={14} aria-hidden /> El examen pregunta: {actual.examen}
            </p>
          ) : null}
        </div>
      )}

      {/* ── Subtítulo ──────────────────────────────────────────────────────────── */}
      <p aria-live="polite" className="m-0 border-t border-line bg-panel px-5 py-4 text-sm leading-relaxed text-ink">
        {subtitulado}
      </p>

      {/* ── Progreso ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-5 pt-3" role="group" aria-label="Ir a una escena">
        {escenas.map((e, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir a la escena ${i + 1}: ${e.titulo}`}
            aria-current={i === escena}
            onClick={() => irA(i)}
            className={cn(
              "h-1.5 flex-1 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:shadow-[var(--shadow-focus)]",
              i === escena ? "bg-brand" : i < escena ? "bg-brand/50" : "bg-line",
            )}
          />
        ))}
      </div>

      {/* ── Controles ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <button type="button" className={buttonClasses({ variant: "primary" })} onClick={alternarReproduccion}>
          {reproduciendo ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> Reproducir</>}
        </button>
        <button
          type="button"
          className={buttonClasses({ variant: "secondary" })}
          onClick={() => { setVelocidad((v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length]); reproducirSonido(sonarClic); }}
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
            className="h-1.5 w-20 cursor-pointer accent-brand"
          />
        </span>
        <button
          type="button"
          className={buttonClasses({ variant: "secondary" })}
          aria-pressed={!sonidos}
          onClick={() => { setSonidos((v) => !v); if (sonidos) reproducirSonido(sonarClic); }}
        >
          <Sparkles size={16} aria-hidden />
          <span className="sr-only">Sonidos </span>{sonidos ? "activados" : "desactivados"}
        </button>
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
          onClick={() => { detener(); irA(0); setReproduciendo(true); }}
        >
          <RotateCcw size={16} aria-hidden /> Reiniciar
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={titulo}>
          {sintesis ? "Espacio pausa · flechas navegan · clic en una ficha la repite" : "Sin voz disponible: el texto guía las escenas."}
        </span>
      </div>
    </figure>
  );
}

function duracionEstimada(texto: string, velocidad: number) {
  return Math.max(1600, Math.min(12_000, (texto.length * MS_POR_CARACTER) / velocidad));
}

function FichaClave({ ficha, montada, estado, retraso, onClick }: {
  ficha: FichaVideo;
  montada: boolean;
  estado: "activa" | "conectada" | "normal";
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
        "flex w-24 cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-center outline-none transition-all duration-500",
        "focus-visible:shadow-[var(--shadow-focus)] motion-reduce:transition-none sm:w-32 sm:gap-1.5 sm:p-3",
        montada ? "translate-y-0 rotate-0 scale-100 opacity-100" : "translate-y-4 -rotate-2 scale-90 opacity-0",
        estado === "activa" && "border-brand bg-brand-soft/60 shadow-card ring-2 ring-brand",
        estado === "conectada" && "border-brand/50 bg-brand-soft/30 ring-1 ring-brand/40",
        estado === "normal" && "border-line bg-panel",
      )}
    >
      <span className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-300 sm:size-10",
        estado === "activa" ? "scale-110 bg-brand text-on-brand" : "bg-brand text-on-brand",
        estado === "conectada" && "scale-105 opacity-70",
      )}>
        <Icono size={18} aria-hidden />
      </span>
      <span className="text-xs font-semibold leading-tight text-ink sm:text-sm">{ficha.nombre}</span>
      <span className="hidden text-[10px] leading-snug text-muted sm:block sm:text-xs">{ficha.rol}</span>
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
