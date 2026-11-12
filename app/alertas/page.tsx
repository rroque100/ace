import Link from "next/link";
import { buttonClasses } from "@/app/components/ui/button";
import { Bot } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { NewsFeed } from "../components/news-feed";
import { C } from "@/app/components/estilos-comunes";

export default function AlertasPage() {
  return (
    <AppShell
      active="alertas"
      action={
        <Link className={buttonClasses({ variant: "secondary" })} href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Engagement"
      title="Alertas y boletín normativo"
    >
      <section className={C.singleWorkspace}>
        <NewsFeed />
      </section>
    </AppShell>
  );
}
