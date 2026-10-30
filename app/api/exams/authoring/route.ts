import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prepareExamDrafts } from "@/lib/exam-authoring";
import { examError } from "@/lib/exam-server";
export const maxDuration = 180;
export async function POST(request: Request) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  try {
    const p = z
      .object({
        code: z.string().regex(/^[1-3]\.\d{1,2}$/),
        count: z.number().int().min(1).max(8).default(6),
      })
      .parse(await request.json());
    return NextResponse.json(
      await prepareExamDrafts(a.user.id, p.code, p.count),
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
