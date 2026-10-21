import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ConfiguracionWorkspace } from "../components/configuracion-workspace";
import { getSessionUser } from "@/lib/auth";

export default async function ConfiguracionPage() {
  const user = await getSessionUser();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell
      active="configuracion"
      action={
        <Link className="inline-flex items-center gap-1.5 min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink font-[740] no-underline transition-colors hover:border-[rgba(15,118,110,0.28)] hover:bg-brand-soft hover:text-brand-dark" href="/metricas">
          <BarChart3 size={17} />
          Monitoreo
        </Link>
      }
      eyebrow="Administración"
      title="Configuración del sistema"
    >
      <section className="tw grid max-w-full">
        {isAdmin ? (
          <ConfiguracionWorkspace currentUserId={user?.id ?? ""} />
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-sm text-center text-muted bg-surface border border-dashed border-line rounded-xl">
            <Lock size={20} className="text-brand/60" />
            <p className="m-0 max-w-[360px]">
              La configuración institucional está reservada a usuarios
              administradores.
            </p>
            <Link
              className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 font-bold text-white bg-brand border-0 rounded-lg cursor-pointer hover:bg-brand-dark"
              href="/chat"
            >
              Ir al chat
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
