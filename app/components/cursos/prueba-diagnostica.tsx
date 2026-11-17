// Tarjeta «¿Por dónde empiezo?» de la portada del curso. Sin "use client": la pinta el servidor con el resultado ya
// agregado; solo el botón que empieza la prueba es de cliente.
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import type { EstadoDiagnostico } from "@/lib/cursos/diagnostico-server";
import { MINUTOS_DIAGNOSTICO, PREGUNTAS_DIAGNOSTICO } from "@/lib/cursos/diagnostico";
import { temaExamen } from "@/lib/cursos/temario-examen";
import { buttonClasses } from "@/app/components/ui/button";
import { BotonDiagnostico } from "./boton-diagnostico";

const fecha = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", timeZone: "America/Lima" });

export function PruebaDiagnostica({ curso, estado }: { curso: string; estado: EstadoDiagnostico }) {
  return (
    <section
      id="diagnostico"
      aria-labelledby="titulo-diagnostico"
      className="scroll-mt-24 rounded-2xl border border-line bg-panel p-6 shadow-card sm:p-8"
    >
      <h2 id="titulo-diagnostico" className="m-0 flex items-center gap-2 text-xl font-semibold text-ink">
        <Compass size={20} aria-hidden className="text-brand" /> ¿Por dónde empiezo?
      </h2>
      <Contenido curso={curso} estado={estado} />
    </section>
  );
}

function Contenido({ curso, estado }: { curso: string; estado: EstadoDiagnostico }) {
  if (estado.estado === "error") {
    return (
      <p role="status" className="mb-0 mt-3 text-sm text-muted">
        No se pudo leer tu prueba diagnóstica en este momento. Recarga la página más tarde.
      </p>
    );
  }

  if (estado.estado === "en-curso") {
    return (
      <div className="mt-3 space-y-4">
        <p className="m-0 text-[15px] leading-relaxed text-ink">Tienes la prueba diagnóstica a medias.</p>
        <Link
          className={buttonClasses({ variant: "primary" })}
          href={`/simulador?seccion=banco&attempt=${encodeURIComponent(estado.id)}`}
        >
          Continuar la prueba <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
    );
  }

  if (estado.estado === "sin-hacer") {
    return (
      <div className="mt-3 space-y-4">
        <p className="m-0 max-w-3xl text-[15px] leading-relaxed text-ink">
          Haz la prueba diagnóstica: {PREGUNTAS_DIAGNOSTICO} preguntas del banco en {MINUTOS_DIAGNOSTICO} minutos, cinco
          por competencia y cada una de un tema distinto. Al terminar te decimos qué clases estudiar primero según lo que
          falles y cuánto pesa en el examen.
        </p>
        <BotonDiagnostico texto="Hacer la prueba diagnóstica" />
      </div>
    );
  }

  const r = estado.resultado;
  return (
    <div className="mt-3 space-y-5">
      <p className="m-0 text-[15px] leading-relaxed text-ink">
        En tu prueba del {fecha.format(new Date(estado.fecha))} acertaste{" "}
        <strong className="tabular-nums">
          {r.aciertos} de {r.total}
        </strong>
        .
      </p>

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        {r.competencias.map((c) => {
          const pct = c.total ? Math.round((c.aciertos / c.total) * 100) : 0;
          return (
            <li key={c.codigo} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{c.titulo}</span>
                <span className="tabular-nums text-muted">
                  {c.aciertos}/{c.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`Aciertos en ${c.titulo}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft"
              >
                {/* Ancho dinámico: es el dato, no un estilo fijo. */}
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {r.recomendadas.length ? (
        <div>
          <h3 className="m-0 text-base font-semibold text-ink">Empieza por estas clases</h3>
          <p className="mb-3 mt-1 text-sm text-muted">
            Enseñan los temas que fallaste, primero los que más preguntas tienen en el examen.
          </p>
          <ol className="m-0 list-none space-y-2 p-0">
            {r.recomendadas.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/cursos/${curso}/${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 no-underline outline-none hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      Módulo {c.modulo} · {c.titulo}
                    </span>
                    <span className="block text-xs text-muted">
                      {c.temas.map((t) => `Tema ${t} · ${temaExamen(t)?.label ?? ""}`).join(" — ")}
                    </span>
                  </span>
                  <ArrowRight size={17} aria-hidden className="shrink-0 text-brand" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="m-0 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
          No fallaste ningún tema. Sigue el orden del curso o mide tu ritmo con el simulacro completo.
        </p>
      )}

      <BotonDiagnostico texto="Repetir la prueba" variante="secondary" />
    </div>
  );
}
