import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SemanticSearch } from "../components/semantic-search";

export default function BusquedaPage() {
  return (
    <AppShell
      active="busqueda"
      showFiscalYear={false}
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Centro Jurídico"
      title="Búsqueda documental"
    >
      <section className="singleWorkspace">
        <SemanticSearch />
      </section>
    </AppShell>
  );
}
