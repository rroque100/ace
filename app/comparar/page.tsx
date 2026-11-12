import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NormativeCompare } from "../components/normative-compare";
import { C } from "@/app/components/estilos-comunes";
import { cn } from "@/lib/utils";

export default function CompararPage() {
  return (
    <AppShell
      active="comparar"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Analisis normativo"
      title="Comparacion entre normas con evidencia"
    >
      <section className={cn(C.legalWorkspace_singleWorkspace, "tw")}>
        <NormativeCompare />
      </section>
    </AppShell>
  );
}
