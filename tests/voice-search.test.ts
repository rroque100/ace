import { expect, it } from "vitest";
import { spanishNumber, reviewVoiceText, voiceFallback, guardVoiceProposal, voiceSearchInput, audioMimeFromBytes } from "@/lib/voice-search";

it("convierte números españoles solo cuando la secuencia tiene sentido", () => {
  expect(spanishNumber("ciento trece")).toBe(113);
  expect(spanishNumber("dos mil veintiséis")).toBe(2026);
  expect(spanishNumber("treinta y dos mil sesenta y nueve")).toBe(32069);
  expect(spanishNumber("cero cero siete")).toBeNull();
  expect(spanishNumber("uno dos tres")).toBeNull();
  expect(spanishNumber("ciento")).toBeNull();
});
it("propone artículo y numeral sin modificar el texto recibido", () => {
  const original = "artículo ciento trece, numeral uno";
  expect(reviewVoiceText(original)).toMatchObject({ normalized: "artículo 113.1", ambiguous: false, references: ["113.1"] });
  expect(original).toBe("artículo ciento trece, numeral uno");
  expect(voiceFallback("Artículo 113.1 del reglamento").search.query).toBe("Artículo 113.1");
  expect(reviewVoiceText("resolución número cero cero siete del TCP").ambiguous).toBe(true);
  expect(reviewVoiceText("Artículo 113. Numeral uno.").normalized).toBe("Artículo 113.1.");
});
it("propone el año y conserva las siglas y el tema", () => {
  const result = reviewVoiceText("opiniones de la DTN del dos mil veintiséis sobre garantías");
  expect(result.normalized).toBe("opiniones de la DTN del 2026 sobre garantías");
  expect(voiceFallback(result.normalized).search).toMatchObject({ query: "garantías DTN", filters: { documentType: "opinion", year: 2026 } });
  expect(result.references).toEqual(["2026", "DTN"]);
});
it("pide aclarar alternativas y duda en vez de completar una referencia", () => {
  for (const text of ["artículo trece o ciento trece", "artículo trece o catorce", "artículo 13 o 113", "creo que artículo trece"]) {
    const review = reviewVoiceText(text); expect(review.ambiguous).toBe(true); expect(review.normalized).toBe(text);
  }
});
it("conserva los ceros de identificadores y las fechas expresas", () => {
  expect(reviewVoiceText("Opinión 000102-2026/DTN del 23/09/2026").normalized).toBe("Opinión 000102-2026/DTN del 23/09/2026");
  expect(voiceFallback("Opinión 000102-2026/DTN sobre garantías").search.query).toContain("000102");
  expect(voiceFallback("monto de 2026 soles").search.filters.year).toBeUndefined();
  expect(voiceFallback("artículo 2026").search.filters.year).toBeUndefined();
});
it("rechaza cifras inventadas u omitidas por el asistente", () => {
  const bad = voiceFallback("artículo 13");
  expect(guardVoiceProposal("artículo 113.1", bad).search.filters.article).toBe("113.1");
  expect(guardVoiceProposal("Opinión 000102-2026/DTN", voiceFallback("garantías de 2026")).search.query).toContain("000102");
  expect(guardVoiceProposal("opiniones DTN de 2026 sobre garantías", voiceFallback("opiniones TCP de 2026 sobre garantías")).search.query).toContain("DTN");
  const reassigned = voiceFallback("opiniones de 2026 sobre garantías");
  reassigned.search.filters = { article: "2026" };
  expect(guardVoiceProposal("opiniones de 2026 sobre garantías", reassigned).search.filters).toMatchObject({ year: 2026 });
  expect(guardVoiceProposal("opiniones de 2026 sobre garantías", reassigned).search.filters.article).toBeUndefined();
});
it("no acepta régimen o vigencia inferidos y conserva los filtros del usuario", () => {
  const safe = guardVoiceProposal("opiniones de 2026 sobre garantías", { ...voiceFallback("opiniones de 2026 sobre garantías"), search: { ...voiceFallback("opiniones de 2026 sobre garantías").search, filters: { regime: "32069", vigencia: "vigente", year: 2026 } } });
  expect(safe.search.filters.regime).toBeUndefined(); expect(safe.search.filters.vigencia).toBeUndefined();
  const input = voiceSearchInput({ regime: "30225", object: "obras", year: 2025, documentId: "43b7991a-0768-45c2-a1a0-7c4d0c62abef" }, safe);
  expect(input.filters).toMatchObject({ regime: "30225", object: "obras", year: 2026, documentType: "opinion" });
  expect(input.filters.documentId).toBeUndefined();
  expect(voiceSearchInput({ year: 2025 }, voiceFallback("garantías")).filters.year).toBe(2025);
});
it("valida las firmas de archivo, sin confiar en la extensión", () => {
  const webm = new Uint8Array(16); webm.set([0x1a, 0x45, 0xdf, 0xa3]); expect(audioMimeFromBytes(webm)).toBe("audio/webm");
  const wav = new TextEncoder().encode("RIFF0000WAVE0000"); expect(audioMimeFromBytes(wav)).toBe("audio/wav");
  expect(audioMimeFromBytes(new TextEncoder().encode("not-a-real-sound!"))).toBeNull();
});
