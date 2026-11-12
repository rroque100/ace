import { AppShell } from "../components/app-shell";
import { ArchivoWorkspace } from "../components/archivo-workspace";
import { getSessionUser } from "@/lib/auth";
import { C } from "@/app/components/estilos-comunes";

export default async function ArchivoPage() {
  const user = await getSessionUser();
  const canManage = Boolean(user?.isEditor);

  return (
    <AppShell
      active="archivo"
      eyebrow="Archivo documental"
      title="Archivo administrativo de la entidad"
    >
      <section className={C.singleWorkspace}>
        <ArchivoWorkspace canManage={canManage} />
      </section>
    </AppShell>
  );
}
