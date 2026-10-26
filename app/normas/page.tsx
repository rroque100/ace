import { AppShell } from "../components/app-shell";
import { NormativeBrowser } from "../components/normative-browser";
import "../components/legal-workspace.css";

export default function NormasPage() {
  return (
    <AppShell
      active="normas"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Normativa y criterios"
    >
      <section className="singleWorkspace tw legalWorkspace min-w-0">
        <NormativeBrowser />
      </section>
    </AppShell>
  );
}
