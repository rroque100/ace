import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { examRpc, examError, getExam } from "@/lib/exam-server";
import { ownStudyHistory } from "@/lib/exam-learning-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  try {
    const c = await getSupabaseAdminClient();
    if (new URL(request.url).searchParams.get("queue") === "1") {
      if (!auth.user.isAdmin)
        return NextResponse.json(
          { error: "Requiere administración" },
          { status: 403 },
        );
      const [q, t] = await Promise.all([
        c
          .from("exam_questions")
          .select("id,revision,prompt,subcompetency_code,created_at", {
            count: "exact",
          })
          .eq("status", "draft")
          .order("created_at")
          .limit(1000),
        c
          .from("exam_editorial_tasks")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1000),
      ]);
      if (q.error || t.error) throw q.error ?? t.error;
      return NextResponse.json(
        {
          queue: q.data ?? [],
          total: q.count ?? 0,
          tasks: (t.data ?? []).map((task) => ({
            ...task,
            mine: task.assigned_to === auth.user.id,
            assigned_to: undefined,
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const attemptId = new URL(request.url).searchParams.get("attemptId");
    if (attemptId) {
      z.string().uuid().parse(attemptId);
      const exam = await getExam(auth.user.id, attemptId);
      if (exam.attempt.state !== "submitted")
        return NextResponse.json(
          { error: "Entrega el intento para consultar su informe" },
          { status: 409 },
        );
      const r = await c
        .from("exam_activity")
        .select("question_id,seconds")
        .eq("attempt_id", attemptId);
      if (r.error) throw r.error;
      return NextResponse.json(
        { activity: r.data ?? [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const history = await ownStudyHistory(auth.user.id);
    let tasks: unknown[] = [];
    if (auth.user.isAdmin) {
      const r = await c
        .from("exam_editorial_tasks")
        .select(
          "question_id,question_revision,assigned_to,state,note,history,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200);
      if (r.error) throw r.error;
      tasks = (r.data ?? []).map((t) => ({
        ...t,
        mine: t.assigned_to === auth.user.id,
        assigned_to: undefined,
      }));
    }
    const setAttempts = history.attempts
      .filter((t) => t.balotario_id)
      .map((t) => ({
        setId: t.balotario_id,
        attemptId: t.id,
        date: t.finished_at,
        result: (t as unknown as { result: unknown }).result,
      }));
    return NextResponse.json(
      {
        reviews: history.reviews,
        limited: history.limited,
        tasks,
        setAttempts,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("scheduled"),
    regime: z.enum(["32069", "30225"]),
  }),
  z.object({
    action: z.literal("checkpoint"),
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("editorial"),
    questionId: z.string().uuid(),
    revision: z.number().int().min(0),
    state: z.enum(["reviewing", "blocked", "pending"]),
    note: z.string().trim().min(10).max(2000),
  }),
]);
export async function POST(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  try {
    const p = body.parse(await request.json());
    if (p.action === "editorial" && !auth.user.isAdmin)
      return NextResponse.json(
        { error: "Requiere administración" },
        { status: 403 },
      );
    if (p.action === "scheduled") {
      const h = await ownStudyHistory(auth.user.id);
      const ids = h.reviews
        .filter((r) => r.regime === p.regime && r.available && r.due)
        .slice(0, 10)
        .map((r) => r.questionId);
      if (!ids.length)
        return NextResponse.json(
          { error: "No tienes repasos programados disponibles para hoy" },
          { status: 409 },
        );
      const id = await examRpc("ace_exam_start_scheduled", {
        p_actor: auth.user.id,
        p_ids: ids,
      });
      return NextResponse.json({ id });
    }
    if (p.action === "checkpoint") {
      await examRpc("ace_exam_checkpoint", {
        p_actor: auth.user.id,
        p_id: p.attemptId,
        p_question: p.questionId,
      });
      return NextResponse.json({ ok: true });
    }
    await examRpc("ace_exam_editorial_task", {
      p_actor: auth.user.id,
      p_question: p.questionId,
      p_revision: p.revision,
      p_state: p.state,
      p_note: p.note,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
