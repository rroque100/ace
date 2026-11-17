import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, ClipboardCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import {
  avance, buscarClase, buscarCurso, clasesEnOrden, hrefBaseLegal, textoBaseLegal, vecinas,
} from "@/lib/cursos/catalogo";
import { comentariosParaPagina } from "@/lib/cursos/comentarios-server";
import { progresoParaPagina } from "@/lib/cursos/progreso-server";
import type { Clase } from "@/lib/cursos/tipos";
import { buttonClasses } from "@/app/components/ui/button";
import { AppShell } from "../../../components/app-shell";
import { AvisoProgreso, BarraAvance } from "../../../components/cursos/barra-avance";
import { BotonCompletar } from "../../../components/cursos/boton-completar";
import { ComentariosClase } from "../../../components/cursos/comentarios-clase";
import { ReproductorMaqueta } from "../../../components/cursos/reproductor-maqueta";
import { PanelDudas } from "../../../components/cursos/panel-dudas";
import { PestanasClase } from "../../../components/cursos/pestanas-clase";
import { TemarioCurso } from "../../../components/cursos/temario-curso";

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

// Página de una clase: reproductor (o portada de lectura), Resumen | Base legal, y a la derecha las dudas y el temario.
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
  const a = avance(curso, new Set(progreso.completadas));
  // Mismo criterio que el simulador: una cuenta externa sin Centro Jurídico no puede abrir el chat ni el lector de normas.
  const centroJuridico = !user.esExterno || user.modulosExternos.includes("centro_juridico");
  const ultimaDeSeccion = seccion.clases.at(-1)?.slug === clase.slug;
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
                key={`${clase.slug}-${progreso.completadas.includes(clase.slug)}`}
                curso={curso.slug}
                clase={clase.slug}
                completadaInicial={progreso.completadas.includes(clase.slug)}
                disponible={progreso.estado === "ok"}
              />
            </div>
            <AvisoProgreso estado={progreso.estado} />

            <PestanasClase
              contenido={clase.contenido}
              referencias={clase.contenido.baseLegal.map((b) => ({
                texto: textoBaseLegal(b),
                href: centroJuridico ? hrefBaseLegal(b) : null,
              }))}
            />

            {ultimaDeSeccion && (
              <Link
                href={seccion.puntoControl.href}
                className="flex items-center gap-4 rounded-2xl border border-brand bg-brand-soft p-5 text-ink no-underline outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                <ClipboardCheck size={26} aria-hidden className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Terminaste la sección «{seccion.titulo}». {seccion.puntoControl.titulo}</span>
                  <span className="block text-sm text-muted">{seccion.puntoControl.descripcion}</span>
                </span>
                <ArrowRight size={18} aria-hidden className="shrink-0 text-brand" />
              </Link>
            )}

            <nav aria-label="Clases" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              {anterior ? (
                <Link className={buttonClasses({ variant: "secondary" })} href={`/cursos/${curso.slug}/${anterior.slug}`}>
                  <ArrowLeft size={17} aria-hidden /> <span className="sr-only">Clase anterior: </span>Anterior
                </Link>
              ) : (
                <span />
              )}
              {siguiente ? (
                <Link className={buttonClasses({ variant: "primary" })} href={`/cursos/${curso.slug}/${siguiente.slug}`}>
                  Siguiente clase <span className="sr-only">: {siguiente.titulo}</span>
                  <ArrowRight size={17} aria-hidden />
                </Link>
              ) : (
                <Link className={buttonClasses({ variant: "primary" })} href={curso.examenFinal.href}>
                  <BookOpenCheck size={17} aria-hidden /> {curso.examenFinal.titulo}
                </Link>
              )}
            </nav>
          </div>

          <aside className="min-w-0 space-y-5" aria-label="Dudas y temario">
            {centroJuridico && <PanelDudas tema={`Módulo ${clase.modulo} · ${clase.titulo}`} />}
            <ComentariosClase
              key={clase.slug}
              curso={curso.slug}
              clase={clase.slug}
              inicial={comentarios}
              ahoraInicial={ahoraDelServidor()}
            />
            <div className="rounded-2xl border border-line bg-panel p-4 shadow-card">
              <p className="mb-1 mt-0 text-sm font-semibold text-ink">{curso.titulo}</p>
              {progreso.estado === "ok" && (
                <div className="mb-4 mt-3">
                  <BarraAvance {...a} />
                </div>
              )}
              <TemarioCurso curso={curso} completadas={progreso.completadas} claseActual={clase.slug} compacto />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
