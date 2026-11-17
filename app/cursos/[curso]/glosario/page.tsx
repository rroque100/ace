import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { buscarCurso, hrefBaseLegal, textoBaseLegal } from "@/lib/cursos/catalogo";
import { GLOSARIO } from "@/lib/cursos/glosario";
import { buttonClasses } from "@/app/components/ui/button";
import { AppShell } from "../../../components/app-shell";
import { BotonImprimir } from "../../../components/cursos/boton-imprimir";

export const metadata = { title: "Glosario de siglas · Cursos" };

// Glosario imprimible de las siglas que usa el curso, con la del Art. 3.1 del Reglamento como base
// (lib/cursos/glosario.ts). Ruta estática dentro de [curso], como la ficha: Next la prefiere a [clase].
export default async function GlosarioPage({ params }: { params: Promise<{ curso: string }> }) {
  const [{ curso: slug }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cursos/${slug}/glosario`)}`);
  const curso = buscarCurso(slug);
  if (!curso || curso.slug !== "certificacion-oece") notFound();
  const centroJuridico = !user.esExterno || user.modulosExternos.includes("centro_juridico");

  return (
    <AppShell
      active="cursos"
      eyebrow={curso.titulo}
      title="Glosario de siglas"
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
            Las siglas que el examen da por sabidas. La mayoría son las que fija el Art. 3.1 del Reglamento; las demás
            indican dónde las define la norma o, si no las define, que son abreviaturas del curso. Ojo con las del régimen
            anterior: hoy es OECE (no OSCE), Pladicop y Tribunal de Contrataciones Públicas (TCP).
          </p>
          <BotonImprimir />
        </div>

        <section aria-label="Siglas" className="rounded-2xl border border-line bg-panel shadow-card print:shadow-none">
          <dl className="m-0 divide-y divide-line">
            {GLOSARIO.map((s) => (
              <div
                key={s.sigla}
                className="grid break-inside-avoid gap-1 px-5 py-2.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-sm font-semibold text-ink">{s.sigla}</dt>
                <dd className="m-0 text-sm leading-relaxed text-ink">
                  {s.significado}
                  <span className="mt-0.5 block text-xs text-muted">
                    {s.fuente ? (
                      centroJuridico ? (
                        <a href={hrefBaseLegal(s.fuente)} className="text-brand underline print:text-muted print:no-underline">
                          {textoBaseLegal(s.fuente)}
                        </a>
                      ) : (
                        textoBaseLegal(s.fuente)
                      )
                    ) : (
                      "Abreviatura del curso; la norma no la define como sigla."
                    )}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="m-0 text-xs leading-relaxed text-muted">
          Reglamento de la Ley 32069 (texto actualizado al 09.01.2026), Art. 3.1.
        </p>
      </div>
    </AppShell>
  );
}
