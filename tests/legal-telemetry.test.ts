import { expect, it } from "vitest";
import { legalResponseTelemetry } from "@/lib/legal-telemetry";
it("registra modelo efectivo y tiempos sin inventar coste o precisión", () => {
  const result = legalResponseTelemetry({
    startedAt: 100,
    retrievedAt: 350,
    finishedAt: 900,
    provider: "gemini",
    model: "gemini-2.5-flash",
    officialSources: 3,
    caseDocuments: 1,
    warnings: 2,
  });
  expect(result).toMatchObject({
    provider: "gemini",
    model: "gemini-2.5-flash",
    retrievalMs: 250,
    totalMs: 800,
    costUsd: null,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /question|facts|api.key|precision/i,
  );
});
it("distingue respuesta extractiva de generación del proveedor", () => {
  expect(
    legalResponseTelemetry({
      startedAt: 0,
      retrievedAt: 1,
      finishedAt: 2,
      provider: "gemini",
      model: "fallback-source-extract (private error)",
      officialSources: 1,
      caseDocuments: 0,
      warnings: 0,
    }),
  ).toMatchObject({ provider: "extractivo", model: "extracción de fuentes" });
});
