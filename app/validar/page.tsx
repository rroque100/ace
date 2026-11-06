import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Bot, FileSearch } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ProcedureValidator } from "../components/procedure-validator";

export default function ValidarPage() {
  return (
    <AppShell
      active="validar"
      action={
        <div className="buttonCluster">
          <Link className={buttonClasses({ variant: "secondary" })} href="/busqueda">
            <FileSearch size={17} />
            Consultas
          </Link>
          <Link className={buttonClasses({ variant: "secondary" })} href="/chat">
            <Bot size={17} />
            Chat
          </Link>
        </div>
      }
      eyebrow="Validacion operativa"
      title="Agente de procedimiento"
    >
      <ProcedureValidator />
    </AppShell>
  );
}
