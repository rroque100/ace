import {ChatQualityPanel} from "../components/chat-quality-panel";
import Link from "next/link";
import { Bot, Lock } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { EvalDashboard } from "../components/eval-dashboard";
import { getSessionUser } from "@/lib/auth";

export default async function EvaluacionPage() {
  const user = await getSessionUser();
  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AppShell
      active="evaluacion"
      action={
        <Link className="secondaryButton" href="/chat">
          <Bot size={17} />
          Ir al chat
        </Link>
      }
      eyebrow="Calidad"
      title="Evaluación continua del asistente"
    >
      <section className="singleWorkspace">
        {user?.isLegal || isAdmin ? <ChatQualityPanel/> : null}
        {isAdmin ? (
          <EvalDashboard />
        ) : (
          <div className="emptyState">
            <Lock size={20} />
            <p>
              La evaluación continua del RAG (banco de preguntas, corridas y métricas de calidad)
              está reservada a administradores.
            </p>
            <Link className="primaryButton" href="/chat">
              Ir al chat
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
