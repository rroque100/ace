import fs from "node:fs";
async function main() {
  process.loadEnvFile(".env.local");
  const { getSupabaseAdminClient } = await import("../lib/supabase-server");
  const { EXAM_CURRICULUM } = await import("../lib/exam-curriculum");
  const c = await getSupabaseAdminClient();
  const owner = await c
    .from("exam_attempts")
    .select("owner_id")
    .limit(1)
    .single();
  if (owner.error) throw owner.error;
  const [catalog, questions, admin, ordinary] = await Promise.all([
    c.from("exam_curriculum").select("*"),
    c.from("exam_questions").select("*"),
    c.rpc("ace_exam_preparation", {
      p_actor: owner.data.owner_id,
      p_admin: true,
    }),
    c.rpc("ace_exam_preparation", {
      p_actor: owner.data.owner_id,
      p_admin: false,
    }),
  ]);
  for (const r of [catalog, questions, admin, ordinary])
    if (r.error) throw r.error;
  if (
    catalog.data!.length !== 30 ||
    catalog.data!.reduce((n, x) => n + x.quota, 0) !== 72
  )
    throw Error("Temario incompleto");
  if (
    ordinary.data.metrics.length ||
    ordinary.data.reports.length ||
    ordinary.data.authoring.length
  )
    throw Error("Datos editoriales expuestos");
  const all = questions.data!;
  const newQuestions = all.filter(
    (q) => q.curriculum_version === "oece-2025-04-25",
  );
  const sourceIds = [
    ...new Set(
      newQuestions.flatMap((q) =>
        q.sources.map((s: { chunkId: string }) => s.chunkId),
      ),
    ),
  ];
  let sources = 0;
  for (let i = 0; i < sourceIds.length; i += 100) {
    const chunks = await c
      .from("document_chunks")
      .select("id,document_id,content,page_start,page_end")
      .in("id", sourceIds.slice(i, i + 100));
    if (chunks.error) throw chunks.error;
    for (const chunk of chunks.data) {
      for (const q of newQuestions) {
        for (const s of q.sources.filter(
          (s: { chunkId: string }) => s.chunkId === chunk.id,
        )) {
          const norm = (x: string) => x.replace(/\s+/g, " ").trim();
          if (
            !norm(chunk.content).includes(norm(s.quote)) ||
            s.documentId !== chunk.document_id ||
            s.pageStart !== chunk.page_start ||
            s.pageEnd !== chunk.page_end
          )
            throw Error("Fuente sin correspondencia exacta");
          sources++;
        }
      }
    }
  }
  const byCode = EXAM_CURRICULUM.map((s) => ({
    code: s.code,
    target: s.target,
    drafts: newQuestions.filter(
      (q) => q.subcompetency_code === s.code && q.status === "draft",
    ).length,
    published: newQuestions.filter(
      (q) => q.subcompetency_code === s.code && q.status === "published",
    ).length,
  }));
  const report = {
    checkedAt: new Date().toISOString(),
    catalog: catalog.data!.length,
    quotas: ["1", "2", "3"].map((k) =>
      catalog
        .data!.filter((x) => x.competency === k)
        .reduce((n, x) => n + x.quota, 0),
    ),
    questions: all.length,
    classifiedDrafts: newQuestions.filter((q) => q.status === "draft").length,
    published: newQuestions.filter((q) => q.status === "published").length,
    sourceReferencesVerified: sources,
    editorialDataIsolated: true,
    difficulty: newQuestions.reduce(
      (m: Record<string, number>, q) => ({
        ...m,
        [q.difficulty]: (m[q.difficulty] ?? 0) + 1,
      }),
      {},
    ),
    cognitive: newQuestions.reduce(
      (m: Record<string, number>, q) => ({
        ...m,
        [q.cognitive_level]: (m[q.cognitive_level] ?? 0) + 1,
      }),
      {},
    ),
    coverage: byCode,
  };
  fs.writeFileSync(
    "docs/importaciones/simulador-preparacion-verificacion-2026-10-29.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
