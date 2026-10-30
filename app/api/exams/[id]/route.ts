import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { examSaveSchema, publicExam, type RawExam } from "@/lib/exam-policy";
import { getExam, examRpc, examError } from "@/lib/exam-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type C = { params: Promise<{ id: string }> };
async function actor(
  context: C,
): Promise<{ error: Response } | { id: string; user: SessionUser }> {
  const a = await requireUser({usesAI:false});
  if ("error" in a) return { error: a.error };
  const p = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  if (!p.success)
    return {
      error: NextResponse.json({ error: "Intento inválido." }, { status: 400 }),
    };
  return { id: p.data, user: a.user };
}
export async function GET(_: Request, ctx: C) {
  const a = await actor(ctx);
  if ("error" in a) return a.error;
  try {
    return NextResponse.json(await getExam(a.user.id, a.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
export async function PATCH(request: Request, ctx: C) {
  const a = await actor(ctx);
  if ("error" in a) return a.error;
  try {
    const p = examSaveSchema.parse(await request.json());
    return NextResponse.json(
      publicExam(
        (await examRpc("ace_exam_save", {
          p_actor: a.user.id,
          p_id: a.id,
          p_revision: p.revision,
          p_question: p.questionId,
          p_option: p.option,
          p_flagged: p.flagged,
        })) as RawExam,
      ),
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
export async function POST(request: Request, ctx: C) {
  const a = await actor(ctx);
  if ("error" in a) return a.error;
  try {
    const p = z
      .object({ action: z.enum(["submit", "cancel"]) })
      .parse(await request.json());
    return NextResponse.json(
      publicExam(
        (await examRpc("ace_exam_finish", {
          p_actor: a.user.id,
          p_id: a.id,
          p_action: p.action,
        })) as RawExam,
      ),
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
