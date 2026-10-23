import { Suspense } from "react";
import { AppShell } from "../components/app-shell";
import { LegalChat } from "../components/legal-chat";

export default function ChatPage() {
  return (
    <AppShell
      active="chat"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Chat jurídico"
    >
      <section className="singleWorkspace">
        <Suspense fallback={<div className="emptyState">Cargando chat...</div>}>
          <LegalChat />
        </Suspense>
      </section>
    </AppShell>
  );
}
