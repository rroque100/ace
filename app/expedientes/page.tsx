import { AppShell } from "../components/app-shell";
import { ProcessList } from "../components/process-list";
import { getSessionUser } from "@/lib/auth";
import { C } from "@/app/components/estilos-comunes";

export default async function ExpedientesPage() {
  const user = await getSessionUser();
  const canManage = (user?.capabilities ?? []).includes("expediente.manage");

  return (
    <AppShell
      active="expedientes"
      eyebrow="Procedimientos"
      title="Expedientes de contratación"
    >
      <section className={C.singleWorkspace}>
        <ProcessList canManage={canManage} />
      </section>
    </AppShell>
  );
}
