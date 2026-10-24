import { reviewVoiceText } from "./voice-search";
const tokens = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+(?:\.[a-z0-9]+)*/g) ?? [];
function wordErrorRate(expected: string, actual: string) {
  const a = tokens(expected), b = tokens(actual);
  if (!a.length) throw new Error("La evaluación necesita una transcripción de referencia.");
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] / a.length;
}
export function voiceEvaluation(expected: string, actual: string, expectedReferences: string[]) {
  const references = new Set(reviewVoiceText(actual).references);
  const expectedSet = new Set(expectedReferences.map(value => value.toUpperCase()));
  const missing = [...expectedSet].filter(value => !references.has(value));
  const extra = [...references].filter(value => !expectedSet.has(value));
  return { wordErrorRate: wordErrorRate(expected, actual), normalizedWordErrorRate: wordErrorRate(reviewVoiceText(expected).normalized, reviewVoiceText(actual).normalized), referencesExact: missing.length === 0 && extra.length === 0, missingReferences: missing, extraReferences: extra };
}
