import { getArchivoScopeLevel, getSessionUser, puedeUsarProcesos, type SessionUser } from "@/lib/auth";
import { contarNecesidadesPendientes } from "@/lib/necesidades-bandeja";
import { NAVEGACION, type ActiveId } from "@/lib/navegacion";
import { supabaseRest } from "@/lib/supabase-server";
import { Sidebar } from "./sidebar";
import { YearSelector } from "./year-selector";
import { MiYoWidget } from "./asistente/mi-yo-widget";

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

export async function AppShell({ active, action, children, eyebrow, title }: AppShellProps) {
  const [user, newsCount] = await Promise.all([getSessionUser(), countRecentNews()]);
  const officeName = user ? await getOfficeName(user.oficinaId) : null;
  // Bandeja de necesidades pendientes de la acción de este usuario: badge en el
  // menú, para que se entere sin abrir la sección (cierra el lazo del SLA).
  const bandejaNecesidades = user ? await contarNecesidadesPendientes(user) : 0;
  const isAdmin = Boolean(user?.isAdmin);
  const scopeText = user ? scopePhrase(user) : "";
  // Expedientes/Contratos son exclusivos de la oficina de Abastecimiento
  // (ver lib/auth.ts): sin sesión, no se muestran.
  const puedeProcesos = user ? puedeUsarProcesos(user, officeName) : false;

  // El menu se adapta al rol: los usuarios no administradores no ven las
  // opciones exclusivas de administracion (menos ruido, mas facil de usar).
  // La decisión de qué se muestra queda en el servidor; el <Sidebar> solo
  // renderiza las secciones que recibe.
  const sections = NAVEGACION.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      // `as const satisfies` deja cada item con su tipo literal exacto: solo
      // los tres de "Procesos" tienen la clave `soloAbastecimiento` en su
      // tipo, así que el resto necesita el chequeo `in` antes de leerla.
      const soloAbastecimiento = "soloAbastecimiento" in item && item.soloAbastecimiento;
      return (!item.adminOnly || isAdmin) && (!soloAbastecimiento || puedeProcesos);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <main className="shell">
      {/* Primer elemento enfocable del documento: salta el menu lateral. */}
      <a className="skipLink" href="#contenido">
        Saltar al contenido
      </a>

      <Sidebar
        active={active}
        sections={sections}
        user={user}
        newsCount={newsCount}
        bandejaNecesidades={bandejaNecesidades}
        officeName={officeName}
        scopeText={scopeText}
      />

      <section className="content" id="contenido" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {title}
              <YearSelector />
            </h1>
          </div>
          {action}
        </header>

        {children}
      </section>

      {/* Flota sobre cualquier módulo autenticado: un solo asistente, no uno
          por página (ver docs/superpowers/plans). Sin sesión no se renderiza. */}
      {user ? <MiYoWidget /> : null}
    </main>
  );
}
