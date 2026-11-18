"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ClipboardList, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Casuistica, ContenidoClase } from "@/lib/cursos/tipos";

type Referencia = { texto: string; href: string | null };
type Pestana = "resumen" | "casuistica" | "base";

/** Evento para abrir una pestaña desde otro componente de la clase (el fin del vídeo animado). */
export const EVENTO_PESTANA = "curso:abrir-pestana";

// Pestañas Resumen | Casuística | Base legal bajo el reproductor. Los enlaces a la norma llegan ya resueltos
// desde el servidor: `href` es null cuando la cuenta no puede abrir el lector de normas (un alumno sin Centro
// Jurídico), y entonces la referencia se muestra como texto en vez de como un enlace que acabaría en un rechazo.
export function PestanasClase({ contenido, referencias }: { contenido: ContenidoClase; referencias: Referencia[] }) {
  const [activa, setActiva] = useState<Pestana>("resumen");
  const lista = useRef<HTMLDivElement>(null);
  // La pestaña de casuística solo aparece cuando la clase tiene casos: una pestaña vacía no invita a nada.
  const pestanas = [
    { id: "resumen" as const, label: "Resumen", icono: BookOpen },
    ...(contenido.casuisticas?.length
      ? [{ id: "casuistica" as const, label: "Casuística", icono: ClipboardList }]
      : []),
    { id: "base" as const, label: "Base legal", icono: Scale },
  ];
  const seccion = useRef<HTMLElement>(null);
  const tieneCasos = Boolean(contenido.casuisticas?.length);

  // Abrir una pestaña desde fuera: el fin del vídeo («Ver los casos») o un enlace con #casuistica. Lleva la vista a
  // las pestañas y el foco a la elegida, para que quien venía del vídeo vea dónde están los casos.
  useEffect(() => {
    const abrir = (id: string) => {
      if (id !== "resumen" && id !== "base" && !(id === "casuistica" && tieneCasos)) return;
      setActiva(id as Pestana);
      requestAnimationFrame(() => {
        seccion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById(`pestana-${id}`)?.focus({ preventScroll: true });
      });
    };
    const alEvento = (e: Event) => abrir(String((e as CustomEvent).detail));
    const alHash = () => location.hash === "#casuistica" && abrir("casuistica");
    window.addEventListener(EVENTO_PESTANA, alEvento);
    window.addEventListener("hashchange", alHash);
    const raf = requestAnimationFrame(alHash);
    return () => {
      window.removeEventListener(EVENTO_PESTANA, alEvento);
      window.removeEventListener("hashchange", alHash);
      cancelAnimationFrame(raf);
    };
  }, [tieneCasos]);

  return (
    <section ref={seccion} className="scroll-mt-24 rounded-2xl border border-line bg-panel shadow-card">
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

      {contenido.casuisticas?.length ? (
        <div id="panel-casuistica" role="tabpanel" aria-labelledby="pestana-casuistica" hidden={activa !== "casuistica"} className="p-5 sm:p-6">
          <p className="mb-5 mt-0 text-sm text-muted">
            Casos tipo examen. Lee la situación, piensa tu respuesta y compárala con la resolución.
          </p>
          <div className="space-y-5">
            {contenido.casuisticas.map((caso, i) => (
              <CasoClave key={caso.enunciado} indice={i + 1} caso={caso} />
            ))}
          </div>
        </div>
      ) : null}

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

// Un caso tipo examen: enunciado visible, resolución oculta tras un botón para que el alumno la piense primero.
function CasoClave({ indice, caso }: { indice: number; caso: Casuistica }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <h4 className="mb-2 mt-0 text-sm font-semibold uppercase tracking-wide text-brand">Caso {indice}</h4>
      <p className="mb-3 mt-0 text-[15px] leading-relaxed text-ink">{caso.enunciado}</p>
      <button
        type="button"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-soft px-4 font-semibold text-brand-dark outline-none hover:bg-brand/15 focus-visible:shadow-[var(--shadow-focus)]"
        aria-expanded={abierta}
        aria-controls={`caso-${indice}-resolucion`}
        onClick={() => setAbierta(v => !v)}
      >
        <ClipboardList size={16} aria-hidden />
        {abierta ? "Ocultar la resolución" : "Ver cómo se resuelve"}
      </button>
      <div id={`caso-${indice}-resolucion`} hidden={!abierta} className="space-y-3 rounded-xl bg-panel p-4">
        <p className="m-0 text-[15px] leading-relaxed text-ink">{caso.resolucion}</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {caso.baseLegal.map(b => (
            <li key={`${b.norma}-${b.articulo}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              {b.norma} · Art. {b.articulo}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
