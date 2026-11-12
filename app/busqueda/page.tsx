import { AppShell } from "../components/app-shell";
import { DocumentSearchWorkspace } from "../components/document-search-workspace";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { C } from "@/app/components/estilos-comunes";
import { cn } from "@/lib/utils";

export default async function BusquedaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fbusqueda");
  return (
    <AppShell
      active="busqueda"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Búsqueda documental"
    >
      <section className={cn(C.legalWorkspace_singleWorkspace, "tw min-w-0")}>
        <DocumentSearchWorkspace ownerId={user.id} />
      </section>
    </AppShell>
  );
}
