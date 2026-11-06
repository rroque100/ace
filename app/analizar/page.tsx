import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DocumentAnalyzer } from "../components/document-analyzer";

export default function AnalizarPage() {
  return (
    <AppShell
      active="analizar"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Asistente"
      title="Analiza bases, contratos y expedientes contra la normativa"
    >
      <section className="singleWorkspace">
        <DocumentAnalyzer />
      </section>
    </AppShell>
  );
}
