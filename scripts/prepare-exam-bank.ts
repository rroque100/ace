import fs from "node:fs";
async function main() {
  process.loadEnvFile(".env.local");
  const { prepareExamDrafts } = await import("../lib/exam-authoring");
  const { EXAM_CURRICULUM, CURRICULUM_VERSION } =
    await import("../lib/exam-curriculum");
  const { getSupabaseAdminClient } = await import("../lib/supabase-server");
  const c = await getSupabaseAdminClient();
  const owner = await c
    .from("exam_attempts")
    .select("owner_id")
    .limit(1)
    .single();
  if (owner.error) throw owner.error;
  const only = process.argv.find((a) => a.startsWith("--code="))?.split("=")[1];
  const report: unknown[] = [];
  for (const sub of EXAM_CURRICULUM.filter((s) => !only || s.code === only)) {
    let failures = 0;
    for (let i = 0; i < 20; i++) {
      const count = await c
        .from("exam_questions")
        .select("id", { count: "exact", head: true })
        .eq("curriculum_version", CURRICULUM_VERSION)
        .eq("subcompetency_code", sub.code)
        .in("status", ["draft", "published"]);
      if (count.error) throw count.error;
      if ((count.count ?? 0) >= sub.target) break;
      try {
        const result = await prepareExamDrafts(
          owner.data.owner_id,
          sub.code,
          Math.min(8, sub.target - (count.count ?? 0)),
        );
        report.push({ code: sub.code, ...result });
        console.log(JSON.stringify({ code: sub.code, ...result }));
        if (!result.created) {
          failures++;
          if (failures >= 2) break;
        } else failures = 0;
      } catch (e) {
        report.push({ code: sub.code, error: (e as Error).message });
        fs.writeFileSync(
          "docs/importaciones/simulador-autoria-oece-2026-10-29.json",
          JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
        );
        console.error(
          JSON.stringify({ code: sub.code, error: (e as Error).message }),
        );
        if (/cuota|402|429/.test((e as Error).message)) throw e;
        if ((e as { status?: number }).status) throw e;
        break;
      }
      fs.writeFileSync(
        "docs/importaciones/simulador-autoria-oece-2026-10-29.json",
        JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
      );
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
