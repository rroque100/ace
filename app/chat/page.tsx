import { Suspense } from "react";
import { AppShell } from "../components/app-shell";
import { LegalChat } from "../components/legal-chat";
import "../components/legal-workspace.css";

export default function ChatPage() {
  return (
    <AppShell
      active="chat"
      showFiscalYear={false}
      eyebrow="Centro Jurídico"
      title="Chat jurídico"
    >
      <section className="singleWorkspace tw legalWorkspace min-w-0">
        <Suspense fallback={<div className="emptyState">Cargando chat...</div>}>
          <LegalChat />
        </Suspense>
      </section>
    </AppShell>
  );
}
