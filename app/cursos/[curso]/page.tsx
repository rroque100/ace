import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookA, BookOpenCheck, Clock, FileText, GraduationCap, ListChecks, PlayCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { avance, buscarCurso, claseParaSeguir, clasesEnOrden, duracionTotal, formatoDuracion } from "@/lib/cursos/catalogo";
import { diagnosticoParaPagina } from "@/lib/cursos/diagnostico-server";
import { progresoParaPagina } from "@/lib/cursos/progreso-server";
import { PREGUNTAS_EXAMEN } from "@/lib/cursos/temario-examen";
import { buttonClasses } from "@/app/components/ui/button";
import { AppShell } from "../../components/app-shell";
import { AvisoProgreso, BarraAvance } from "../../components/cursos/barra-avance";
import { PruebaDiagnostica } from "../../components/cursos/prueba-diagnostica";
import { TemarioCurso } from "../../components/cursos/temario-curso";

export async function generateMetadata({ params }: { params: Promise<{ curso: string }> }) {
  return { title: buscarCurso((await params).curso)?.titulo ?? "Cursos" };
}

// Portada del curso: cabecera con los datos del curso y el botón para seguir, y debajo el temario completo.
export default async function CursoPage({ params }: { params: Promise<{ curso: string }> }) {
  const [{ curso: slug }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cursos/${slug}`)}`);
  const curso = buscarCurso(slug);
  if (!curso) notFound();

  // El diagnóstico usa el banco del simulador, que es del examen OECE: otros cursos no lo tienen.
  const conDiagnostico = curso.slug === "certificacion-oece";
  const [progreso, diagnostico] = await Promise.all([
    progresoParaPagina(user.accessToken, curso.slug),
    conDiagnostico ? diagnosticoParaPagina(user.id, curso) : null,
  ]);
  const completadas = new Set(progreso.completadas);
  const a = avance(curso, completadas);
  const seguir = claseParaSeguir(curso, completadas);
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted";

  return (
    <AppShell
      active="cursos"
      eyebrow="Curso · Formación en contratación pública"
      title={curso.titulo}
      showFiscalYear={false}
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/cursos">
          <ArrowLeft size={17} aria-hidden /> Cursos
        </Link>
      }
    >
      <div className="tw mx-auto max-w-5xl space-y-8 pb-6">
        <section className="rounded-2xl border border-line bg-panel p-6 shadow-card sm:p-8">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            <li className={chip}>
              <GraduationCap size={16} aria-hidden /> Nivel {curso.nivel.toLowerCase()}
            </li>
            <li className={chip}>
              <ListChecks size={16} aria-hidden /> {clasesEnOrden(curso).length} clases
            </li>
            <li className={chip}>
              <Clock size={16} aria-hidden /> {formatoDuracion(duracionTotal(curso))} de lectura
            </li>
            <li className={chip}>
              <BookOpenCheck size={16} aria-hidden /> Temario oficial del examen · {PREGUNTAS_EXAMEN} preguntas
            </li>
          </ul>
          <p className="mb-0 mt-5 max-w-3xl text-base leading-relaxed text-ink">{curso.descripcion}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link className={buttonClasses({ variant: "primary", size: "lg" })} href={`/cursos/${curso.slug}/${seguir.slug}`}>
              <PlayCircle size={19} aria-hidden />
              {a.hechas === 0 ? "Empezar el curso" : a.hechas === a.total ? "Repasar desde el inicio" : "Continuar"}
            </Link>
            <Link className={buttonClasses({ variant: "secondary", size: "lg" })} href={curso.examenFinal.href}>
              {curso.examenFinal.titulo}
            </Link>
            {curso.slug === "certificacion-oece" && (
              <Link className={buttonClasses({ variant: "ghost", size: "lg" })} href={`/cursos/${curso.slug}/ficha`}>
                <FileText size={18} aria-hidden /> Ficha de plazos y cifras
              </Link>
            )}
            {curso.slug === "certificacion-oece" && (
              <Link className={buttonClasses({ variant: "ghost", size: "lg" })} href={`/cursos/${curso.slug}/glosario`}>
                <BookA size={18} aria-hidden /> Glosario de siglas
              </Link>
            )}
          </div>
          {a.hechas > 0 && a.hechas < a.total && (
            <p className="mb-0 mt-3 text-sm text-muted">
              Sigues en: Módulo {seguir.modulo} · {seguir.titulo}
            </p>
          )}

          <div className="mt-6 space-y-3 border-t border-line pt-5">
            {progreso.estado === "ok" && <BarraAvance {...a} />}
            <AvisoProgreso estado={progreso.estado} />
          </div>
        </section>

        {diagnostico && <PruebaDiagnostica curso={curso.slug} estado={diagnostico} />}

        <section aria-labelledby="titulo-temario">
          <h2 id="titulo-temario" className="mb-4 mt-0 text-xl font-semibold text-ink">
            Temario
          </h2>
          <div className="rounded-2xl border border-line bg-panel p-3 shadow-card sm:p-5">
            <TemarioCurso curso={curso} completadas={progreso.completadas} />
            <Link
              href={curso.examenFinal.href}
              className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-soft px-4 font-semibold text-brand no-underline outline-none hover:bg-brand/15 focus-visible:shadow-[var(--shadow-focus)]"
            >
              <BookOpenCheck size={18} aria-hidden /> {curso.examenFinal.titulo}: {curso.examenFinal.descripcion}
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
