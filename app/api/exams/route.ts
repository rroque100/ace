import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { examStartSchema } from "@/lib/exam-policy";
import { examRpc, examError } from "@/lib/exam-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  try {
    return NextResponse.json(
      {
        ...(await examRpc("ace_exam_dashboard", {
          p_actor: a.user.id,
          p_admin: a.user.isAdmin,
        })),
        isAdmin: a.user.isAdmin,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
export async function POST(request: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  try {
    const p = examStartSchema.parse(await request.json());
    if (p.preview && !a.user.isAdmin)
      return NextResponse.json(
        { error: "Solo administración puede probar borradores." },
        { status: 403 },
      );
    const id = await examRpc("ace_exam_start_prepared", {
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
