import { AppShell } from "../components/app-shell";
import { ArchivoWorkspace } from "../components/archivo-workspace";
import { getSessionUser } from "@/lib/auth";

export default async function ArchivoPage() {
  const user = await getSessionUser();
  const canManage = Boolean(user?.isEditor);

  return (
    <AppShell
      active="archivo"
      eyebrow="Archivo documental"
      title="Archivo administrativo de la entidad"
    >
      <section className="singleWorkspace">
        <ArchivoWorkspace canManage={canManage} />
      </section>
    </AppShell>
  );
}
