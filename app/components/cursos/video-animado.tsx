"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import {
  Ban, BadgeCheck, BookOpen, Building2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList,
  Compass, Crown, FileSearch, FileText, FileWarning, Gavel, GraduationCap, Landmark, Lightbulb,
  ListChecks, Network, Pause, Play, RotateCcw, Scale, ShoppingBag, Sparkles, Stamp, Swords,
  User, UserCog, Users, Volume2, VolumeX, XCircle, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/app/components/ui/button";
import { esQuiz, type EscenaVideo, type FichaVideo } from "@/lib/cursos/videos";
import { frasesParaVoz, textoParaVoz, vocesEnEspanol, vozEsBasica } from "@/lib/cursos/voz";
import { EVENTO_PESTANA } from "./pestanas-clase";
import { cn } from "@/lib/utils";

export const ICONOS_COMPONENTES: Record<string, LucideIcon> = {
  Landmark, Scale, ShoppingBag, Building2, Users, Crown, UserCog, User,
  Compass, Network, BadgeCheck, ClipboardList, FileSearch, FileWarning, FileText,
  Gavel, Stamp, Ban, ListChecks, Swords, BookOpen, GraduationCap,
};

const VELOCIDADES: readonly number[] = [0.75, 1, 1.25, 1.5];
// Entrada escalonada de fichas y opciones: 130 ms entre una y la siguiente. Es un retraso de ANIMACIÓN, no de
// transición: antes era `transition-delay`, que además retrasaba el resaltado de la ficha que habla (la sexta se
// iluminaba 650 ms tarde) y solo animaba la primera escena. Clases fijas en vez de un `style` calculado porque
// tests/tailwind-migracion.test.ts no deja crecer los estilos en línea; una escena no pasa de ocho elementos.
const RETRASOS = [
  "[animation-delay:0ms]", "[animation-delay:130ms]", "[animation-delay:260ms]", "[animation-delay:390ms]",
  "[animation-delay:520ms]", "[animation-delay:650ms]", "[animation-delay:780ms]", "[animation-delay:910ms]",
] as const;
const retrasoDe = (i: number) => RETRASOS[Math.min(i, RETRASOS.length - 1)];
const MS_POR_CARACTER = 66;
// Silencios de la narración: entre frases, entre segmentos y al cambiar de escena. Sin ellos la voz encadenaba todo
// de corrido, que es buena parte de lo que la hacía sonar a máquina.
const PAUSA_FRASE = 220;
const PAUSA_SEGMENTO = 450;
const PAUSA_ESCENA = 800;
const CLAVE_VOZ = "ace-curso-voz";

// speechSynthesis solo existe en el navegador: leerlo durante el render daba un HTML distinto en el servidor y en el
// cliente (el aviso «Sin voz disponible» frente a los controles de voz). Con useSyncExternalStore el servidor y la
// hidratación dicen «sin voz» y el cliente corrige justo después.
const sinSuscripcion = () => () => {};
const hayVozEnNavegador = () => "speechSynthesis" in window;
const sinVozEnServidor = () => false;

type Ctx = AudioContext;

function crearContexto(): Ctx | null {
  try { return new AudioContext(); } catch { return null; }
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

function sonarFicha(ctx: Ctx, i: number) { tono(ctx, 440 + i * 60, 0.12, "sine", 0.05); }
function sonarAcierto(ctx: Ctx) { tono(ctx, 523, 0.12, "sine", 0.07); setTimeout(() => tono(ctx, 784, 0.15, "sine", 0.07), 110); }
function sonarFallo(ctx: Ctx) { tono(ctx, 220, 0.2, "square", 0.04); }
function sonarEscena(ctx: Ctx) { tono(ctx, 320, 0.1, "triangle", 0.03); }
function sonarClic(ctx: Ctx) { tono(ctx, 660, 0.06, "sine", 0.04); }

/** Duración aproximada de un guion completo, para mostrar «≈ X min». */
function duracionGuion(escenas: readonly EscenaVideo[]): number {
  let caracteres = 0;
  for (const e of escenas) {
    if (esQuiz(e)) caracteres += e.pregunta.length + e.aclaracion.length + 40;
    else for (const s of e.guion) caracteres += s.texto.length;
  }
  return Math.max(1, Math.round((caracteres * MS_POR_CARACTER) / 1000 / 60));
}

/** Lo que pasa al terminar: marcar la clase (si el avance se guarda y aún no lo está) y ofrecer sus casos. */
export type FinVideo = { curso: string; clase: string; marcar: boolean; casos: number };

export function VideoAnimado({ escenas, modulo, titulo, fin }: {
  escenas: readonly EscenaVideo[];
  modulo: string;
  titulo: string;
  fin?: FinVideo;
}) {
  const router = useRouter();
  const [terminado, setTerminado] = useState(false);
  const [marca, setMarca] = useState<"marcando" | "marcada" | "error" | null>(null);
  const marcaPedida = useRef(false);
  const [escena, setEscena] = useState(0);
  const [segmento, setSegmento] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [volumen, setVolumen] = useState(100);
  const [vozActiva, setVozActiva] = useState(true);
  const [sonidos, setSonidos] = useState(true);
  const [respuesta, setRespuesta] = useState<number | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const audioRef = useRef<Ctx | null>(null);
  // Velocidad y volumen se leen al empezar cada frase. Antes eran dependencias del efecto que habla, así que mover el
  // volumen reiniciaba la frase en cada paso del deslizador.
  const velocidadRef = useRef(1);
  const volumenRef = useRef(100);
  // En qué frase del segmento va la voz: pausar y reanudar sigue desde ahí, no desde el principio del segmento.
  const fraseRef = useRef(0);
  // Sube cada vez que se pide repetir una ficha: si es la que ya está hablando, el segmento no cambia y sin esto el
  // efecto que narra no se volvería a ejecutar.
  const [toma, setToma] = useState(0);

  const hayVoz = useSyncExternalStore(sinSuscripcion, hayVozEnNavegador, sinVozEnServidor);
  const sintesis = hayVoz ? window.speechSynthesis : null;
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [nombreVoz, setNombreVoz] = useState("");
  useEffect(() => {
    if (!sintesis) return;
    const leer = () => {
      setVoces(vocesEnEspanol(sintesis.getVoices()));
      try { setNombreVoz(localStorage.getItem(CLAVE_VOZ) ?? ""); } catch { /* sin almacenamiento: voz automática */ }
    };
    leer();
    sintesis.addEventListener("voiceschanged", leer);
    return () => sintesis.removeEventListener("voiceschanged", leer);
  }, [sintesis]);

  // La elegida por la persona si sigue instalada; si no, la que mejor suena (lib/cursos/voz.ts).
  const vozEspañol = useMemo(
    () => voces.find((v) => v.name === nombreVoz) ?? voces[0] ?? null,
    [voces, nombreVoz],
  );

  function elegirVoz(nombre: string) {
    setNombreVoz(nombre);
    fraseRef.current = 0;
    try {
      if (nombre) localStorage.setItem(CLAVE_VOZ, nombre);
      else localStorage.removeItem(CLAVE_VOZ);
    } catch { /* preferencia de comodidad: si no se guarda, se vuelve a la automática */ }
  }

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
  const guionSeguro = esContenido ? actual.guion : null;
  const segmentoSeguro = guionSeguro ? Math.min(segmento, guionSeguro.length - 1) : 0;
  const fichaActiva = guionSeguro ? guionSeguro[segmentoSeguro]?.ficha : undefined;
  const fichasConectadas = useMemo(() => {
    if (!esContenido || fichaActiva === undefined) return new Set<number>();
    const ficha = actual.fichas[fichaActiva];
    return new Set(ficha?.conecta ?? []);
  }, [esContenido, actual, fichaActiva]);

  const irA = useCallback((destino: number) => {
    const seguro = Math.max(0, Math.min(total - 1, destino));
    setRespuesta(null);
    setSegmento(0);
    fraseRef.current = 0;
    setTerminado(false);
    setEscena(seguro);
    reproducirSonido(sonarEscena);
  }, [total, reproducirSonido]);

  const avanzar = useCallback(() => {
    if (guionSeguro && segmentoSeguro + 1 < guionSeguro.length) {
      const proximo = guionSeguro[segmentoSeguro + 1];
      if (proximo?.ficha !== undefined) reproducirSonido((ctx) => sonarFicha(ctx, proximo.ficha!));
      fraseRef.current = 0;
      setSegmento((s) => s + 1);
      return;
    }
    if (escena + 1 < total) irA(escena + 1);
    else {
      setReproduciendo(false);
      setTerminado(true);
    }
  }, [guionSeguro, segmentoSeguro, escena, total, irA, reproducirSonido]);

  // La narración: el texto del segmento se prepara para la voz (lib/cursos/voz.ts), se parte en frases y se dice una
  // a una con silencios breves. Sin voz (o silenciada), cada frase dura lo que tardaría en leerse.
  useEffect(() => {
    if (!reproduciendo) return;
    let texto: string;
    const quizSinResponder = esQuiz(actual) && respuesta === null;
    if (esQuiz(actual)) {
      texto = respuesta === null
        ? actual.pregunta
        : `${actual.opciones[respuesta].correcta ? "¡Muy bien!" : "No exactamente."} ${actual.aclaracion}`;
    } else {
      texto = actual.guion[segmentoSeguro].texto;
    }
    const frases = frasesParaVoz(textoParaVoz(texto));
    const ultimoSegmento = esQuiz(actual) || segmentoSeguro === actual.guion.length - 1;
    const habla = sintesis && vozActiva;
    let cancelado = false;
    let i = Math.min(fraseRef.current, frases.length - 1);

    const decir = () => {
      if (cancelado) return;
      if (i >= frases.length) {
        fraseRef.current = 0;
        // Una pregunta sin responder espera al alumno; lo demás sigue tras un silencio.
        if (quizSinResponder) return;
        temporizador.current = window.setTimeout(avanzar, ultimoSegmento ? PAUSA_ESCENA : PAUSA_SEGMENTO);
        return;
      }
      fraseRef.current = i;
      const frase = frases[i];
      const seguir = () => {
        i += 1;
        temporizador.current = window.setTimeout(decir, PAUSA_FRASE);
      };
      if (!habla) {
        temporizador.current = window.setTimeout(seguir, duracionEstimada(frase, velocidadRef.current));
        return;
      }
      const u = new SpeechSynthesisUtterance(frase);
      if (vozEspañol) {
        u.voice = vozEspañol;
        u.lang = vozEspañol.lang;
      } else u.lang = "es-PE";
      u.rate = velocidadRef.current;
      u.volume = volumenRef.current / 100;
      u.onend = () => { if (!cancelado) seguir(); };
      u.onerror = (e) => {
        // «interrupted» y «canceled» son nuestras: pausar o cambiar de escena corta la frase a propósito.
        if (cancelado || e.error === "interrupted" || e.error === "canceled") return;
        temporizador.current = window.setTimeout(seguir, duracionEstimada(frase, velocidadRef.current));
      };
      sintesis.speak(u);
    };

    temporizador.current = window.setTimeout(decir, 0);
    return () => {
      cancelado = true;
      detener();
    };
  }, [reproduciendo, escena, segmentoSeguro, respuesta, toma, vozActiva, vozEspañol, actual, sintesis, detener, avanzar]);

  useEffect(() => detener, [detener]);

  // Teclado solo con el foco en el vídeo: antes escuchaba en toda la página, así que la flecha en las pestañas de la
  // clase cambiaba también de escena y la barra espaciadora pausaba el vídeo en vez de bajar la página.
  function alPulsarTecla(e: KeyboardEvent<HTMLElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.code === "Space") { e.preventDefault(); alternarReproduccion(); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); irA(escena - 1); }
    else if (e.code === "ArrowRight") { e.preventDefault(); irA(escena + 1); }
  }

  // Ver el vídeo entero es haber visto la clase: se marca sola, como al pulsar «Siguiente clase» en la barra del pie.
  // Una sola vez por visita (marcaPedida), y router.refresh() para que el botón «Marcar como completada» y el panel
  // de progreso lo reflejen. Si falla, se dice y no se insiste: el botón de la clase sigue ahí.
  useEffect(() => {
    if (!terminado || !fin?.marcar || marcaPedida.current) return;
    marcaPedida.current = true;
    void Promise.resolve()
      .then(() => {
        setMarca("marcando");
        return fetch("/api/cursos/progreso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curso: fin.curso, clase: fin.clase, completada: true }),
        });
      })
      .then((r) => {
        setMarca(r.ok ? "marcada" : "error");
        if (r.ok) router.refresh();
      })
      .catch(() => setMarca("error"));
  }, [terminado, fin, router]);

  function abrirCasos() {
    window.dispatchEvent(new CustomEvent(EVENTO_PESTANA, { detail: "casuistica" }));
  }

  function alternarReproduccion() {
    if (reproduciendo) { detener(); setReproduciendo(false); }
    else { setReproduciendo(true); reproducirSonido(sonarClic); }
  }

  function escucharFicha(indiceFicha: number) {
    if (!esContenido) return;
    const destino = actual.guion.findIndex((s) => s.ficha === indiceFicha);
    if (destino < 0) return;
    detener();
    fraseRef.current = 0;
    setToma((t) => t + 1);
    setSegmento(destino);
    setReproduciendo(true);
    reproducirSonido((ctx) => sonarFicha(ctx, indiceFicha));
  }

  const subtitulado = esQuiz(actual)
    ? respuesta === null ? actual.pregunta : actual.aclaracion
    : actual.guion[segmentoSeguro].texto;

  function alPulsarOpcion(indice: number) {
    if (respuesta !== null || !esQuiz(actual)) return;
    detener();
    fraseRef.current = 0;
    setRespuesta(indice);
    const correcta = actual.opciones[indice].correcta;
    reproducirSonido(correcta ? sonarAcierto : sonarFallo);
  }

  const detalle = esContenido && fichaActiva !== undefined ? actual.fichas[fichaActiva] : null;
  const conectadasAlDetalle = esContenido && fichaActiva !== undefined
    ? (actual.fichas[fichaActiva]?.conecta ?? []).map((i) => actual.fichas[i]?.nombre).filter(Boolean)
    : [];
  const minutosVideo = useMemo(() => duracionGuion(escenas), [escenas]);

  return (
    <figure
      tabIndex={0}
      aria-label={`Vídeo de la clase: ${titulo}`}
      onKeyDown={alPulsarTecla}
      className="m-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card outline-none focus-visible:shadow-[var(--shadow-focus)]"
    >
      {/* ── Escenario ────────────────────────────────────────────────────────── */}
      <div className="relative flex aspect-video flex-col justify-between overflow-hidden bg-brand-soft p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-panel/40 blur-3xl motion-reduce:hidden sm:size-64" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 size-56 rounded-full bg-panel/30 blur-3xl motion-reduce:hidden sm:size-72" />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Escena {escena + 1} de {total}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
            Módulo {modulo} · ≈{minutosVideo} min
          </span>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 py-2 sm:gap-4 sm:py-3">
          <h3 key={`titulo-${escena}`} className="m-0 animate-[fade-in_0.35s_ease-out] text-center text-base font-semibold text-ink motion-reduce:animate-none sm:text-xl">
            {actual.titulo}
          </h3>

          {esContenido ? (
            <div key={`fichas-${escena}`} className="flex max-h-36 flex-wrap items-stretch justify-center gap-1.5 overflow-y-auto sm:gap-2">
              {actual.fichas.map((ficha, i) => (
                <FichaClave
                  key={`${actual.titulo}-${ficha.nombre}`}
                  ficha={ficha}
                  estado={fichaActiva === i ? "activa" : fichasConectadas.has(i) ? "conectada" : "normal"}
                  retraso={retrasoDe(i)}
                  onClick={() => escucharFicha(i)}
                />
              ))}
            </div>
          ) : (
            <div key={`opciones-${escena}`} className="flex w-full max-w-lg flex-col gap-1.5 sm:gap-2">
              {actual.opciones.map((opcion, i) => (
                <OpcionClave
                  key={opcion.texto}
                  texto={opcion.texto}
                  indice={i}
                  respondida={respuesta !== null}
                  elegida={respuesta === i}
                  correcta={opcion.correcta}
                  retraso={retrasoDe(i)}
                  onElegir={() => alPulsarOpcion(i)}
                />
              ))}
            </div>
          )}
        </div>

        <p className="relative m-0 text-center text-xs font-medium uppercase tracking-wide text-brand-dark">{actual.cinta}</p>
      </div>

      {/* ── Panel de detalle: anima con cada ficha ───────────────────────────── */}
      {esContenido && (
        <div className="border-t border-line bg-surface px-5 py-3">
          {/* animate-in/slide-in eran clases de un plugin que este proyecto no tiene: el panel no animaba. */}
          <div key={`${actual.titulo}-${fichaActiva ?? "intro"}`} className="animate-[fade-in_0.3s_ease-out] space-y-1.5 motion-reduce:animate-none">
            {detalle ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{detalle.nombre}</span>
                  {detalle.articulo && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] font-medium text-muted">
                      <BookOpen size={11} aria-hidden /> {detalle.articulo}
                    </span>
                  )}
                  {conectadasAlDetalle.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Users size={13} aria-hidden /> Se conecta con: {conectadasAlDetalle.join(" · ")}
                    </span>
                  )}
                </div>
                {detalle.detalle && <p className="m-0 text-sm leading-relaxed text-muted">{detalle.detalle}</p>}
              </>
            ) : (
              <p className="m-0 text-sm font-medium text-ink">{actual.guion[segmentoSeguro].texto}</p>
            )}
            {actual.truco && (
              <p className="m-0 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">
                <Lightbulb size={14} aria-hidden /> <span className="sr-only">Truco de memoria: </span>{actual.truco}
              </p>
            )}
            {actual.examen && (
              <p className="m-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-dark">
                <Sparkles size={14} aria-hidden /> <span className="sr-only">Para el examen: </span>{actual.examen}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Subtítulo ──────────────────────────────────────────────────────────── */}
      <p aria-live="polite" className="m-0 border-t border-line bg-panel px-5 py-4 text-sm leading-relaxed text-ink">
        {subtitulado}
      </p>

      {/* ── Fin del vídeo: qué se hizo con el avance y hacia dónde seguir ─────────── */}
      {terminado && (
        <div role="status" className="flex flex-wrap items-center gap-3 border-t border-line bg-success-soft px-5 py-4">
          <CheckCircle2 size={20} aria-hidden className="shrink-0 text-success" />
          <span className="min-w-0 flex-1 text-sm text-ink">
            <strong>Terminaste el vídeo.</strong>{" "}
            {marca === "marcada" || marca === "marcando"
              ? "Marcamos la clase como completada."
              : marca === "error"
                ? "No se pudo marcar la clase; márcala con el botón de abajo."
                : ""}
            {fin?.casos ? ` Ahora ponlo a prueba con ${fin.casos} casos tipo examen.` : ""}
          </span>
          {fin?.casos ? (
            <button type="button" className={buttonClasses({ variant: "primary" })} onClick={abrirCasos}>
              <ClipboardList size={16} aria-hidden /> Ver los casos
            </button>
          ) : null}
        </div>
      )}

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
          onClick={() => {
            const nueva = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length];
            velocidadRef.current = nueva;
            setVelocidad(nueva);
            reproducirSonido(sonarClic);
          }}
          aria-label={`Velocidad de la voz: ${velocidad} veces. Pulsa para cambiarla.`}
        >
          {velocidad}×
        </button>
        <span className="inline-flex items-center gap-2">
          <Volume2 size={16} aria-hidden className="shrink-0 text-muted" />
          <input type="range" min={0} max={100} step={5} value={volumen} onChange={(e) => { volumenRef.current = Number(e.target.value); setVolumen(volumenRef.current); }} aria-label="Volumen de la voz" className="h-1.5 w-20 cursor-pointer accent-brand" />
        </span>
        <button type="button" className={buttonClasses({ variant: "secondary" })} aria-pressed={!sonidos} onClick={() => { setSonidos((v) => !v); if (sonidos) reproducirSonido(sonarClic); }}>
          <Sparkles size={16} aria-hidden /> <span className="sr-only">Sonidos </span>{sonidos ? "activados" : "desactivados"}
        </button>
        {sintesis && (
          <button type="button" className={buttonClasses({ variant: "secondary" })} aria-pressed={!vozActiva} onClick={() => setVozActiva((v) => !v)}>
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
        <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => { detener(); irA(0); setReproduciendo(true); }}>
          <RotateCcw size={16} aria-hidden /> Reiniciar
        </button>
        {sintesis && voces.length > 1 && (
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            Voz
            <select
              value={vozEspañol && nombreVoz ? vozEspañol.name : ""}
              onChange={(e) => elegirVoz(e.target.value)}
              className="max-w-52 rounded-lg border border-line-strong bg-panel px-2 py-1.5 text-xs text-ink"
            >
              <option value="">Automática (la más natural)</option>
              {voces.map((v) => (
                <option key={v.name} value={v.name}>
                  {nombreCorto(v.name)} · {v.lang}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-muted" title={titulo}>
          {sintesis
            ? "Con el foco en el vídeo: espacio pausa y las flechas cambian de escena · clic en una ficha la repite"
            : "Sin voz disponible: el texto guía las escenas."}
        </span>
      </div>
      {/* Las voces dependen del navegador: si solo hay las básicas del sistema, se dice dónde suena mejor. */}
      {sintesis && vozActiva && vozEsBasica(vozEspañol) && (
        <p className="m-0 border-t border-line bg-surface px-5 py-2.5 text-xs text-muted">
          Tu navegador solo tiene voces básicas en español, por eso suena robótica. En Microsoft Edge o Google Chrome la
          narración usa voces mucho más naturales.
        </p>
      )}
    </figure>
  );
}

/** «Microsoft Dalia Online (Natural) - Spanish (Mexico)» → «Dalia Online (Natural)»: el selector es estrecho. */
function nombreCorto(nombre: string) {
  return nombre.replace(/^Microsoft\s+/, "").replace(/\s*-\s*Spanish.*$/, "");
}

function duracionEstimada(texto: string, velocidad: number) {
  return Math.max(1600, Math.min(12_000, (texto.length * MS_POR_CARACTER) / velocidad));
}

function FichaClave({ ficha, estado, retraso, onClick }: {
  ficha: FichaVideo;
  estado: "activa" | "conectada" | "normal";
  retraso: string;
  onClick: () => void;
}) {
  const Icono = ICONOS_COMPONENTES[ficha.icono] ?? Users;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Escuchar de nuevo: ${ficha.nombre}`}
      className={cn(
        "flex w-24 cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-center outline-none",
        "animate-entra-ficha transition-[background-color,border-color,box-shadow,translate] duration-300",
        retraso,
        "focus-visible:shadow-[var(--shadow-focus)] motion-reduce:animate-none motion-reduce:transition-none sm:w-32 sm:gap-1.5 sm:p-3",
        estado === "activa" && "-translate-y-0.5",
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
      {ficha.articulo && (
        <span className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] font-medium text-muted sm:text-[10px]">
          {ficha.articulo}
        </span>
      )}
    </button>
  );
}

function OpcionClave({ texto, indice, respondida, elegida, correcta, retraso, onElegir }: {
  texto: string;
  indice: number;
  respondida: boolean;
  elegida: boolean;
  correcta: boolean;
  retraso: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      disabled={respondida}
      aria-label={`Opción ${indice + 1}: ${texto}`}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm outline-none",
        "animate-entra-ficha transition-[background-color,border-color,opacity] duration-300",
        retraso,
        "focus-visible:shadow-[var(--shadow-focus)] motion-reduce:animate-none motion-reduce:transition-none",
        respondida
          ? correcta ? "border-success bg-success-soft text-ink"
          : elegida ? "border-danger bg-danger-soft text-ink"
          : "border-line bg-panel opacity-60"
          : "cursor-pointer border-line bg-panel text-ink hover:border-brand",
      )}
    >
      {respondida && (correcta ? <CheckCircle2 size={18} aria-hidden className="shrink-0 text-success" /> : elegida ? <XCircle size={18} aria-hidden className="shrink-0 text-danger" /> : null)}
      <span className="min-w-0 flex-1">{texto}</span>
    </button>
  );
}
