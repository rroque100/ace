import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getExam, examError } from "@/lib/exam-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  try {
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const attempt = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("attemptId"));
    const exam = await getExam(auth.user.id, attempt);
    const source = exam.attempt.questions
      .flatMap((q) => q.sources ?? [])
      .find((s) => s.documentId === id);
    if (!source)
      return NextResponse.json(
        { error: "La fuente no está disponible para este intento." },
        { status: 404 },
      );
    const c = await getSupabaseAdminClient();
    const d = await c
      .from("documents")
      .select("storage_bucket,storage_path,metadata")
      .eq("id", id)
      .eq("es_institucional", true)
      .single();
    if (d.error) throw d.error;
    if (d.data.metadata?.sha256 !== source.sha256)
      return NextResponse.json(
        { error: "La versión del PDF cambió; requiere nueva revisión." },
        { status: 409 },
      );
    const signed = await c.storage
      .from(d.data.storage_bucket)
      .createSignedUrl(d.data.storage_path, 60);
    if (signed.error) throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const x = examError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
