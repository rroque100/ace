import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { examStartSchema } from "@/lib/exam-policy";
import { examRpc, examError } from "@/lib/exam-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const a = await requireUser({usesAI:false});
  if ("error" in a) return a.error;
  try {
    const [dashboard, available] = await Promise.all([
      examRpc("ace_exam_workspace", { p_actor: a.user.id }),
      examRpc("ace_exam_availability_by_difficulty", { p_admin: a.user.isAdmin }),
    ]);
    return NextResponse.json(
      {
        ...dashboard,
        isAdmin: a.user.isAdmin,
        available,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
export async function POST(request: Request) {
  const a = await requireUser({usesAI:false});
  if ("error" in a) return a.error;
  try {
    const p = examStartSchema.parse(await request.json());
    if (p.preview && !a.user.isAdmin)
      return NextResponse.json(
        { error: "Solo administración puede probar borradores." },
        { status: 403 },
      );
    const id =
      p.profile === "custom"
        ? await examRpc("ace_exam_start_filtered", {
            p_actor: a.user.id,
            p_competency: p.competency,
            p_difficulty: p.difficulty,
            p_mode: p.mode,
            p_count: p.count,
            p_minutes: p.minutes,
            p_regime: p.regime,
            p_topic: p.topic,
            p_preview: p.preview,
          })
        : await examRpc("ace_exam_start_prepared", {
            p_profile: p.profile,
            p_balotario: p.balotarioId ?? null,
            p_actor: a.user.id,
            p_mode: p.mode,
            p_count: p.count,
            p_minutes: p.minutes,
            p_regime: p.regime,
            p_topic: p.topic,
            p_preview: p.preview,
          });
    return NextResponse.json({ id });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
