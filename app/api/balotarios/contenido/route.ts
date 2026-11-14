import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { revisionBalotario } from "@/lib/balotarios-policy";
import { catalogoRevisado, errorBalotario } from "@/lib/balotarios-server";
import { catalogoBalotarios, diagnosticoBalotarios } from "@/lib/balotarios-catalogo";
import { validateExamSources } from "@/lib/exam-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const a = await requireUser({ usesAI: false });
  if ("error" in a) return a.error;
  try {
    const catalogo = await catalogoRevisado();
    let reports: unknown[] | undefined;
    if (a.user.isAdmin) {
      const c = await getSupabaseAdminClient();
      const r = await c.from("balotario_reports").select("id,question_id,reason,created_at").order("created_at", { ascending: false }).limit(100);
      if (r.error) throw r.error;
      reports = r.data;
    }
    return NextResponse.json({ catalogo, reports, diagnostico: a.user.isAdmin ? diagnosticoBalotarios().map(q => ({ ...q, revisada: catalogo.some(b => b.preguntas.some(p => p.id === q.id && p.revisada)) })) : undefined }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const x = errorBalotario(e);
    return NextResponse.json({ catalogo: catalogoBalotarios, error: x.message }, { status: x.status, headers: { "Cache-Control": "no-store" } });
  }
}
export async function POST(request: Request) {
  const a = await requireUser({ usesAI: false });
  if ("error" in a) return a.error;
  try {
    const body = await request.json();
    if (body.action !== "report" && !a.user.isAdmin) return NextResponse.json({ error: "Requiere administración" }, { status: 403 });
    const c = await getSupabaseAdminClient();
    if (body.action === "report") {
      const p = z.object({ questionId: z.string().regex(/^b[1-5]-q\d+$/), reason: z.string().trim().min(10).max(2000) }).parse(body);
      if (!catalogoBalotarios.some(b => b.preguntas.some(q => q.id === p.questionId))) return NextResponse.json({ error: "Pregunta inválida" }, { status: 400 });
      const { error } = await c.from("balotario_reports").insert({ owner_id: a.user.id, question_id: p.questionId, reason: p.reason });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const p = revisionBalotario.parse(body);
    if (!catalogoBalotarios.some(b => b.preguntas.some(q => q.id === p.questionId))) return NextResponse.json({ error: "Pregunta inválida" }, { status: 400 });
    try { await validateExamSources({ regime: "32069", sources: p.sources }); }
    catch (e) { return NextResponse.json({ error: `No se publicó la revisión: ${(e as Error).message}` }, { status: 400 }); }
    const { error } = await c.from("balotario_reviews").upsert({ question_id: p.questionId, prompt: p.prompt, options: p.options, competency: p.competency, correct: p.correct, explanation: p.explanation, sources: p.sources, reviewed_by: a.user.id, reviewed_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const x = errorBalotario(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
