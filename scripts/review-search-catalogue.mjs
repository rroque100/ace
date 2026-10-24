// Explicit title identification, with evidence. No assertion of applicability/current law.
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
process.loadEnvFile(".env.local");
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { loadSearchCatalogue } = await server.ssrLoadModule("/lib/document-search-server.ts");
  const { declaredRegime } = await server.ssrLoadModule("/lib/document-review.ts");
  const { reviewedRegime } = await server.ssrLoadModule("/lib/legal-workspace-filters.ts");
  const { getSupabaseAdminClient } = await server.ssrLoadModule("/lib/supabase-server.ts");
  const rows = await loadSearchCatalogue();
  const apply = process.argv.includes("--apply");
  const client = apply ? await getSupabaseAdminClient() : null;
  const changes = [];
  for (const row of rows) {
    if (reviewedRegime(row.metadata) !== "no_determinado") continue;
    let identified = declaredRegime(row.title, row.metadata);
    // These ten imported bases retain this exact provenance; no year-based inference.
    if (!identified && row.document_type === "bases_estandar" && row.metadata.officialPublicationUrl === "https://www.gob.pe/institucion/mef/normas-legales/6683111") {
      identified = { regime: "32069", evidence: "Bases estándar en el marco de la Ley N.º 32069 · R.D. 0015-2025-EF/54.01 · publicación oficial 20.04.2025", method: "official-publication-title", scope: "documentary-identification", humanReviewed: false, source: row.metadata.officialPublicationUrl };
    }
    if (!identified) continue;
    const checkedAt = new Date().toISOString();
    const metadata = { ...row.metadata, regime: identified.regime, regimeReviewStatus: "confirmed", regimeReview: { ...identified, checkedAt }, regimeReviewScope: "documentary-identification-only" };
    if (client) {
      // Protect against concurrent metadata edits; do not overwrite a newer review.
      const { data: current, error: readError } = await client.from("documents").select("metadata,updated_at").eq("id", row.id).single();
      if (readError) throw readError;
      if (JSON.stringify(current.metadata) !== JSON.stringify(row.metadata)) throw Error("Metadatos cambiaron durante la revisión; repetir auditoría.");
      const { data, error } = await client.from("documents").update({ metadata }).eq("id", row.id).eq("es_institucional", true).eq("updated_at", current.updated_at).select("id");
      if (error || data?.length !== 1) throw error ?? Error("No se guardó la revisión por concurrencia");
    }
    changes.push({ documentId: row.id, title: row.title, ...identified, checkedAt });
  }
  const refreshed = apply ? await loadSearchCatalogue() : rows;
  const report = { runAt: new Date().toISOString(), applied: apply, humanLegalReview: "pending", total: rows.length, changed: changes, regimes: Object.fromEntries(["32069", "30225", "especial", "no_determinado"].map(regime => [regime, refreshed.filter(row => reviewedRegime(row.metadata) === regime).length])), documents: refreshed.map(row => ({ id: row.id, title: row.title, type: row.document_type, regime: reviewedRegime(row.metadata), review: row.metadata.regimeReview ?? null, officialPublicationUrl: row.metadata.officialPublicationUrl ?? null })) };
  await writeFile("docs/evaluaciones/catalogue-review-2026-10-24.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ applied: apply, identified: changes.length, total: rows.length, regimes: report.regimes }));
} finally { await server.close(); }
