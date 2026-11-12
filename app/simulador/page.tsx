import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../components/app-shell";
import { SimuladorShell } from "../components/simulador-shell";
export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fsimulador");
  return (
    <AppShell
      active="simulador"
      eyebrow="Formación en contratación pública"
      title="Simulador de examen"
      showFiscalYear={false}
    >
      <SimuladorShell
        isAdmin={user.isAdmin}
        storageScope={user.id}
        centerEnabled={
          !user.esExterno || user.modulosExternos.includes("centro_juridico")
        }
      />
    </AppShell>
  );
}
