// Temario de la portada del curso: competencias del examen con su peso, clases numeradas de forma correlativa con el
// tema oficial que trabajan, y la práctica de cada competencia. Dentro de una clase, el temario vive en el panel
// «Progreso del curso» de la barra del pie (barra-clase.tsx). Sin "use client": solo pinta enlaces.
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { clasesEnOrden, formatoDuracion } from "@/lib/cursos/catalogo";
import { preguntasCompetencia, temasDeClase, textoPeso } from "@/lib/cursos/temario-examen";
import type { Curso } from "@/lib/cursos/tipos";

/**
 * `sigue`: la clase por la que va la persona (la primera sin completar). Solo se marca cuando ya empezó y no terminó:
 * al principio «empieza aquí» sería la clase 1, que ya es obvio, y al final no hay por dónde seguir.
 */
export function TemarioCurso({ curso, completadas, sigue }: { curso: Curso; completadas: readonly string[]; sigue?: string }) {
  const hechas = new Set(completadas);
  const numero = new Map(clasesEnOrden(curso).map((c, i) => [c.slug, i + 1]));

  return (
    <nav aria-label={`Temario de ${curso.titulo}`} className="space-y-8">
      {curso.secciones.map((seccion) => {
        const hechasSeccion = seccion.clases.filter((c) => hechas.has(c.slug)).length;
        return (
          <section key={seccion.slug} aria-labelledby={`seccion-${seccion.slug}`}>
            <h3 className="mb-1 mt-0 flex items-baseline justify-between gap-3">
              <span id={`seccion-${seccion.slug}`} className="text-lg font-semibold text-ink">
                {seccion.competencia ? `Competencia ${seccion.competencia} · ` : ""}
                {seccion.titulo}
              </span>
              <span className="shrink-0 text-xs font-normal text-muted">
                {hechasSeccion}/{seccion.clases.length} clases
              </span>
            </h3>
            <p className="mb-3 mt-0 text-sm text-muted">
              {seccion.competencia
                ? `${textoPeso(preguntasCompetencia(seccion.competencia))} del examen.`
                : "Material de apoyo: el temario oficial del examen no lo evalúa como tema propio."}
            </p>
            <ol className="m-0 list-none space-y-1 p-0">
              {seccion.clases.map((clase) => {
                const completada = hechas.has(clase.slug);
                const Icono = completada ? CheckCircle2 : Circle;
                const [principal] = temasDeClase(clase);
                const esSiguiente = clase.slug === sigue;
                return (
                  <li key={clase.slug}>
                    <Link
                      href={`/cursos/${curso.slug}/${clase.slug}`}
                      aria-current={esSiguiente ? "step" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-ink no-underline transition-colors",
                        "outline-none hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]",
                        esSiguiente && "bg-brand-soft ring-1 ring-brand",
                      )}
                    >
                      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">{numero.get(clase.slug)}</span>
                      <Icono size={18} aria-hidden className={cn("shrink-0", completada ? "text-success" : "text-placeholder")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium leading-snug">
                          <span className="text-muted">Módulo {clase.modulo} · </span>
                          {clase.titulo}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {principal && (
                            <span
                              className="inline-block rounded-full bg-surface px-2 py-0.5 text-xs text-muted"
                              title={principal.label}
                            >
                              Tema {principal.code} · {textoPeso(principal.quota)}
                            </span>
                          )}
                          {esSiguiente && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">
                              <PlayCircle size={12} aria-hidden /> Sigues aquí
                            </span>
                          )}
                          {!clase.contenido.verificada && (
                            <span className="inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                              En revisión
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-muted">
                        {completada ? <span className="font-semibold text-success">Completado</span> : formatoDuracion(clase.minutos)}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {seccion.puntoControl && (
                <li>
                  <Link
                    href={seccion.puntoControl.href}
                    className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2 text-ink no-underline outline-none hover:border-brand hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]"
                  >
                    <span className="w-6 shrink-0" aria-hidden />
                    <ClipboardCheck size={18} aria-hidden className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{seccion.puntoControl.titulo}</span>
                      <span className="block text-sm text-muted">{seccion.puntoControl.descripcion}</span>
                    </span>
                  </Link>
                </li>
              )}
            </ol>
          </section>
        );
      })}
    </nav>
  );
}
