import { checkCitationFaithfulness } from "./citation-faithfulness";
import { checkedSourcePages, citedSourceNumbers } from "./chat-source-locations";
import { evidenceClaims, selectCoherentEvidence, type AuditSource, type EvidenceReview } from "./chat-evidence-audit";
import type { CaseContext } from "./chat-case-context";

function sourceLabel(source: AuditSource, quote = "") {
  const pages = checkedSourcePages(source.pageStart ?? null, source.pageEnd ?? null, source.pageCount);
  const escapedArticle = source.article?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const numeral = source.numeral ?? (escapedArticle ? quote.match(new RegExp(`\\b${escapedArticle}\\.\\d+(?:\\.\\d+)?\\b`))?.[0] : null);
  return [source.documentTitle, source.version ?? "", source.article ? `artículo ${source.article}` : "artículo no registrado",
    numeral ? `numeral ${numeral}` : "", pages.pageStart ? `página ${pages.pageStart}${pages.pageEnd && pages.pageEnd !== pages.pageStart ? `–${pages.pageEnd}` : ""}` : "página no registrada"].filter(Boolean).join(" · ");
}
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const stop = new Set(["que", "del", "las", "los", "una", "para", "por", "como", "cual", "debe", "tener", "puede", "segun", "indica", "sobre", "este", "esta", "con", "sin", "ese"]);
const tokens = (s: string) => [...new Set(normalize(s).match(/[a-z]{3,}/g) ?? [])].filter(t => !stop.has(t));

/** Select one complete literal passage, not an inferred answer or an arbitrary chunk dump. */
export function relevantLiteral(question: string, sources: AuditSource[]) {
  const terms = tokens(question);
  const candidates = sources.flatMap((source, index) => source.excerpt.split(/\n+|\s+(?=\d{1,3}\.\d+\.\s+[A-ZÁÉÍÓÚÑ])|(?<=[a-záéíóúñ][.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)
    .map(text => text.trim()).filter(text => text.length >= 25 && text.length <= 1400).map(text => {
      const words = new Set(tokens(text));
      const hits = terms.filter(term => words.has(term)).length;
      const numericFocus = /porcentaje|monto|plazo|cuanto|cuantos/.test(normalize(question)) && /\d/.test(text) ? 0.25 : 0;
      return { text, index, hits, score: hits / Math.max(terms.length, 1) + numericFocus };
    }));
  return candidates.filter(c => c.hits >= Math.min(2, terms.length) && c.hits > 0 && c.score >= 0.25)
    .sort((a, b) => b.score - a.score || b.hits - a.hits || a.text.length - b.text.length)[0] ?? null;
}

export function publishEvidence(answer: string, sources: AuditSource[], review: EvidenceReview, question: string, context?: CaseContext) {
  const contextual = Object.values(context ?? {}).some(value => value?.trim())
    || /\b(?:mi|nuestro|este|ese)\s+(?:caso|contrato|procedimiento|proceso)|\ben mi entidad\b|\b(?:adjunt[oa]|expediente|convocad[oa]|suscrito|suscribimos|firmamos)\b|\b\d{4}\b|\b\d{1,2}[/-]\d{1,2}\b/i.test(normalize(question));
  review.queryScope = contextual ? "case" : "general";
  const claims = evidenceClaims(answer);
  const coherent = new Set(selectCoherentEvidence(sources, question, context));
  const kept = claims.filter(claim => review.claims.find(r => r.id === claim.id)?.status === "supported"
    && claim.markers.length && claim.markers.every(n => coherent.has(sources[n - 1]))
    && checkCitationFaithfulness(claim.text, sources).ok);
  review.omittedCount = review.claims.length ? claims.length - kept.length : 0;
  if (kept.length) {
    review.presentation = kept.length === claims.length && review.reviewStatus === "complete" ? "verified" : "partial";
    review.documentary = review.presentation === "verified" ? "checked" : "partial";
    const relevantSources = citedSourceNumbers(kept.map(c => c.text).join("\n"));
    const labels = relevantSources.slice(0, 2).map(n => {
      const quote = review.claims.flatMap(c => c.evidence ?? []).find(item => item.source === n)?.quote;
      return `${sourceLabel(sources[n - 1], quote)} [F${n}]`;
    });
    const clean = (text: string) => text.replace(/^[.,;\s]+/, "");
    // Name only documents cited by the primary checked claim; never infer applicable law.
    const titles = [...new Set(kept[0].markers.map(n => sources[n - 1].documentTitle))];
    const frame = `Según ${titles.map(title => `«${title}»`).join(" y ")}:`;
    return `**Respuesta documental${review.presentation === "partial" ? " parcial" : ""}**\n${frame}\n\n${clean(kept[0].text)}\n\n**Disposición y fuente**\n${labels[0]}${kept.length > 1 ? `\n\n**Desarrollo comprobado**\n${kept.slice(1).map(c => clean(c.text)).join("\n\n")}` : ""}`;
  }
  const allowed = sources.filter(source => coherent.has(source));
  const literal = relevantLiteral(question, allowed);
  if (literal) {
    const source = allowed[literal.index];
    const index = sources.indexOf(source) + 1;
    review.presentation = "literal";
    review.documentary = "unchecked";
    return `**Lectura del documento**\nSegún ${sourceLabel(source, literal.text)}:\n\n> ${literal.text.replace(/\n/g, " ")} [F${index}]`;
  }
  review.presentation = "empty";
  review.documentary = "unchecked";
  return sources.length ? "**Respuesta**\nNo se obtuvo una conclusión respaldada ni un pasaje suficientemente pertinente para esta pregunta. Puedes precisar la consulta o seleccionar el documento aplicable."
    : "**Respuesta**\nNo se recuperaron fuentes suficientes para responder esta consulta. Puedes seleccionar un documento o precisar la pregunta.";
}
