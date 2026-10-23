export const LEGAL_PROMPT_VERSION = "centro-juridico-casos-v2-2026-10-22";
export type LegalResponseTelemetry = {
  provider: string;
  model: string;
  promptVersion: string;
  retrievalMs: number;
  totalMs: number;
  officialSources: number;
  caseDocuments: number;
  warnings: number;
  costUsd: null;
};
export function legalResponseTelemetry(input: {
  startedAt: number;
  retrievedAt: number;
  finishedAt: number;
  provider: string;
  model: string;
  officialSources: number;
  caseDocuments: number;
  warnings: number;
}): LegalResponseTelemetry {
  const fallback = input.model.startsWith("fallback-");
  const noGeneration = input.model === "out-of-scope";
  return {
    provider: noGeneration
      ? "sin generación"
      : fallback
        ? "extractivo"
        : input.provider,
    model: fallback ? "extracción de fuentes" : input.model,
    promptVersion: LEGAL_PROMPT_VERSION,
    retrievalMs: Math.max(0, input.retrievedAt - input.startedAt),
    totalMs: Math.max(0, input.finishedAt - input.startedAt),
    officialSources: input.officialSources,
    caseDocuments: input.caseDocuments,
    warnings: input.warnings,
    costUsd: null,
  };
}
