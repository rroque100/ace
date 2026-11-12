import {getSessionUser} from "@/lib/auth";
import { Suspense } from "react";
import { AppShell } from "../components/app-shell";
import { LegalChat } from "../components/legal-chat";
import { C } from "@/app/components/estilos-comunes";
import { cn } from "@/lib/utils";

export default async function ChatPage() {
  const user=await getSessionUser();
  return (
    <AppShell
      active="chat"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Chat jurídico"
    >
      <section className={cn(C.legalWorkspace_singleWorkspace, "tw min-w-0")}>
        <Suspense fallback={<div className={C.emptyState}>Cargando chat...</div>}>
          <LegalChat ownerId={user?.id??""} />
        </Suspense>
      </section>
    </AppShell>
  );
}
