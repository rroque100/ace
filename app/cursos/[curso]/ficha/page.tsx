import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { buscarCurso, hrefBaseLegal, textoBaseLegal } from "@/lib/cursos/catalogo";
import { FICHA_CIFRAS } from "@/lib/cursos/ficha-cifras";
import { preguntasCompetencia, textoPeso } from "@/lib/cursos/temario-examen";
import { buttonClasses } from "@/app/components/ui/button";
import { AppShell } from "../../../components/app-shell";
import { BotonImprimir } from "../../../components/cursos/boton-imprimir";

export const metadata = { title: "Ficha de plazos y cifras · Cursos" };

// Ficha de repaso: los plazos, porcentajes y topes que más se confunden en el examen, en una sola página imprimible.
// Los datos salen de lib/cursos/ficha-cifras.ts, donde cada uno está atado a su clase y a su artículo.
// Ruta estática dentro de [curso]: Next la prefiere a [clase], así que «ficha» no puede chocar con una clase.
export default async function FichaPage({ params }: { params: Promise<{ curso: string }> }) {
  const [{ curso: slug }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cursos/${slug}/ficha`)}`);
  // La ficha es del curso OECE: los datos son de la Ley 32069 y su Reglamento.
  const curso = buscarCurso(slug);
  if (!curso || curso.slug !== "certificacion-oece") notFound();
  const centroJuridico = !user.esExterno || user.modulosExternos.includes("centro_juridico");

  return (
    <AppShell
      active="cursos"
      eyebrow={curso.titulo}
      title="Ficha de plazos y cifras"
      showFiscalYear={false}
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href={`/cursos/${curso.slug}`}>
          <ArrowLeft size={17} aria-hidden /> Curso
        </Link>
      }
    >
      <div className="tw mx-auto max-w-4xl space-y-6 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="m-0 max-w-2xl text-[15px] leading-relaxed text-muted">
            Lo que más se confunde en el examen: días, porcentajes y topes, ordenados por competencia. Cada dato sale de
            una clase del curso y está contrastado con el texto vigente de la norma.
          </p>
          <BotonImprimir />
        </div>

        {FICHA_CIFRAS.map((grupo) => (
          <section
            key={grupo.titulo}
            aria-labelledby={`ficha-${grupo.titulo}`}
            className="break-inside-avoid-page rounded-2xl border border-line bg-panel shadow-card print:shadow-none"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
              <h2 id={`ficha-${grupo.titulo}`} className="m-0 text-lg font-semibold text-ink">
                {grupo.competencia ? `Competencia ${grupo.competencia} · ` : ""}
                {grupo.titulo}
              </h2>
              <span className="text-xs text-muted">
                {grupo.competencia
                  ? `${textoPeso(preguntasCompetencia(grupo.competencia))} del examen`
                  : "Fuera del temario del examen"}
              </span>
            </header>
            <dl className="m-0 divide-y divide-line">
              {grupo.datos.map((d) => (
                <div key={d.tema} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-sm font-semibold text-ink">{d.tema}</dt>
                  <dd className="m-0 text-sm leading-relaxed text-ink">
                    {d.dato}
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      {d.base.map((b) =>
                        centroJuridico ? (
                          <a key={textoBaseLegal(b)} href={hrefBaseLegal(b)} className="text-brand underline print:text-muted print:no-underline">
                            {textoBaseLegal(b)}
                          </a>
                        ) : (
                          <span key={textoBaseLegal(b)}>{textoBaseLegal(b)}</span>
                        ),
                      )}
                      <Link href={`/cursos/${curso.slug}/${d.clase}`} className="text-muted underline print:hidden">
                        Ver la clase
                      </Link>
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <p className="m-0 text-xs leading-relaxed text-muted">
          Ley 32069 (texto actualizado al 19.07.2026) y su Reglamento (texto actualizado al 09.01.2026). Antes de citar un
          dato en un documento, comprueba la versión vigente en el lector de normas.
        </p>
      </div>
    </AppShell>
  );
}
