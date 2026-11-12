import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { NecesidadDetail } from "../../components/necesidad-detail";
import { getSessionUser } from "@/lib/auth";
import { C } from "@/app/components/estilos-comunes";

export default async function NecesidadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);

  const caps = new Set(user?.capabilities ?? []);
  const permisos = {
    manage: caps.has("necesidad.manage"),
    derivar: caps.has("expediente.manage"),
  };
  const role = user?.role ?? "consulta";

  return (
    <AppShell
      active="necesidades"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/necesidades">
          <ArrowLeft size={17} />
          Volver
        </Link>
      }
      eyebrow="Módulo 1 · Necesidad"
      title="Ficha de Necesidad"
    >
      <section className={C.singleWorkspace}>
        <NecesidadDetail necesidadId={id} permisos={permisos} role={role} usuarioId={user?.id ?? null} />
      </section>
    </AppShell>
  );
}
