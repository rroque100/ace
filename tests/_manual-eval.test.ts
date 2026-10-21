import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// TEMP: corrida manual de evaluacion. Se elimina tras usarlo.
const envText = readFileSync("D:/ace/.env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[match[1]]) process.env[match[1]] = value;
}

describe("manual eval baseline", () => {
  it(
    "run",
    async () => {
      const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!token) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
      const { runEvaluation } = await import("@/lib/legal-eval");
      const run = await runEvaluation(token);
      // Persistimos un archivo para leerlo con certeza (los console.log de vitest se filtran mal).
      const failures = run.results
        .filter((row) => row.score < 0.8)
        .map((row) => ({ q: row.question, score: row.score, feedback: row.feedback }));
      const out = { summary: run.corrida.summary, corrida: run.corrida.id, low: failures };
      const { writeFileSync } = await import("node:fs");
      writeFileSync("D:/ace/.eval-out.json", JSON.stringify(out, null, 2));
      expect(run.results.length).toBeGreaterThan(0);
    },
    900000,
  );
});
