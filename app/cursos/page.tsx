import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, GraduationCap, ListChecks } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { CURSOS, avance, clasesEnOrden, duracionTotal, formatoDuracion } from "@/lib/cursos/catalogo";
import { progresoParaPagina } from "@/lib/cursos/progreso-server";
import { AppShell } from "../components/app-shell";
import { BarraAvance } from "../components/cursos/barra-avance";

export const metadata = { title: "Cursos" };

export default async function CursosPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fcursos");
  const progresos = await Promise.all(CURSOS.map((c) => progresoParaPagina(user.accessToken, c.slug)));

  return (
    <AppShell active="cursos" eyebrow="Formación en contratación pública" title="Cursos" showFiscalYear={false}>
      <div className="tw mx-auto max-w-5xl pb-6">
        <p className="mb-6 mt-0 max-w-3xl text-base leading-relaxed text-muted">
          Estudia la norma por clases, con su base legal, y practica cada sección en el simulador.
        </p>
        <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2">
          {CURSOS.map((curso, i) => {
            const a = avance(curso, new Set(progresos[i].completadas));
            return (
              <li key={curso.slug}>
                <Link
                  href={`/cursos/${curso.slug}`}
                  className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-6 text-ink no-underline shadow-card outline-none transition-colors hover:border-brand focus-visible:shadow-[var(--shadow-focus)]"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <GraduationCap size={26} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xl font-semibold leading-snug">{curso.titulo}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-muted">{curso.descripcion}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks size={16} aria-hidden /> {clasesEnOrden(curso).length} clases
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={16} aria-hidden /> {formatoDuracion(duracionTotal(curso))}
                    </span>
                    <span>{curso.nivel}</span>
                  </span>
                  <span className="mt-auto block">
                    {a.hechas > 0 && (
                      <span className="mb-4 block">
                        <BarraAvance {...a} />
                      </span>
                    )}
                    <span className="inline-flex items-center gap-2 font-semibold text-brand">
                      {a.hechas > 0 ? "Continuar" : "Empezar"}
                      <ArrowRight size={17} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
