import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { ExpedienteProvider } from "../../components/expediente-contexto";
import { ProcessDetail } from "../../components/process-detail";
import { getSessionUser } from "@/lib/auth";

export default async function ExpedienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);

  const caps = new Set(user?.capabilities ?? []);
  const permisos = {
    manage: caps.has("expediente.manage"),
    upload: caps.has("expediente.upload"),
    evaluate: caps.has("expediente.evaluate"),
    risks: caps.has("expediente.risks"),
    draft: caps.has("expediente.draft"),
  };

  return (
    <AppShell
      active="expedientes"
      action={
        <Link className="secondaryButton" href="/expedientes">
          <ArrowLeft size={17} />
          Volver
        </Link>
      }
      eyebrow="Procedimiento"
      title="Detalle del expediente"
    >
      <section className="singleWorkspace">
        {/* El proveedor carga el expediente UNA vez para toda la página: antes
            el detalle, los tres paneles de fase y el avance global lo pedían
            cada uno por su cuenta.

            `key={id}` lo REMONTA al navegar de un expediente a otro. Sin ella,
            React reutiliza el proveedor y su estado (proceso, hitos, ficha del
            expediente anterior) se veía unos instantes hasta que cargaba el nuevo
            —un parpadeo con datos que no son de este expediente—. Con la key el
            proveedor arranca en limpio (`cargando = true`) y muestra su carga. */}
        <ExpedienteProvider key={id} processId={id}>
          <ProcessDetail permisos={permisos} processId={id} />
        </ExpedienteProvider>
      </section>
    </AppShell>
  );
}
