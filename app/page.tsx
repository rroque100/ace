import Link from "next/link";
import { ArrowRight, Bot, BookOpenCheck, FileSearch, Library, ClipboardList, Briefcase, FileText, Bookmark, ShieldCheck, UploadCloud } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "./components/app-shell";
import { getSessionUser, puedeUsarProcesos } from "@/lib/auth";
import { workspaceNavigation } from "@/lib/workspace-navigation";
import { supabaseRest } from "@/lib/supabase-server";

const TASKS = [
  { href:"/chat", title:"Haz una consulta jurídica", description:"Explica tu caso y consulta la respuesta junto a sus fuentes.", icon:Bot, label:"Abrir Chat", tag:"Comprender" },
  { href:"/busqueda", title:"Encuentra un documento", description:"Busca por palabras, número o tema y abre el pasaje original.", icon:FileSearch, label:"Ir a Búsqueda", tag:"Encontrar" },
  { href:"/normas", title:"Estudia normas y criterios", description:"Lee documentos, artículos y versiones con su procedencia a la vista.", icon:Library, label:"Explorar Normativa", tag:"Comprobar" },
  { href:"/simulador", title:"Prepara tu examen", description:"Practica y revisa el fundamento de cada respuesta. El banco indica qué está listo.", icon:BookOpenCheck, label:"Ver preparación", tag:"Aprender" },
];
const WORK = [
  {href:"/necesidades",title:"Necesidades",description:"Prepara y sigue los requerimientos de tu área.",icon:ClipboardList},
  {href:"/expedientes",title:"Expedientes",description:"Organiza las actuaciones de cada contratación.",icon:Briefcase},
  {href:"/contratos",title:"Contratos",description:"Prepara y revisa la documentación contractual.",icon:FileText},
  {href:"/guardado",title:"Mis fuentes",description:"Retoma tus documentos y consultas guardados.",icon:Bookmark},
  {href:"/documentos",title:"Biblioteca PDF",description:"Consulta y administra documentos según tus permisos.",icon:UploadCloud},
];
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let office: string | null = null;
  if (!user.esExterno && user.oficinaId) {
    try { office = (await supabaseRest<Array<{nombre:string}>>(`expedientes_oficinas?id=eq.${user.oficinaId}&select=nombre&limit=1`))[0]?.nombre ?? null; } catch { /* Office-restricted links stay closed. */ }
  }
  const allowed = new Set<string>(workspaceNavigation(user, puedeUsarProcesos(user,office)).flatMap(s=>s.items.map(i=>i.href)));
  const tasks = TASKS.filter(t=>allowed.has(t.href));
  const work = WORK.filter(t=>allowed.has(t.href));
  const name = user.nombreCompleto?.trim().split(/\s+/)[0];
  return <AppShell active="panel" eyebrow={user.esExterno ? "Tu espacio personal" : "Tu espacio de trabajo"} title={name ? `Hola, ${name}` : "Bienvenido a ACE"} showFiscalYear={false}>
    <div className="tw homeEnter mx-auto w-full max-w-[1240px] space-y-8">
      <section className="homeHero relative overflow-hidden rounded-[24px] p-6 sm:p-9">
        <div className="max-w-[660px]">
          <p className="homeEyebrow mb-3! text-white/75">Contrataciones públicas · Perú</p>
          <h2 className="m-0! text-[28px]! font-semibold! leading-[1.2]! tracking-tight sm:text-[36px]!">Consulta con claridad.<br/>Trabaja con respaldo.</h2>
          <p className="mt-4! max-w-[540px] text-[15px] leading-relaxed text-white/85!">Encuentra documentos, revisa sus fuentes y continúa tu trabajo.</p>
          {tasks[0] ? <Link href={tasks[0].href} className="homePrimary mt-3 inline-flex min-h-12 items-center gap-3 rounded-xl px-5 py-3 text-[14px] font-semibold no-underline">{tasks[0].label}<ArrowRight size={17} aria-hidden/></Link> : null}
        </div>
        <Library aria-hidden className="pointer-events-none absolute -right-6 bottom-6 hidden size-48 -rotate-12 text-white/10 md:block" strokeWidth={1}/>
      </section>
      <section aria-labelledby="start-title">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="start-title" className="homeSectionTitle m-0!">¿Qué necesitas hacer hoy?</h2>
          <span className="text-[13px] text-muted">Tus accesos habilitados</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tasks.map(({href,title,description,icon:Icon,label,tag})=><Link key={href} href={href} className="homeCard flex flex-col rounded-2xl border border-line bg-panel p-5 transition-[transform,border-color,box-shadow] duration-150">
            <span className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={22} aria-hidden/></span><span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{tag}</span></span>
            <h3 className="homeGridTitle m-0!">{title}</h3><p className="homeGridCopy mt-2! mb-6!">{description}</p>
            <span className="mt-auto flex items-center gap-2 text-[13px] font-semibold text-brand-dark">{label}<ArrowRight size={15} aria-hidden/></span>
          </Link>)}
        </div>
      </section>
      {work.length > 0 ? <section aria-labelledby="work-title">
        <h2 id="work-title" className="homeSectionTitle m-0! mb-5!">Continúa tu trabajo</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{work.map(({href,title,description,icon:Icon})=><Link href={href} key={href} className="homeCard flex items-start gap-4 rounded-2xl border border-line bg-panel p-5 transition-[transform,border-color] duration-150"><Icon size={21} className="mt-1 shrink-0 text-brand" aria-hidden/><div><h3 className="homeGridTitle m-0! text-[15px]!">{title}</h3><p className="homeGridCopy m-0! mt-1!">{description}</p></div></Link>)}</div>
      </section> : null}
      <section className="grid gap-5 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-[auto_1fr] sm:p-6" aria-labelledby="guide-title">
        <ShieldCheck size={25} className="text-brand" aria-hidden/><div><h2 id="guide-title" className="homeGridTitle m-0!">Trabaja con la fuente a la vista</h2><p className="homeGridCopy mt-2! mb-0!">Búsqueda te ayuda a encontrar; Normativa, a leer y comprobar; Chat, a comprender. Revisa siempre el régimen, la versión y la aplicación al caso antes de tomar una decisión.</p></div>
      </section>
      <p className="text-center text-[12px] leading-relaxed text-muted">ACE · Un espacio de apoyo para estudiar y trabajar. La asistencia de IA puede contener errores.</p>
    </div>
  </AppShell>;
}
