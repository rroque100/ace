import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Lock, BarChart3 } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { AuditExplorer } from "../components/audit-explorer";
import { getSessionUser } from "@/lib/auth";

export default async function AuditoriaPage() {
  const user = await getSessionUser();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell
      active="auditoria"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/metricas">
          <BarChart3 size={17} />
          Ver monitoreo
        </Link>
      }
      eyebrow="Gobernanza"
      title="Auditoría del sistema"
    >
      <section className="singleWorkspace">
        {isAdmin ? (
          <AuditExplorer />
        ) : (
          <div className="emptyState">
            <Lock size={20} />
            <p>El registro de auditoría está reservado a administradores.</p>
            <Link className={buttonClasses({ variant: "primary" })} href="/chat">
              Ir al chat
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
