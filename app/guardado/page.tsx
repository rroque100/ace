import Link from "next/link";
import { FileSearch } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SavedWorkspace } from "../components/saved-workspace";

export default function GuardadoPage() {
  return (
    <AppShell
      active="guardado"
      showFiscalYear={false}
      action={
        <Link className="secondaryButton" href="/busqueda">
          <FileSearch size={17} />
          Ir a Búsqueda
        </Link>
      }
      eyebrow="Mi trabajo jurídico"
      title="Mis carpetas y guardados"
    >
      <section className="singleWorkspace">
        <SavedWorkspace />
      </section>
    </AppShell>
  );
}
