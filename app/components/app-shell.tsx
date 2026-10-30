import { WorkspaceSearch, WorkspaceAssistant } from "./workspace-assistants";
import { getArchivoScopeLevel, getSessionUser, puedeUsarProcesos, type SessionUser } from "@/lib/auth";
import { contarNecesidadesPendientes } from "@/lib/necesidades-bandeja";
import { type ActiveId } from "@/lib/navegacion";
import { supabaseRest } from "@/lib/supabase-server";
import { Sidebar } from "./sidebar";
import { YearSelector } from "./year-selector";
import { sidebarIdentity, workspaceNavigation } from "@/lib/workspace-navigation";
import { AppearanceControl } from "./appearance-control";
import { consumoMensualTokens } from "@/lib/uso-ia";
import { estadoCuentaExterna } from "@/lib/cuenta-externa-estado";
import { AvisosExterno } from "./externo/avisos-externo";

// Frase clara (para usuarios no tecnicos) de que puede ver cada usuario en el
// archivo de expedientes, derivada del mismo modelo de scope de lib/auth.
// Se calcula aquí (servidor) porque lib/auth depende de next/headers y el
// <Sidebar> es un componente de cliente.
function scopePhrase(user: SessionUser): string {
  switch (getArchivoScopeLevel(user)) {
    case "all":
      return "Ve todo el archivo de la entidad";
    case "oficina":
      return "Ve todo lo de su oficina";
    default:
      return "Ve solo lo que sube o crea";
  }
}

async function getOfficeName(oficinaId: string | null | undefined): Promise<string | null> {
  if (!oficinaId) return null;
  try {
    const rows = await supabaseRest<Array<{ nombre: string }>>(
      `expedientes_oficinas?id=eq.${oficinaId}&select=nombre&limit=1`,
    );
    return rows[0]?.nombre ?? null;
  } catch {
    return null;
  }
}

type AppShellProps = {
  active: ActiveId;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  showFiscalYear?: boolean;
};

async function countRecentNews() {
  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRest<Array<{ id: string }>>(
      `boletin_eventos?created_at=gte.${since}&select=id&limit=50`,
    );
    return rows.length;
  } catch {
    return 0;
  }
}

// Fuera del componente: leer el reloj es impuro y el componente se vuelve a ejecutar; aquí es solo una consulta del servidor.
async function estadoDeCuentaExterna(user: SessionUser) {
  return estadoCuentaExterna({ cuota: user.cuotaIAMensual, usados: await consumoMensualTokens(user.id), vigenteHasta: user.externoVigenteHasta, ahora: Date.now() });
}

export async function AppShell({ active, action, children, eyebrow, title, showFiscalYear = true }: AppShellProps) {
  const user = await getSessionUser();
  const [officeName, bandejaNecesidades, estadoExterno, newsCount] = await Promise.all([
    user && !user.esExterno ? getOfficeName(user.oficinaId) : null,
    user && !user.esExterno ? contarNecesidadesPendientes(user) : 0,
    user?.esExterno ? estadoDeCuentaExterna(user) : null,
    user && !user.esExterno ? countRecentNews() : 0,
  ]);
  // Bandeja de necesidades pendientes de la acción de este usuario: badge en el
  // menú, para que se entere sin abrir la sección (cierra el lazo del SLA).
  // Una cuenta externa ve cuánta IA le queda y hasta cuándo tiene acceso, en la barra lateral y en avisos arriba. El consumo
  // sale de la misma lectura (con caché de un minuto) que aplica la cuota; si no se puede leer cuenta como cero, sin romper la pantalla.
  const scopeText = user ? scopePhrase(user) : "";
  // Expedientes/Contratos son exclusivos de la oficina de Abastecimiento
  // (ver lib/auth.ts): sin sesión, no se muestran.
  const puedeProcesos = user ? puedeUsarProcesos(user, officeName) : false;

  // El menu se adapta al rol: los usuarios no administradores no ven las
  // opciones exclusivas de administracion (menos ruido, mas facil de usar).
  // La decisión de qué se muestra queda en el servidor; el <Sidebar> solo
  // renderiza las secciones que recibe.
  const sections = workspaceNavigation(user, puedeProcesos);

  return (
    <main className={`shell workspaceShell${["chat", "busqueda", "normas"].includes(active) ? " legalShell" : ""}`}>
      {/* Primer elemento enfocable del documento: salta el menu lateral. */}
      <a className="skipLink" href="#contenido">
        Saltar al contenido
      </a>

      <Sidebar
        active={active}
        sections={sections}
        user={sidebarIdentity(user)}
        newsCount={newsCount}
        bandejaNecesidades={bandejaNecesidades}
        officeName={officeName}
        scopeText={scopeText}
        externo={user?.esExterno && estadoExterno ? { modulos: user.modulosExternos, estado: estadoExterno } : null}
      />

      <section className="content" id="contenido" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {title}
              {showFiscalYear ? <YearSelector /> : null}
            </h1>
          </div>
          {/* Sin «Buscar en ACE» para una cuenta externa: propone destinos que no puede abrir (Guardados, Historial, Archivo) y cada propuesta gasta
              parte de su cuota de IA. Sus módulos ya están a la vista en el menú. */}
          <div className="topbarSearchActions"><AppearanceControl />{user && !user.esExterno ? <WorkspaceSearch ownerId={user.id} destinations={sections.flatMap(section=>section.items.map(item=>({href:item.href,label:item.label})))} /> : null}{action}</div>
        </header>

        {estadoExterno ? <AvisosExterno estado={estadoExterno} /> : null}

        {children}
      </section>

      {/* Flota sobre cualquier módulo autenticado: un solo asistente, no uno
          por página (ver docs/superpowers/plans). Sin sesión no se renderiza. */}
      {/* El asistente atiende al personal de la entidad (expedientes, necesidades): una cuenta externa no lo tiene. */}
      {user && !user.esExterno ? <WorkspaceAssistant /> : null}
    </main>
  );
}
