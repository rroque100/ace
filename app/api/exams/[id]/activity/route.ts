import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { examRpc, examError } from "@/lib/exam-server";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  try {
    const id = z
      .string()
      .uuid()
      .parse((await ctx.params).id);
    const p = z
      .object({ questionId: z.string().uuid() })
      .parse(await request.json());
    await examRpc("ace_exam_activity", {
      p_actor: a.user.id,
      p_id: id,
      p_question: p.questionId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
