"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BookOpenCheck, CheckCircle2, GraduationCap, ListVideo, Play, PlayCircle, SkipBack, SkipForward, X } from "lucide-react";
import { IconButton, buttonClasses } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { formatoDuracion, type VistaProgreso } from "@/lib/cursos/catalogo";
import { textoPeso } from "@/lib/cursos/temario-examen";

type Vecina = { slug: string; titulo: string } | null;

// Barra fija al pie de la clase, como en la referencia: qué clase es («Clase 4 de 18 · curso»), el botón «Clases» que
// abre el panel «Progreso del curso» y los botones de anterior y «Siguiente clase».
//
// Pasar a la siguiente clase da por vista la actual y la marca como completada (si el guardado del avance está
// activo). Es el equivalente, sin vídeo, a terminar de verlo; quien quiera desmarcarla tiene el botón de la clase.
export function BarraClase({
  curso,
  clase,
  numero,
  anterior,
  siguiente,
  examen,
  progreso,
  completada,
  guardado,
}: {
  curso: { slug: string; titulo: string };
  clase: { slug: string; titulo: string };
  numero: number;
  anterior: Vecina;
  siguiente: Vecina;
  examen: { titulo: string; href: string };
  progreso: VistaProgreso;
  completada: boolean;
  guardado: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const base = `/cursos/${curso.slug}`;

  async function marcarYSeguir(destino: string) {
    setAvanzando(true);
    if (guardado && !completada) {
      // Si falla el guardado no se bloquea el estudio: se sigue a la siguiente clase y la actual queda sin marcar,
      // como estaba. Se espera como mucho 4 s para no dejar a la persona mirando un botón que no responde.
      await Promise.race([
        fetch("/api/cursos/progreso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curso: curso.slug, clase: clase.slug, completada: true }),
        }).catch(() => null),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    }
    router.push(destino);
  }

  return (
    // Hija directa del contenido de AppShell (no del contenedor de ancho máximo): así `sticky` la mantiene al pie
    // durante toda la página. En móvil se apoya encima del dock inferior (64 px + área segura); los márgenes negativos
    // compensan el padding del contenido para ocupar todo el ancho.
    <div className="tw sticky bottom-[calc(64px+max(8px,env(safe-area-inset-bottom)))] z-30 -mx-4 mt-8 border-t border-line bg-panel/95 px-4 py-3 shadow-card backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
      {/* pr-16: deja libre la esquina del botón flotante del asistente, que si no tapaba «Siguiente clase». */}
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 pr-16">
        <span aria-hidden className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand sm:inline-flex">
          <GraduationCap size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold text-ink sm:text-[15px]">{clase.titulo}</p>
          <p className="m-0 truncate text-xs text-muted">
            Clase {numero} de {progreso.total} · {curso.titulo}
          </p>
        </div>

        <DialogPrimitive.Root open={abierto} onOpenChange={setAbierto}>
          <DialogPrimitive.Trigger className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <ListVideo size={17} aria-hidden />
            <span className="hidden sm:inline">Clases</span>
            <span className="sr-only sm:hidden">Clases y progreso del curso</span>
          </DialogPrimitive.Trigger>
          <PanelProgreso base={base} progreso={progreso} onElegir={() => setAbierto(false)} />
        </DialogPrimitive.Root>

        <div className="flex items-center gap-1">
          {anterior ? (
            <Link
              href={`${base}/${anterior.slug}`}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
              aria-label={`Clase anterior: ${anterior.titulo}`}
            >
              <SkipBack size={17} aria-hidden />
            </Link>
          ) : (
            <span className={cn(buttonClasses({ variant: "ghost", size: "sm" }), "pointer-events-none opacity-40")} aria-hidden>
              <SkipBack size={17} />
            </span>
          )}
          {siguiente ? (
            <button
              type="button"
              disabled={avanzando}
              onClick={() => void marcarYSeguir(`${base}/${siguiente.slug}`)}
              className={buttonClasses({ variant: "primary", size: "sm" })}
              aria-label={`Siguiente clase: ${siguiente.titulo}`}
            >
              <SkipForward size={17} aria-hidden />
              <span className="hidden sm:inline">{avanzando ? "Abriendo…" : "Siguiente clase"}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={avanzando}
              onClick={() => void marcarYSeguir(examen.href)}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              <BookOpenCheck size={17} aria-hidden />
              <span className="hidden sm:inline">{examen.titulo}</span>
              <span className="sr-only sm:hidden">{examen.titulo}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelProgreso({ base, progreso, onElegir }: { base: string; progreso: VistaProgreso; onElegir: () => void }) {
  const actual = useRef<HTMLAnchorElement>(null);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="tw fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] animate-overlay-in" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        // Al abrir, la clase que se está viendo queda a la vista (con 18 clases, la 12 quedaba fuera de pantalla).
        // Aquí y no en un efecto: el panel está montado aunque esté cerrado, y su contenido aparece al abrirse.
        onOpenAutoFocus={() => requestAnimationFrame(() => actual.current?.scrollIntoView({ block: "center" }))}
        className="tw fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-line bg-panel shadow-pop outline-none sm:inset-y-3 sm:right-3 sm:rounded-2xl sm:border"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <DialogPrimitive.Title className="m-0 text-xl font-bold tracking-tight text-ink">Progreso del curso</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <IconButton aria-label="Cerrar">
              <X size={20} />
            </IconButton>
          </DialogPrimitive.Close>
        </div>
        <div className="border-b border-line px-5 pb-4 pt-3">
          <div
            role="progressbar"
            aria-label="Avance del curso"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progreso.porcentaje}
            className="h-1.5 overflow-hidden rounded-full bg-brand-soft"
          >
            {/* Ancho dinámico: es el dato, no un estilo fijo. */}
            <div className="h-full rounded-full bg-success" style={{ width: `${progreso.porcentaje}%` }} />
          </div>
          <p className="mb-0 mt-2 text-sm font-semibold text-success">
            {progreso.porcentaje} % completado <span className="font-normal text-muted">· {progreso.hechas} de {progreso.total} clases</span>
          </p>
        </div>

        <nav aria-label="Clases del curso" className="flex-1 overflow-y-auto px-3 py-3">
          {progreso.secciones.map((s) => (
            <section key={s.slug} aria-labelledby={`panel-${s.slug}`} className="mb-4">
              <h3 id={`panel-${s.slug}`} className="mb-1 mt-2 flex items-baseline justify-between gap-2 px-2 text-[15px] font-semibold text-ink">
                {s.titulo}
                <span className="text-xs font-normal text-muted">
                  {s.hechas}/{s.clases.length}
                </span>
              </h3>
              <p className="mb-1 mt-0 px-2 text-xs text-muted">
                {s.preguntas !== null ? `${textoPeso(s.preguntas)} del examen` : "Fuera del temario del examen"}
              </p>
              <ol className="m-0 list-none p-0">
                {s.clases.map((c) => {
                  const esActual = c.estado === "actual";
                  return (
                    <li key={c.slug}>
                      <Link
                        ref={esActual ? actual : undefined}
                        href={`${base}/${c.slug}`}
                        onClick={onElegir}
                        aria-current={esActual ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-2 py-2 text-ink no-underline outline-none",
                          "hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]",
                          esActual && "bg-brand-soft hover:bg-brand-soft",
                        )}
                      >
                        <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted">
                          {esActual ? <Play size={14} aria-hidden className="mx-auto text-brand" fill="currentColor" /> : c.numero}
                        </span>
                        {/* Miniatura de maqueta, como la portada del reproductor. */}
                        <span
                          aria-hidden
                          className="flex h-12 w-20 shrink-0 flex-col items-start justify-end rounded-lg border border-line bg-brand-soft p-1.5"
                        >
                          <span className="text-[9px] font-bold uppercase leading-none tracking-wide text-brand">Mód. {c.modulo}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-snug">{c.titulo}</span>
                          <span className="mt-1 block text-xs">
                            {c.estado === "completada" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-success">
                                <CheckCircle2 size={14} aria-hidden /> Completado
                              </span>
                            ) : esActual ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-brand">
                                <PlayCircle size={14} aria-hidden /> Viendo ahora
                              </span>
                            ) : (
                              <span className="text-muted">{formatoDuracion(c.minutos)}</span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </nav>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
