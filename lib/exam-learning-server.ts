import { getSupabaseAdminClient } from "./supabase-server";
import { scheduledReviews, type StudyAttempt } from "./exam-learning-policy";
import type { ExamAnswer } from "./exam-policy";
export async function ownStudyHistory(actor: string) {
  const c = await getSupabaseAdminClient();
  const t = await c
    .from("exam_attempts")
    .select(
      "id,started_at,finished_at,preview,state,regime,questions,balotario_id,result",
    )
    .eq("owner_id", actor)
    .eq("state", "submitted")
    .eq("preview", false)
    .order("finished_at", { ascending: false })
    .limit(100);
  if (t.error) throw t.error;
  const attempts = (t.data ?? []) as StudyAttempt[];
  const answers: Array<ExamAnswer & { attempt_id: string }> = [];
  if (attempts.length)
    for (let offset = 0; offset < 8000; offset += 1000) {
      const a = await c
        .from("exam_answers")
        .select("attempt_id,question_id,option,flagged")
        .in(
          "attempt_id",
          attempts.map((t) => t.id),
        )
        .range(offset, offset + 999);
      if (a.error) throw a.error;
      answers.push(...(a.data ?? []));
      if ((a.data ?? []).length < 1000) break;
    }
  const reviews = scheduledReviews(attempts, answers);
  const e = reviews.length
    ? await c.rpc("ace_exam_learning_eligible", {
        p_ids: reviews.map((r) => r.questionId),
      })
    : { data: [], error: null };
  if (e.error) throw e.error;
  const eligible = new Map(
    (e.data ?? []).map((q: { id: string; revision: number }) => [
      q.id,
      q.revision,
    ]),
  );
  return {
    attempts,
    answers,
    reviews: reviews.map((r) => ({
      ...r,
      ...(eligible.has(r.questionId) &&
      eligible.get(r.questionId) !== r.revision
        ? {
            due: true,
            dueAt: new Date().toISOString(),
            stage: 0,
            status: "pendiente" as const,
          }
        : {}),
      available: eligible.has(r.questionId),
      updated:
        eligible.has(r.questionId) && eligible.get(r.questionId) !== r.revision,
    })),
    limited: attempts.length === 100,
  };
}
