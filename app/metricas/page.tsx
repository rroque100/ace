import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Lock, ScrollText } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { MetricsDashboard } from "../components/metrics-dashboard";
import { getSessionUser } from "@/lib/auth";
import { C } from "@/app/components/estilos-comunes";

export default async function MetricasPage() {
  const user = await getSessionUser();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell
      active="metricas"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/auditoria">
          <ScrollText size={17} />
          Ver auditoría
        </Link>
      }
      eyebrow="Operación"
      title="Monitoreo y métricas"
    >
      <section className={C.singleWorkspace}>
        {isAdmin ? (
          <MetricsDashboard />
        ) : (
          <div className={C.emptyState}>
            <Lock size={20} />
            <p>El panel de monitoreo está reservado a administradores.</p>
            <Link className={buttonClasses({ variant: "primary" })} href="/chat">
              Ir al chat
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
