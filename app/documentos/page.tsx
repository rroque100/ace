import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Bot, Lock } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DocumentUpload } from "../components/document-upload";
import { getSessionUser } from "@/lib/auth";
import { C } from "@/app/components/estilos-comunes";

export default async function DocumentosPage() {
  const user = await getSessionUser();
  const canManage = Boolean(user?.isEditor);

  return (
    <AppShell
      active="documentos"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Base documental"
      title="Carga, procesamiento e indexacion de PDFs"
    >
      <section className={C.singleWorkspace}>
        {canManage ? (
          <DocumentUpload />
        ) : (
          <div className={C.emptyState}>
            <Lock size={20} />
            <p>
              La gestión del corpus normativo (carga, reindexado y borrado) requiere rol DEC o
              administrador. Puedes consultar todos los documentos indexados desde el
              chat y la busqueda.
            </p>
            <Link className={buttonClasses({ variant: "primary" })} href="/busqueda">
              Ir a Consultas
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
