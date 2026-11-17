// Temario de un curso: secciones, clases numeradas de forma correlativa y el punto de control de cada sección.
// Sin "use client": solo pinta enlaces y lo usan tanto la portada del curso como la columna de la clase.
import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardCheck, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { clasesEnOrden, formatoDuracion } from "@/lib/cursos/catalogo";
import type { Curso } from "@/lib/cursos/tipos";

export function TemarioCurso({
  curso,
  completadas,
  claseActual,
  compacto = false,
}: {
  curso: Curso;
  completadas: readonly string[];
  claseActual?: string;
  compacto?: boolean;
}) {
  const hechas = new Set(completadas);
  const numero = new Map(clasesEnOrden(curso).map((c, i) => [c.slug, i + 1]));

  return (
    <nav aria-label={`Temario de ${curso.titulo}`} className={cn("space-y-6", compacto && "space-y-1")}>
      {curso.secciones.map((seccion) => {
        const hechasSeccion = seccion.clases.filter((c) => hechas.has(c.slug)).length;
        const cabecera = (
          <>
            <span id={`seccion-${seccion.slug}`} className={cn("font-semibold text-ink", compacto ? "text-sm" : "text-lg")}>
              {seccion.titulo}
            </span>
            <span className="shrink-0 text-xs font-normal text-muted">
              {hechasSeccion}/{seccion.clases.length} clases
            </span>
          </>
        );
        const lista = (
            <ol className="m-0 list-none space-y-1 p-0">
              {seccion.clases.map((clase) => {
                const actual = clase.slug === claseActual;
                const completada = hechas.has(clase.slug);
                const Icono = completada ? CheckCircle2 : actual ? PlayCircle : Circle;
                return (
                  <li key={clase.slug}>
                    <Link
                      href={`/cursos/${curso.slug}/${clase.slug}`}
                      aria-current={actual ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-ink no-underline transition-colors",
                        "outline-none hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]",
                        actual && "bg-brand-soft hover:bg-brand-soft",
                      )}
                    >
                      <span className={cn("w-6 shrink-0 text-right text-sm tabular-nums text-muted", compacto && "hidden")}>
                        {numero.get(clase.slug)}
                      </span>
                      <Icono
                        size={18}
                        aria-hidden
                        className={cn("shrink-0", completada ? "text-success" : actual ? "text-brand" : "text-placeholder")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-medium leading-snug", compacto ? "text-sm" : "text-[15px]")}>
                          <span className="text-muted">Módulo {clase.modulo} · </span>
                          {clase.titulo}
                        </span>
                        {!clase.contenido.verificada && (
                          <span className="mt-1 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                            En revisión
                          </span>
                        )}
                      </span>
                      {!compacto && <span className="shrink-0 text-sm text-muted">{formatoDuracion(clase.minutos)}</span>}
                      {completada && <span className="sr-only">(completada)</span>}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href={seccion.puntoControl.href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2 text-ink no-underline",
                    "outline-none hover:border-brand hover:bg-surface focus-visible:shadow-[var(--shadow-focus)]",
                    !compacto && "mt-2",
                  )}
                >
                  <span className={cn("w-6 shrink-0", compacto && "hidden")} aria-hidden />
                  <ClipboardCheck size={18} aria-hidden className="shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-semibold", compacto ? "text-sm" : "text-[15px]")}>{seccion.puntoControl.titulo}</span>
                    {!compacto && <span className="block text-sm text-muted">{seccion.puntoControl.descripcion}</span>}
                  </span>
                </Link>
              </li>
            </ol>
        );

        // En la columna de la clase, las secciones se pliegan y solo se abre la de la clase actual: con 18 clases a la
        // vista, la actual quedaba fuera de pantalla. <details> nativo: sin JS y accesible por teclado.
        if (compacto) {
          return (
            <details key={seccion.slug} open={seccion.clases.some((c) => c.slug === claseActual)} className="group/seccion">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 outline-none hover:bg-surface focus-visible:shadow-[var(--shadow-focus)] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <ChevronRight size={16} aria-hidden className="shrink-0 text-muted transition-transform group-open/seccion:rotate-90" />
                  {cabecera}
                </span>
              </summary>
              <div className="mt-1">{lista}</div>
            </details>
          );
        }
        return (
          <section key={seccion.slug} aria-labelledby={`seccion-${seccion.slug}`}>
            <h3 className="mb-2 mt-0 flex items-baseline justify-between gap-3">{cabecera}</h3>
            {lista}
          </section>
        );
      })}
    </nav>
  );
}
