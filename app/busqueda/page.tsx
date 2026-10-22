import { AppShell } from "../components/app-shell";
import { SemanticSearch } from "../components/semantic-search";

export default function BusquedaPage() {
  return (
    <AppShell
      active="busqueda"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Búsqueda documental"
    >
      <section className="singleWorkspace">
        <SemanticSearch />
      </section>
    </AppShell>
  );
}
