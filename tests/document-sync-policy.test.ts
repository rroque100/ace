import { describe, it, expect } from "vitest";
import {
  syncSettingsSchema,
  syncSourceSchema,
  syncCodeMatches,
  isSyncCreditError,
  syncQuoteMatches,
  syncPrintedPagesIncomplete,
  syncHistoricalNext,
} from "../lib/document-sync-policy";
import { matchesExtendedFilters } from "../lib/legal-workspace-filters";
describe("actualización institucional", () => {
  it("continúa por fecha cuando el catálogo no admite más de 100 páginas", () => {
    const next = syncHistoricalNext(
      "https://www.gob.pe/institucion/oece/normas-legales?filter%5Bterms%5D=TCP",
      "https://www.gob.pe/institucion/oece/normas-legales?sheet=101",
      ["2026-01-03", "2026-01-02"],
    );
    const u = new URL(next!);
    expect(u.searchParams.get("filter[end_date]")).toBe("2026-01-02");
    expect(u.searchParams.get("filter[terms]")).toBe("TCP");
    expect(u.searchParams.has("sheet")).toBe(false);
    expect(() =>
      syncHistoricalNext(
        "https://www.gob.pe/institucion/oece/normas-legales?filter%5Bend_date%5D=2026-01-02",
        "https://www.gob.pe/institucion/oece/normas-legales?sheet=101",
        ["2026-01-02"],
      ),
    ).toThrow();
  });
  it("advierte un original numerado como páginas 2 y 3 de 3", () => {
    expect(
      syncPrintedPagesIncomplete([
        { text: "Página 2 de 3" },
        { text: "Página 3 de 3" },
      ]),
    ).toBe(true);
    expect(
      syncPrintedPagesIncomplete([
        { text: "Página 1 de 2" },
        { text: "Página 2 de 2" },
      ]),
    ).toBe(false);
    expect(
      syncPrintedPagesIncomplete([
        { text: "Portada" },
        { text: "Página 1 de 1" },
      ]),
    ).toBe(false);
  });
  it("los regímenes mixtos solo cuentan con clasificación comprobada", () => {
    const s = {
      documentType: "resolucion",
      year: 2026,
      regime: "30225",
      regimeReviewed: true,
      metadata: { declaredRegimes: ["30225", "32069"] },
    };
    expect(matchesExtendedFilters(s, { regime: "32069" })).toBe(true);
    expect(
      matchesExtendedFilters(
        { ...s, regimeReviewed: false },
        { regime: "32069" },
      ),
    ).toBe(false);
  });
  it("limita descargas diarias y exige regímenes explícitos", () => {
    expect(
      syncSettingsSchema.safeParse({ enabled: true, dailyLimit: 101 }).success,
    ).toBe(false);
    expect(
      syncSourceSchema.safeParse({
        sourceId: "bad",
        enabled: true,
        documentTypes: [],
        regimes: ["inventado"],
        codePrefix: "TCP-S",
      }).success,
    ).toBe(false);
  });
  it("reconoce salas sin depender de una consulta literal", () => {
    expect(syncCodeMatches("Resolución 12-2026-TCP-S1", "TCP-S")).toBe(true);
    expect(syncCodeMatches("Resolución 12-2026-TCP- S6", "TCP-S")).toBe(true);
    expect(syncCodeMatches("Resolución 12-2026-TCE-S1", "TCP-S")).toBe(false);
  });
  it("corta reintentos de crédito y verifica citas literales", () => {
    expect(
      isSyncCreditError("Google embeddings 402 credits are depleted"),
    ).toBe(true);
    expect(isSyncCreditError("HTTP 503")).toBe(false);
    expect(
      syncQuoteMatches(
        "Una norma contiene texto que realmente corresponde a esta página.",
        "Una norma contiene texto que realmente corresponde",
      ),
    ).toBe(true);
    expect(
      syncQuoteMatches(
        "Una norma contiene texto",
        "Una conclusión inventada que no aparece en la página",
      ),
    ).toBe(false);
  });
});
