import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "../components/app-shell";
import { ExamWorkspace } from "../components/exam-workspace";
import "../components/legal-workspace.css";
import "../components/exam-ui.css";
export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fsimulador");
  return (
    <AppShell
      active="simulador"
      eyebrow="Formación en contratación pública"
      title="Simulador de examen"
      showFiscalYear={false}
    >
      <ExamWorkspace isAdmin={user.isAdmin} />
    </AppShell>
  );
}
