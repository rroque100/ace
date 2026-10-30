import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../components/app-shell";
import { DocumentSyncPanel } from "../components/document-sync-panel";
import "../components/legal-workspace.css";
export default async function DocumentSyncPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Factualizacion-documental");
  if (!user.isAdmin) redirect("/normas");
  return (
    <AppShell
      active="actualizacion-documental"
      eyebrow="Administración del Centro Jurídico"
      title="Actualización documental"
      showFiscalYear={false}
    >
      <div className="tw min-w-0">
        <DocumentSyncPanel />
        <p className="my-4 text-sm text-slate-600">
          Para añadir otra fuente oficial, utiliza{" "}
          <Link className="text-teal-800 underline" href="/normas?library=news">
            Novedades → Actualización documental controlada → Registrar página
            oficial
          </Link>
          . Las fuentes sin adaptador se mantienen en revisión manual.
        </p>
      </div>
    </AppShell>
  );
}
