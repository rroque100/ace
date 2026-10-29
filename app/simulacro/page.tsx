import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../components/app-shell";

export const dynamic = "force-dynamic";

// Módulo reservado: las cuentas externas pueden tener habilitado «Simulacro de examen» (ver lib/modulos-acceso.ts) y el
// proxy ya les abre esta ruta, pero el simulacro en sí —banco de preguntas, intentos, corrección con cita de la norma—
// todavía no está construido. Esta pantalla lo dice con claridad en lugar de dar un error o una página vacía.
export default async function SimulacroPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fsimulacro");

  return (
    <AppShell active="simulacro" showFiscalYear={false} eyebrow="Simulacro" title="Simulacro de examen">
      <section className="singleWorkspace" aria-labelledby="simulacro-titulo">
        <div className="emptyState" style={{ textAlign: "center", padding: "48px 24px" }}>
          <GraduationCap size={36} aria-hidden="true" />
          <h2 id="simulacro-titulo">Estamos preparando el simulacro</h2>
          <p>
            Aquí podrás practicar el examen con preguntas sobre la Ley 32069 y su Reglamento, y revisar cada respuesta con la norma
            que la sustenta. Todavía no está disponible; tu acceso a este módulo ya está habilitado y se activará apenas esté listo.
          </p>
          {user.esExterno && user.modulosExternos.includes("centro_juridico") ? <p><a href="/chat">Mientras tanto, consulta el Centro Jurídico</a></p> : null}
        </div>
      </section>
    </AppShell>
  );
}
