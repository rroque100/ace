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

// Color de acento por rol para el distintivo de identidad. Agrupa los roles de
// la Ley 32069 por familia funcional para que sean faciles de distinguir.
const ROLE_ACCENT: Record<string, string> = {
  admin: "#8b5cf6",
  dec: "#0f766e",
  oficial_compra: "#0f766e",
  aga: "#0f766e",
  titular: "#b45309",
  legal: "#2563eb",
  area_usuaria: "#d97706",
  ate: "#d97706",
  comite: "#4f46e5",
  jurado: "#4f46e5",
  consulta: "#64748b",
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
    const media = matchMedia("(min-width:981px)");
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
      <div className="mobileAppHeader">
      <button
        type="button"
        className={`sidebarMobileToggle ${mobileOpen ? "isHidden" : ""}`}
        onClick={() => setMobileOpen((s) => !s)}
        aria-label="Mostrar menú"
        aria-expanded={mobileOpen}
        aria-controls="workspace-menu"
      >
        <PanelLeftOpen size={18} />
      </button>
      <Link className="mobileAppBrand" href="/" aria-label="ACE, ir al inicio">ACE<span>Contrataciones públicas</span></Link>
      <AppearanceControl />
      </div>
      {mobileOpen ? <div className="sidebarMobileScrim" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        ref={drawer}
        id="workspace-menu"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobileOpen" : ""}`}
        aria-label="Navegación principal"
        data-collapsed={collapsed}
      >
        <div className="sidebarTop">
          <Link className="brand" href="/" onClick={() => setMobileOpen(false)}>
            <div className="brandMark">A</div>
            <div className="brandText">
              <strong>ACE IA</strong>
              <span>Juridica</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebarCollapseBtn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú (Ctrl+\\)" : "Colapsar menú (Ctrl+\\)"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            type="button"
            className="sidebarMobileClose"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav" aria-label="Menu principal">
          {sections.map((section) => {
            const foldAdmin = ["chat", "busqueda", "normas"].includes(active) && section.label.toLowerCase() === "administrar" && !collapsed;
            const SectionTag = foldAdmin ? "details" : "div";
            return <SectionTag className={`navSection${foldAdmin ? " navAdminDisclosure" : ""}`} key={section.label}>
              {foldAdmin ? <summary className="navSectionLabel">Administración</summary> : <span className="navSectionLabel">{section.label}</span>}
              <div className="navSectionItems">
                {section.items.map((item) => {
                  const Icon = ICONOS[item.icon];
                  return (
                    <Link
                      aria-current={active === item.id ? "page" : undefined}
                      className={active === item.id ? "active" : undefined}
                      href={item.href}
                      key={item.id}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={18} />
                      <span className="navLabel">{item.label}</span>
                      {item.id === "alertas" && newsCount > 0 ? (
                        <span className="navBadge">{newsCount}</span>
                      ) : null}
                      {item.id === "necesidades" && bandejaNecesidades > 0 ? (
                        <span className="navBadge" title="Necesidades que esperan tu acción">
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
          <div className="userBox">
            <div className="userIdentity">
              <span
                className="userAvatar"
                aria-hidden
                style={{ background: ROLE_ACCENT[user.role] ?? ROLE_ACCENT.consulta }}
                title={collapsed ? user.nombreCompleto?.trim() || etiquetaDeCuenta(user.email) : undefined}
              >
                {userInitials(user)}
              </span>
              <div className="userIdentityText">
                <span
                  className="userEmail"
                  title={
                    user.nombreCompleto
                      ? `${user.nombreCompleto} · usuario ${etiquetaDeCuenta(user.email)}`
                      : etiquetaDeCuenta(user.email) || undefined
                  }
                >
                  {user.nombreCompleto?.trim() || etiquetaDeCuenta(user.email) || "Sesión activa"}
                </span>
                <span
                  className="userRoleBadge"
                  style={{ color: ROLE_ACCENT[user.role] ?? ROLE_ACCENT.consulta }}
                >
                  <span className="userRoleDot" style={{ background: "currentColor" }} />
                  {externo ? "Cuenta externa" : appRoleLabel(user.role)}
                </span>
              </div>
            </div>

            {externo ? (
              <CuentaExternaCard modulos={externo.modulos} estado={externo.estado} />
            ) : (
              <div className="userContext">
                <span className="userContextRow" title="Oficina a la que perteneces">
                  <Building2 size={13} aria-hidden />
                  {officeName ?? user.entity ?? "Sin oficina asignada"}
                </span>
                {user.esJefe ? (
                  <span className="userJefeTag" title="Jefe de oficina: administra todo lo de su oficina">
                    <Crown size={12} aria-hidden />
                    Jefe de oficina
                  </span>
                ) : null}
                <span className="userScopeHint">{scopeText}</span>
              </div>
            )}

            <form action="/auth/signout" method="post">
              <button className="signoutButton" type="submit">
                <LogOut size={16} />
                <span className="navLabel">Cerrar sesion</span>
              </button>
            </form>
          </div>
        ) : null}
      </aside>
      <nav className="mobileDock" aria-label="Accesos rápidos">
        {mobileItems.map(item=>{ const Icon=ICONOS[item.icon]; return <Link key={item.id} href={item.href} aria-current={item.id===active ? "page" : undefined} onClick={()=>setMobileOpen(false)}><Icon size={21} aria-hidden/><span>{item.id==="panel" ? "Inicio" : item.id==="chat" ? "Chat" : item.id==="busqueda" ? "Buscar" : item.id==="normas" ? "Normativa" : "Simulador"}</span></Link>; })}
        <button type="button" aria-label="Más opciones" aria-controls="workspace-menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={21} aria-hidden/><span>Más</span></button>
      </nav>
    </>
  );
}
