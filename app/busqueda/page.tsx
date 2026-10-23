import { AppShell } from "../components/app-shell";
import { DocumentSearchWorkspace } from "../components/document-search-workspace";

export default function BusquedaPage() {
  return (
    <AppShell
      active="busqueda"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Búsqueda documental"
    >
      <section className="singleWorkspace">
        <DocumentSearchWorkspace />
      </section>
    </AppShell>
  );
}
