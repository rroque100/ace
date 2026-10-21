"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { ActiveId, IconName, NavItem } from "@/lib/navegacion";
import type { SessionUser } from "@/lib/auth";
import { BANDEJA_TOPE } from "@/lib/necesidades-bandeja";
import { etiquetaDeCuenta } from "@/lib/usuario-credencial";
import { appRoleLabel } from "@/lib/permisos-contratacion";

const SIDEBAR_COLLAPSED_KEY = "ace-sidebar-collapsed";

// Los iconos viven aquí (cliente): `NAVEGACION` solo trae el NOMBRE, para que la
// estructura sea serializable al cruzar de AppShell (servidor) a este componente.
const ICONOS: Record<IconName, LucideIcon> = {
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

function userInitials(user: SessionUser): string {
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
}: {
  active: ActiveId;
  sections: readonly { label: string; items: readonly NavItem[] }[];
  user: SessionUser | null;
  newsCount: number;
  bandejaNecesidades: number;
  officeName: string | null;
  scopeText: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      <button
        type="button"
        className={`sidebarMobileToggle ${mobileOpen ? "isHidden" : ""}`}
        onClick={() => setMobileOpen((s) => !s)}
        aria-label="Mostrar menú"
        aria-expanded={mobileOpen}
      >
        <PanelLeftOpen size={18} />
      </button>
      {mobileOpen ? <div className="sidebarMobileScrim" onClick={() => setMobileOpen(false)} /> : null}
      <aside
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
          {sections.map((section) => (
            <div className="navSection" key={section.label}>
              <span className="navSectionLabel">{section.label}</span>
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
            </div>
          ))}
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
                  {appRoleLabel(user.role)}
                </span>
              </div>
            </div>

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

            <form action="/auth/signout" method="post">
              <button className="signoutButton" type="submit">
                <LogOut size={16} />
                <span className="navLabel">Cerrar sesion</span>
              </button>
            </form>
          </div>
        ) : null}
      </aside>
    </>
  );
}
