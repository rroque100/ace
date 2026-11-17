import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookA, ClipboardCheck, FileText, Target } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import {
  buscarClase, buscarCurso, clasesEnOrden, hrefBaseLegal, textoBaseLegal, vecinas, vistaProgreso,
} from "@/lib/cursos/catalogo";
import { comentariosParaPagina } from "@/lib/cursos/comentarios-server";
import { progresoParaPagina } from "@/lib/cursos/progreso-server";
import { temasDeClase, textoPeso } from "@/lib/cursos/temario-examen";
import { hrefPracticarTema } from "@/lib/simulador-navegacion";
import type { Clase } from "@/lib/cursos/tipos";
import { buttonClasses } from "@/app/components/ui/button";
import { AppShell } from "../../../components/app-shell";
import { AvisoProgreso } from "../../../components/cursos/barra-avance";
import { BarraClase } from "../../../components/cursos/barra-clase";
import { BotonCompletar } from "../../../components/cursos/boton-completar";
import { ComentariosClase } from "../../../components/cursos/comentarios-clase";
import { ReproductorMaqueta } from "../../../components/cursos/reproductor-maqueta";
import { PanelDudas } from "../../../components/cursos/panel-dudas";
import { PestanasClase } from "../../../components/cursos/pestanas-clase";

function urlVideo(clase: Clase): string | null {
  const v = clase.video;
  if (!v) return null;
  if (v.proveedor === "vimeo") {
    return `https://player.vimeo.com/video/${encodeURIComponent(v.id)}${v.hash ? `?h=${encodeURIComponent(v.hash)}` : ""}`;
  }
  // youtube-nocookie: no deja cookies de seguimiento hasta que la persona reproduce el vídeo.
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}`;
}

// Fuera del componente: leer el reloj es impuro. Es la hora con la que el servidor pinta «Hace 3 min», y el cliente
// arranca con la misma para que no cambie al hidratar.
const ahoraDelServidor = () => Date.now();

export async function generateMetadata({ params }: { params: Promise<{ curso: string; clase: string }> }) {
  const { curso: slugCurso, clase: slugClase } = await params;
  const curso = buscarCurso(slugCurso);
  const clase = curso ? buscarClase(curso, slugClase)?.clase : null;
  return { title: clase ? `${clase.titulo} · Cursos` : "Cursos" };
}

// Página de una clase: reproductor, Resumen | Base legal, a la derecha dudas y comentarios, y al pie la barra con
// «Clases» (panel «Progreso del curso»), anterior y «Siguiente clase».
export default async function ClasePage({ params }: { params: Promise<{ curso: string; clase: string }> }) {
  const [{ curso: slugCurso, clase: slugClase }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cursos/${slugCurso}/${slugClase}`)}`);
  const curso = buscarCurso(slugCurso);
  const encontrada = curso ? buscarClase(curso, slugClase) : null;
  if (!curso || !encontrada) notFound();

  const { clase, seccion, numero } = encontrada;
  const total = clasesEnOrden(curso).length;
  const { anterior, siguiente } = vecinas(curso, clase.slug);
  const [progreso, comentarios] = await Promise.all([
    progresoParaPagina(user.accessToken, curso.slug),
    comentariosParaPagina(user.accessToken, curso.slug, clase.slug, user.id, user.isAdmin),
  ]);
  const completadas = new Set(progreso.completadas);
  const completada = completadas.has(clase.slug);
  // Mismo criterio que el simulador: una cuenta externa sin Centro Jurídico no puede abrir el chat ni el lector de normas.
  const centroJuridico = !user.esExterno || user.modulosExternos.includes("centro_juridico");
  const ultimaDeSeccion = seccion.clases.at(-1)?.slug === clase.slug;
  const puntoControl = seccion.puntoControl;
  const temas = temasDeClase(clase);
  const video = urlVideo(clase);

  return (
    <AppShell
      active="cursos"
      eyebrow={`Clase ${numero} de ${total} · ${seccion.titulo}`}
      title={`${clase.titulo}`}
      showFiscalYear={false}
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href={`/cursos/${curso.slug}`}>
          <ArrowLeft size={17} aria-hidden /> Temario
        </Link>
      }
    >
      <div className="tw mx-auto max-w-[1200px] pb-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-5">
            {video ? (
              <div className="aspect-video overflow-hidden rounded-2xl border border-line bg-surface">
                <iframe
                  src={video}
                  title={`Vídeo de la clase: ${clase.titulo}`}
                  className="size-full"
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <ReproductorMaqueta modulo={clase.modulo} titulo={clase.titulo} minutos={clase.minutos} />
            )}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="m-0 max-w-2xl text-[15px] leading-relaxed text-muted">{clase.descripcion}</p>
              <BotonCompletar
                key={`${clase.slug}-${completada}`}
                curso={curso.slug}
                clase={clase.slug}
                completadaInicial={completada}
                disponible={progreso.estado === "ok"}
              />
            </div>
            <AvisoProgreso estado={progreso.estado} />

            {/* Cuánto pesa lo que se estudia aquí en el examen: el mismo reparto que usa el simulacro de 72 preguntas. */}
            <div className="rounded-2xl border border-line bg-panel px-4 py-3 shadow-card">
              <p className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
                <Target size={15} aria-hidden /> {temas.length ? "En el examen de certificación" : "Fuera del temario del examen"}
              </p>
              {temas.length ? (
                <ul className="m-0 mt-2 list-none space-y-1 p-0">
                  {temas.map((t) => (
                    <li key={t.code} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="text-ink">
                        <span className="text-muted">Tema {t.code} · </span>
                        {t.label}
                      </span>
                      <span className="flex items-baseline gap-3">
                        <span className="font-semibold tabular-nums text-ink">{textoPeso(t.quota)}</span>
                        <Link
                          href={hrefPracticarTema(t.code)}
                          className="text-sm font-semibold text-brand underline"
                          aria-label={`Practicar el tema ${t.code} en el banco de preguntas`}
                        >
                          Practicar
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-0 mt-1 text-sm text-muted">
                  Material de apoyo: el temario oficial no lo evalúa como tema propio. Prioriza las clases de las
                  competencias si preparas el examen.
                </p>
              )}
              {curso.slug === "certificacion-oece" && (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  <Link
                    href={`/cursos/${curso.slug}/ficha`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline"
                  >
                    <FileText size={15} aria-hidden /> Ficha de plazos y cifras del examen
                  </Link>
                  <Link
                    href={`/cursos/${curso.slug}/glosario`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline"
                  >
                    <BookA size={15} aria-hidden /> Glosario de siglas
                  </Link>
                </div>
              )}
            </div>

            <PestanasClase
              contenido={clase.contenido}
              referencias={clase.contenido.baseLegal.map((b) => ({
                texto: textoBaseLegal(b),
                href: centroJuridico ? hrefBaseLegal(b) : null,
              }))}
            />

            {ultimaDeSeccion && puntoControl && (
              <Link
                href={puntoControl.href}
                className="flex items-center gap-4 rounded-2xl border border-brand bg-brand-soft p-5 text-ink no-underline outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                <ClipboardCheck size={26} aria-hidden className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Terminaste la sección «{seccion.titulo}». {puntoControl.titulo}</span>
                  <span className="block text-sm text-muted">{puntoControl.descripcion}</span>
                </span>
                <ArrowRight size={18} aria-hidden className="shrink-0 text-brand" />
              </Link>
            )}
          </div>

          {/* Navegación entre clases y temario: en la barra del pie y su panel «Progreso del curso». */}
          <aside className="min-w-0 space-y-5" aria-label="Dudas y comentarios">
            {centroJuridico && <PanelDudas tema={`Módulo ${clase.modulo} · ${clase.titulo}`} />}
            <ComentariosClase
              key={clase.slug}
              curso={curso.slug}
              clase={clase.slug}
              inicial={comentarios}
              ahoraInicial={ahoraDelServidor()}
            />
          </aside>
        </div>
      </div>
      <BarraClase
        key={`${clase.slug}-${completada}`}
        curso={{ slug: curso.slug, titulo: curso.titulo }}
        clase={{ slug: clase.slug, titulo: clase.titulo }}
        numero={numero}
        anterior={anterior && { slug: anterior.slug, titulo: anterior.titulo }}
        siguiente={siguiente && { slug: siguiente.slug, titulo: siguiente.titulo }}
        examen={{ titulo: curso.examenFinal.titulo, href: curso.examenFinal.href }}
        progreso={vistaProgreso(curso, completadas, clase.slug)}
        completada={completada}
        guardado={progreso.estado === "ok"}
      />
    </AppShell>
  );
}
