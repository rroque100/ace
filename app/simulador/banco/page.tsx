import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../../components/app-shell";
import { ExamBank } from "../../components/exam-bank";
import "../../components/legal-workspace.css";
import "../../components/exam-ui.css";
export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fsimulador%2Fbanco");
  if (!user.isAdmin) redirect("/simulador");
  return (
    <AppShell
      active="simulador"
      eyebrow="Revisión editorial"
      title="Banco de preguntas"
      showFiscalYear={false}
    >
      <ExamBank />
    </AppShell>
  );
}
