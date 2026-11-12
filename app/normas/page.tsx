import { AppShell } from "../components/app-shell";
import { NormativeBrowser } from "../components/normative-browser";
import { C } from "@/app/components/estilos-comunes";
import { cn } from "@/lib/utils";

export default function NormasPage() {
  return (
    <AppShell
      active="normas"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Normativa y criterios"
    >
      <section className={cn(C.legalWorkspace_singleWorkspace, "tw min-w-0")}>
        <NormativeBrowser />
      </section>
    </AppShell>
  );
}
