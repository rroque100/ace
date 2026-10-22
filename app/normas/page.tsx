import Link from "next/link";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NormativeBrowser } from "../components/normative-browser";

export default function NormasPage() {
  return (
    <AppShell
      active="normas"
      showFiscalYear={false}
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Centro Jurídico"
      title="Normativa y criterios"
    >
      <section className="singleWorkspace">
        <NormativeBrowser />
      </section>
    </AppShell>
  );
}
