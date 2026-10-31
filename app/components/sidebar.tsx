"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bookmark,
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  Crown,
  FileSearch,
  FileText,
  GitCompare,
  History,
  Library,
  type LucideIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  ScrollText,
  Settings,
  ShieldCheck,
  UploadCloud,
  X,
  Menu,
  RefreshCw,
} from "lucide-react";
import type { ActiveId, IconName, NavItem } from "@/lib/navegacion";
import { BANDEJA_TOPE } from "@/lib/necesidades-bandeja";
import { etiquetaDeCuenta } from "@/lib/usuario-credencial";
import { appRoleLabel } from "@/lib/permisos-contratacion";
import type { ModuloExterno } from "@/lib/modulos-acceso";
import type { EstadoCuentaExterna } from "@/lib/cuenta-externa-estado";
import { CuentaExternaCard } from "./externo/cuenta-externa-card";
import type { sidebarIdentity } from "@/lib/workspace-navigation";
import { AppearanceControl } from "./appearance-control";
type SidebarUser = NonNullable<ReturnType<typeof sidebarIdentity>>;

const SIDEBAR_COLLAPSED_KEY = "ace-sidebar-collapsed";

// Los iconos viven aquí (cliente): `NAVEGACION` solo trae el NOMBRE, para que la
// estructura sea serializable al cruzar de AppShell (servidor) a este componente.
const ICONOS: Record<IconName, LucideIcon> = {
  RefreshCw,
  BookOpenCheck,
  Bot,
  FileSearch,
  Library,
  Archive,
  ShieldCheck,
  ScanSearch,
  GitCompare,
  ClipboardList,
  Briefcase,
  FileText,
  Bookmark,
  History,
  Bell,
  UploadCloud,
  BarChart3,
  Activity,
  ScrollText,
  Settings,
};


function userInitials(user: SidebarUser): string {
  // Del NOMBRE cuando lo hay: con las cuentas identificadas por DNI, las
  // iniciales sacadas de la cuenta serían dos cifras ("12"), que no son las
  // iniciales de nadie.
  const nombre = (user.nombreCompleto ?? "").trim();
  if (nombre) {
    const partes = nombre.split(/\s+/).filter(Boolean);
    return (partes.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
  }
  const source = etiquetaDeCuenta(user.email).split("@")[0] ?? "";
  const parts = source.split(/[._\-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]).join("");
  return (initials || source.slice(0, 2) || "?").toUpperCase();
}

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // localStorage no disponible (modo privado estricto): el colapso no persiste,
    // pero el sidebar sigue funcionando dentro de la sesión.
  }
}

export function Sidebar({
  active,
  sections,
  user,
  newsCount,
  bandejaNecesidades,
  officeName,
  scopeText,
  externo,
}: {
  active: ActiveId;
  sections: readonly { label: string; items: readonly NavItem[] }[];
  user: SidebarUser | null;
  newsCount: number;
  bandejaNecesidades: number;
  officeName: string | null;
  scopeText: string;
  /** Solo para cuentas externas: sus módulos y el estado de su IA y su vigencia (ver lib/cuenta-externa-estado.ts). */
  externo?: { modulos: readonly ModuloExterno[]; estado: EstadoCuentaExterna } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const mobileItems = ["panel", "chat", "busqueda", "normas", "simulador"]
    .flatMap(id => sections.flatMap(s=>s.items).filter(i=>i.id===id)).slice(0,4);

  useEffect(() => {
    if (!mobileOpen) return;
    const before = document.activeElement as HTMLElement | null;
    const root = drawer.current;
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>('a[href],button,select,input,[tabindex="0"]') ?? []).filter(el=>el.getClientRects().length>0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable(), first=items[0], last=items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const media = matchMedia("(min-width:1024px)");
    const resize = () => { if (media.matches) setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    media.addEventListener("change", resize);
    return () => { window.removeEventListener("keydown", onKey); media.removeEventListener("change", resize); before?.focus(); };
  }, [mobileOpen]);

  useEffect(() => {
    // Lectura de localStorage post-montaje (evita mismatch de hidratación SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  // Con el drawer móvil abierto, el scroll de la página de atrás se bloquea:
  // el drawer es el único lugar con scroll. Al cerrar, se restaura el anterior.
  useEffect(() => {
    if (!mobileOpen) return;
    const wasLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      if (!wasLocked) document.body.classList.remove("overflow-hidden");
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }

  function applyCollapsed(next: boolean) {
    setCollapsed(next);
    writeCollapsed(next);
  }

  // Atajos: [ colapsa, ] expande, Ctrl+\ alterna. Ignora campos de texto.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "[") {
        event.preventDefault();
        applyCollapsed(true);
      } else if (event.key === "]") {
        event.preventDefault();
        applyCollapsed(false);
      } else if (event.key === "\\" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div className="aceMobileHeader fixed inset-x-0 top-0 z-40 flex h-[calc(72px+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-panel px-4 pt-[env(safe-area-inset-top)] lg:hidden group-has-[.normFocusReading]/workspace:hidden">
      <button
        type="button"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-panel text-ink transition-colors hover:bg-brand-soft"
        onClick={() => setMobileOpen((s) => !s)}
        aria-label="Mostrar menú"
        aria-expanded={mobileOpen}
        aria-controls="workspace-menu"
      >
        <PanelLeftOpen size={18} />
      </button>
      <Link className="flex min-w-0 flex-1 flex-col text-base font-bold tracking-tight text-ink [&>span]:text-[11px] [&>span]:font-normal [&>span]:tracking-normal [&>span]:text-muted" href="/" aria-label="ACE, ir al inicio">ACE<span>Contrataciones públicas</span></Link>
      <AppearanceControl />
      </div>
      {mobileOpen ? <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        ref={drawer}
        id="workspace-menu"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        className={`aceSidebar group/sidebar fixed inset-y-0 left-0 z-[60] flex w-[min(304px,88vw)] flex-col overflow-hidden border-r border-white/10 bg-[#102a36] text-slate-200 shadow-2xl transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-30 lg:h-dvh lg:w-auto lg:translate-x-0 lg:shadow-none group-has-[.normFocusReading]/workspace:hidden ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}
        aria-label="Navegación principal"
        data-collapsed={collapsed}
      >
        <div className="flex min-h-20 shrink-0 items-center gap-2 border-b border-white/10 px-3 py-4">
          <Link className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-white outline-offset-4 focus-visible:outline-2 focus-visible:outline-teal-200 lg:group-data-[collapsed=true]/sidebar:justify-center" href="/" onClick={() => setMobileOpen(false)}>
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-500 font-bold text-white shadow-sm">A</div>
            <div className="min-w-0 [&>strong]:block [&>strong]:text-[15px] [&>strong]:font-bold [&>span]:block [&>span]:text-[11px] [&>span]:text-slate-300 lg:group-data-[collapsed=true]/sidebar:hidden">
              <strong>ACE IA</strong>
              <span>Juridica</span>
            </div>
          </Link>
          <button
            type="button"
            className="hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-transparent text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal-200 lg:flex lg:group-data-[collapsed=true]/sidebar:absolute lg:group-data-[collapsed=true]/sidebar:bottom-5 lg:group-data-[collapsed=true]/sidebar:left-6"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú (Ctrl+\\)" : "Colapsar menú (Ctrl+\\)"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-transparent text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5" aria-label="Menu principal">
          {sections.map((section) => {
            const foldAdmin = ["chat", "busqueda", "normas"].includes(active) && section.label.toLowerCase() === "administrar" && !collapsed;
            const SectionTag = foldAdmin ? "details" : "div";
            return <SectionTag className={`mb-5 last:mb-0 ${foldAdmin ? "[&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:after:ml-auto [&>summary]:after:content-['+'] open:[&>summary]:after:content-['−']" : ""}`} key={section.label}>
              {foldAdmin ? <summary className="mb-2 flex min-h-8 cursor-default items-center px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 lg:group-data-[collapsed=true]/sidebar:sr-only">Administración</summary> : <span className="mb-2 flex min-h-8 cursor-default items-center px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 lg:group-data-[collapsed=true]/sidebar:sr-only">{section.label}</span>}
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = ICONOS[item.icon];
                  return (
                    <Link
                      aria-current={active === item.id ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200 lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-2 ${active === item.id ? "bg-teal-100 text-teal-950 shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                      href={item.href}
                      key={item.id}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={18} />
                      <span className="min-w-0 flex-1 leading-5 lg:group-data-[collapsed=true]/sidebar:hidden">{item.label}</span>
                      {item.id === "alertas" && newsCount > 0 ? (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-slate-900 lg:group-data-[collapsed=true]/sidebar:hidden">{newsCount}</span>
                      ) : null}
                      {item.id === "necesidades" && bandejaNecesidades > 0 ? (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-slate-900 lg:group-data-[collapsed=true]/sidebar:hidden" title="Necesidades que esperan tu acción">
                          {bandejaNecesidades >= BANDEJA_TOPE ? `${BANDEJA_TOPE}+` : bandejaNecesidades}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </SectionTag>;
          })}
        </nav>

        {user ? (
          <div className="relative shrink-0 border-t border-white/10 px-4 pb-5 pt-4 lg:group-data-[collapsed=true]/sidebar:pb-16">
            <div className="flex min-w-0 items-center gap-3 lg:group-data-[collapsed=true]/sidebar:justify-center">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-400/20 text-sm font-semibold text-teal-100"
                aria-hidden
                title={collapsed ? user.nombreCompleto?.trim() || etiquetaDeCuenta(user.email) : undefined}
              >
                {userInitials(user)}
              </span>
              <div className="min-w-0 lg:group-data-[collapsed=true]/sidebar:hidden">
                <span
                  className="block truncate text-[13px] font-semibold text-white"
                  title={
                    user.nombreCompleto
                      ? `${user.nombreCompleto} · usuario ${etiquetaDeCuenta(user.email)}`
                      : etiquetaDeCuenta(user.email) || undefined
                  }
                >
                  {user.nombreCompleto?.trim() || etiquetaDeCuenta(user.email) || "Sesión activa"}
                </span>
                <span
                  className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-teal-100"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  {externo ? "Cuenta externa" : appRoleLabel(user.role)}
                </span>
              </div>
            </div>

            {externo ? (
              <div className="lg:group-data-[collapsed=true]/sidebar:hidden"><CuentaExternaCard modulos={externo.modulos} estado={externo.estado} /></div>
            ) : (
              <div className="mt-3 space-y-1 text-[11px] leading-5 text-slate-300 lg:group-data-[collapsed=true]/sidebar:hidden">
                <span className="flex items-start gap-1.5 [&>svg]:mt-1 [&>svg]:shrink-0" title="Oficina a la que perteneces">
                  <Building2 size={13} aria-hidden />
                  {officeName ?? user.entity ?? "Sin oficina asignada"}
                </span>
                {user.esJefe ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-amber-100" title="Jefe de oficina: administra todo lo de su oficina">
                    <Crown size={12} aria-hidden />
                    Jefe de oficina
                  </span>
                ) : null}
                <span className="block text-[10px] leading-4 text-slate-400">{scopeText}</span>
              </div>
            )}

            <form action="/auth/signout" method="post">
              <button className="mt-4 flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-transparent px-3 text-left text-[12px] font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white lg:group-data-[collapsed=true]/sidebar:hidden" type="submit">
                <LogOut size={16} />
                <span className="min-w-0 flex-1 leading-5 lg:group-data-[collapsed=true]/sidebar:hidden">Cerrar sesion</span>
              </button>
            </form>
          </div>
        ) : null}
      </aside>
      <nav className="aceMobileDock fixed inset-x-0 bottom-0 z-40 grid grid-flow-col auto-cols-fr border-t border-line bg-panel px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-lg lg:hidden group-has-[.normFocusReading]/workspace:hidden [&>a]:flex [&>a]:min-h-14 [&>a]:min-w-0 [&>a]:flex-col [&>a]:items-center [&>a]:justify-center [&>a]:gap-1 [&>a]:rounded-xl [&>a]:text-[10px] [&>a]:font-medium [&>a]:text-muted [&>a[aria-current=page]]:bg-brand-soft [&>a[aria-current=page]]:text-brand [&>button]:flex [&>button]:min-h-14 [&>button]:flex-col [&>button]:items-center [&>button]:justify-center [&>button]:gap-1 [&>button]:rounded-xl [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-[10px] [&>button]:font-medium [&>button]:text-muted" aria-label="Accesos rápidos">
        {mobileItems.map(item=>{ const Icon=ICONOS[item.icon]; return <Link key={item.id} href={item.href} aria-current={item.id===active ? "page" : undefined} onClick={()=>setMobileOpen(false)}><Icon size={21} aria-hidden/><span>{item.id==="panel" ? "Inicio" : item.id==="chat" ? "Chat" : item.id==="busqueda" ? "Buscar" : item.id==="normas" ? "Normativa" : "Simulador"}</span></Link>; })}
        <button type="button" aria-label="Más opciones" aria-controls="workspace-menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={21} aria-hidden/><span>Más</span></button>
      </nav>
    </>
  );
}
