export {};
async function main() {
  process.loadEnvFile(".env.local");
  const { getSupabaseAdminClient } = await import("../lib/supabase-server");
  const { topicFocus, nearDuplicate } =
    await import("../lib/exam-authoring-policy");
  const { examQuestionSchema } = await import("../lib/exam-policy");
  const { examRpc } = await import("../lib/exam-server");
  const c = await getSupabaseAdminClient();
  const owner = await c
    .from("exam_attempts")
    .select("owner_id")
    .limit(1)
    .single();
  if (owner.error) throw owner.error;
  const batches = await c
    .from("exam_authoring_batches")
    .select("id")
    .eq("state", "running");
  if (batches.error) throw batches.error;
  for (const b of batches.data) {
    const saved=await c.from("exam_questions").select("id",{count:"exact",head:true}).like("origin",`%${b.id}`);
    if(saved.error)throw saved.error;
    const r = await c
      .from("exam_authoring_batches")
      .update({
        state: "failed",
        created_count:saved.count??0,
        finished_at: new Date().toISOString(),
        detail:
          "Tarea interrumpida para reforzar clasificación y duplicados; los borradores guardados se conservan.",
      })
      .eq("id", b.id);
    if (r.error) throw r.error;
  }
  const rows = await c
    .from("exam_questions")
    .select("*")
    .eq("status", "draft")
    .like("origin", "IA:%")
    .order("created_at");
  if (rows.error) throw rows.error;
  const seen: string[] = [];
  let unclassified = 0,
    duplicates = 0;
  for (const q of rows.data) {
    if (q.revision !== 0) continue;
    const duplicate = seen.some((p) => nearDuplicate(p, q.prompt)),
      bad = !topicFocus(q.subcompetency_code, q.prompt + " " + q.explanation);
    if (!duplicate && !bad) {
      seen.push(q.prompt);
      continue;
    }
    const draft = examQuestionSchema.parse({
      ...q,
      correctOption: q.correct_option,
      reviewBasis: duplicate
        ? "Retirado por detección automática de similitud; requiere revisión editorial antes de reactivar."
        : "Clasificación automática retirada por falta de correspondencia temática; revisión humana pendiente.",
      curriculumVersion: duplicate ? q.curriculum_version : "",
      competencyCode: duplicate ? q.competency_code : "",
      subcompetencyCode: duplicate ? q.subcompetency_code : "",
      cognitiveLevel: q.cognitive_level,
      optionRationales: q.option_rationales,
      reviewChecks: q.review_checks,
      sourceCutoff: q.source_cutoff,
      topic: bad ? "Clasificación por revisar" : q.topic,
      competency: bad ? "Marco general" : q.competency,
      status: duplicate ? "retired" : "draft",
      confirmReview: false,
    });
    await examRpc("ace_exam_edit", {
      p_actor: owner.data.owner_id,
      p_input: draft,
    });
    if (duplicate) duplicates++;
    else unclassified++;
  }
  console.log(
    JSON.stringify({ unclassified, duplicates, reviewedByHuman: false }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
