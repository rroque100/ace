import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { examRpc } from "@/lib/exam-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { resumirBanco } from "@/lib/simulador-navegacion";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  try {
    const client = await getSupabaseAdminClient();
    const [available, active, retired] = await Promise.all([
      examRpc("ace_exam_availability", { p_admin: false }),
      client.from("exam_questions").select("id", { count: "exact", head: true }).in("status", ["draft", "published"]),
      client.from("exam_questions").select("id", { count: "exact", head: true }).eq("status", "retired"),
    ]);
    if (active.error || retired.error) throw Error("No se pudo consultar el banco.");
    return NextResponse.json(resumirBanco(available, active.count, retired.count), { headers });
  } catch {
    return NextResponse.json({ error: "No se pudo confirmar la revisión del banco. Reintenta la consulta." }, { status: 503, headers });
  }
}
