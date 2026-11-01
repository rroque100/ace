import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../components/app-shell";
import { DocumentSyncPanel } from "../components/document-sync-panel";
import "../components/legal-workspace.css";
export default async function DocumentSyncPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Factualizacion-documental");
  if (!user.isAdmin || user.esExterno) redirect("/normas");
  return (
    <AppShell
      active="actualizacion-documental"
      eyebrow="Administración del Centro Jurídico"
      title="Actualización documental"
      showFiscalYear={false}
    >
      <div className="tw min-w-0">
        <DocumentSyncPanel />
        <p className="my-4 text-sm text-muted">
          Fuente principal:{" "}
          <Link className="text-brand-dark underline" href="https://www.gob.pe/institucion/oece/normas-legales" target="_blank" rel="noreferrer">
            OECE · Normas y documentos legales
          </Link>
          . Configura arriba los tipos documentales y regímenes de cada fuente.
        </p>
      </div>
    </AppShell>
  );
}
