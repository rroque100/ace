// Explicit evaluation of authorized audio. No microphone access, storage or history writes.
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
process.loadEnvFile(".env.local");
if (!process.argv[2] || !process.argv[3]) throw new Error("Indica el manifiesto de audios autorizados y el archivo de resultados.");
const manifest = JSON.parse((await readFile(process.argv[2], "utf8")).replace(/^\uFEFF/, ""));
if (!Array.isArray(manifest.cases) || manifest.cases.length < 1 || manifest.cases.length > 20) throw new Error("Usa entre 1 y 20 grabaciones autorizadas por ejecución.");
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { transcribeSearchAudio } = await server.ssrLoadModule("/lib/voice-transcription.ts");
  const { audioMimeFromBytes, VOICE_MAX_BYTES } = await server.ssrLoadModule("/lib/voice-search.ts");
  const { voiceEvaluation } = await server.ssrLoadModule("/lib/voice-evaluation.ts");
  const results = [];
  for (const model of (process.argv.includes("--gemini-only") ? ["gemini-2.5-flash"] : ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gemini-2.5-flash"])) {
    process.env.VOICE_TRANSCRIPTION_PROVIDER = model.startsWith("gemini") ? "gemini" : "openai";
    process.env.OPENAI_TRANSCRIPTION_MODEL = model;
    for (const item of manifest.cases) {
      if (!item.audioFile || !item.text || !Array.isArray(item.expected)) throw new Error("Cada caso requiere audioFile, text y expected; no se considerarán correctos casos pendientes de grabación.");
      const bytes = await readFile(item.audioFile);
      const mime = audioMimeFromBytes(bytes);
      if (!mime || bytes.length > VOICE_MAX_BYTES) throw new Error("Audio de evaluación no válido.");
      const started = performance.now();
      try {
        const response = await transcribeSearchAudio(new File([bytes], `evaluation.${mime.split("/")[1]}`, { type: mime }));
        results.push({ caseId: item.id, model, elapsedMs: Math.round(performance.now() - started), transcript: response.text, uncertain: response.uncertain, ...voiceEvaluation(item.text, response.text, item.expected) });
      } catch { results.push({ caseId: item.id, model, elapsedMs: Math.round(performance.now() - started), failed: true }); }
    }
  }
  const report = { kind: manifest.kind || "authorized-voice-evaluation", humanReview: "pending", peruvianAccentValidated: false, runAt: new Date().toISOString(), results };
  await writeFile(process.argv[3], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ cases: manifest.cases.length, runs: results.length, failures: results.filter(item => item.failed).length, exactReferences: results.filter(item => item.referencesExact).length, kind: report.kind }));
  if (results.some(item => item.failed || !item.referencesExact)) process.exitCode = 1;
} finally { await server.close(); }
