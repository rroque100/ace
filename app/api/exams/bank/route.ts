import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { examQuestionSchema } from "@/lib/exam-policy";
import { examRpc, examError, validateExamSources } from "@/lib/exam-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  try {
    const c = await getSupabaseAdminClient();
    const params = new URL(request.url).searchParams;
    const doc = params.get("documentId");
    if (doc) {
      z.string().uuid().parse(doc);
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(20000)
        .parse(params.get("page") ?? 1);
      const [d, x] = await Promise.all([
        c
          .from("documents")
          .select("id,title,metadata")
          .eq("id", doc)
          .eq("es_institucional", true)
          .eq("status", "indexed")
          .single(),
        c
          .from("document_chunks")
          .select("id,content,page_start,page_end,metadata")
          .eq("document_id", doc)
          .lte("page_start", page)
          .gte("page_end", page)
          .order("chunk_index")
          .limit(30),
      ]);
      if (d.error || x.error) throw d.error ?? x.error;
      return NextResponse.json({ document: d.data, chunks: x.data });
    }
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(params.get("page") ?? 1);
    const [q, docs] = await Promise.all([
      c
        .from("exam_questions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * 30, page * 30 - 1),
      c
        .from("documents")
        .select("id,title,metadata")
        .eq("es_institucional", true)
        .eq("status", "indexed")
        .in("document_type", ["ley", "reglamento"])
        .order("title")
        .limit(40),
    ]);
    if (q.error || docs.error) throw q.error ?? docs.error;
    return NextResponse.json(
      { questions: q.data, total: q.count, page, documents: docs.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
export async function POST(request: Request) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  try {
    const p = examQuestionSchema.parse(await request.json());
    if (p.status !== "retired") await validateExamSources(p);
    const id = await examRpc("ace_exam_edit", {
      p_actor: a.user.id,
      p_input: p,
    });
    return NextResponse.json({ id });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
