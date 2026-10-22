import { AppShell } from "../components/app-shell";
import { NormativeBrowser } from "../components/normative-browser";

export default function NormasPage() {
  return (
    <AppShell
      active="normas"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Normativa y criterios"
    >
      <section className="singleWorkspace">
        <NormativeBrowser />
      </section>
    </AppShell>
  );
}
