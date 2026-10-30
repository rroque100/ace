import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { examRpc, examError } from "@/lib/exam-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const a = await requireUser({usesAI:false});
  if ("error" in a) return a.error;
  try {
    return NextResponse.json(
      await examRpc("ace_exam_preparation", {
        p_actor: a.user.id,
        p_admin: a.user.isAdmin,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("report"),
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    reason: z.enum(["ambiguous", "key", "outdated", "explanation"]),
    comment: z.string().trim().max(2000).default(""),
  }),
  z.object({ action: z.literal("assemble") }),
  z.object({
    action: z.literal("resolve"),
    reportId: z.string().uuid(),
    resolution: z.string().trim().min(20).max(2000),
  }),
]);
export async function POST(request: Request) {
  const a = await requireUser({usesAI:false});
  if ("error" in a) return a.error;
  try {
    const p = action.parse(await request.json());
    if (p.action !== "report" && !a.user.isAdmin)
      return NextResponse.json(
        { error: "Requiere administración" },
        { status: 403 },
      );
    const result =
      p.action === "report"
        ? await examRpc("ace_exam_question_report", {
            p_actor: a.user.id,
            p_id: p.attemptId,
            p_question: p.questionId,
            p_reason: p.reason,
            p_comment: p.comment,
          })
        : p.action === "assemble"
          ? await examRpc("ace_exam_assemble", {
              p_actor: a.user.id,
              p_edition: `oece-${new Date().toISOString()}`,
            })
          : await examRpc("ace_exam_resolve_report", {
              p_actor: a.user.id,
              p_id: p.reportId,
              p_resolution: p.resolution,
            });
    return NextResponse.json({ result });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
