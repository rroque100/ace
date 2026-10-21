import { AppShell } from "../components/app-shell";
import { ProcessList } from "../components/process-list";
import { getSessionUser } from "@/lib/auth";

export default async function ExpedientesPage() {
  const user = await getSessionUser();
  const canManage = (user?.capabilities ?? []).includes("expediente.manage");

  return (
    <AppShell
      active="expedientes"
      eyebrow="Procedimientos"
      title="Expedientes de contratación"
    >
      <section className="singleWorkspace">
        <ProcessList canManage={canManage} />
      </section>
    </AppShell>
  );
}
