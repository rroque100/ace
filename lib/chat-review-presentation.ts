import type { EvidenceReview } from "./chat-evidence-audit";

export const REVIEW_FOOTER = "\n\n**Verificación y límites**\n";
export function reviewTitle(review: EvidenceReview) {
  if (review.failureReason === "no_sources") return "No se recuperaron fuentes para esta consulta";
  if (review.reviewStatus === "failed") return "La revisión automática no pudo completarse";
  if (review.failureReason === "review_limit") return "La revisión alcanzó su límite";
  if (review.presentation === "literal") return "Texto documental disponible; conclusión sin comprobar";
  if (review.presentation === "partial") return "Respuesta parcial: conserva solo lo comprobado";
  if (review.presentation === "verified") return "Respaldo documental comprobado automáticamente";
  return "No se obtuvo una conclusión respaldada";
}
/** Describes only published evidence, never a discarded draft or an unchecked excerpt. */
export function reviewSummary(review: EvidenceReview, answer = "") {
  if (review.presentation === "verified") return "La respuesta mostrada está respaldada por las fuentes citadas.";
  if (review.presentation === "partial") {
    const main = chatAnswerSections(answer, review).main.split("**Disposición y fuente**")[0];
    const base = /\d+(?:[.,]\d+)?\s*%/.test(main) ? "El porcentaje indicado está respaldado" : "La información mostrada está respaldada";
    const omittedContradiction = review.claims.some(claim => claim.status === "contradicted");
    if (omittedContradiction) return `${base}; se omitió contenido adicional que contradecía las fuentes.`;
    return `${base}; ${review.omittedCount === 1 ? "una explicación adicional no pudo comprobarse" : "parte de la explicación adicional no pudo comprobarse"}.`;
  }
  if (review.presentation === "literal") return review.reviewStatus === "failed"
    ? "Se muestra un pasaje literal de la fuente; la revisión automática no pudo completarse."
    : "Se muestra el texto de la fuente; no se confirmó una conclusión jurídica.";
  return reviewTitle(review) + ".";
}
export function reviewApplicability(review: EvidenceReview) {
  const names: Record<string, string> = { "régimen aplicable": "régimen", "fechas relevantes": "fechas", "objeto contractual": "objeto", "hechos del caso": "hechos" };
  const missing = review.missing.map(value => names[value] ?? value);
  return `Aplicación al caso pendiente de confirmar.${missing.length ? ` Falta precisar: ${missing.join(", ")}.` : ""}`;
}
export function reviewTechnicalNotes(review: EvidenceReview, extra: string[] = []) {
  return reviewNotices(review, extra).filter(value => !/^(?:Aplicación al caso|Para aplicarla al caso|El contexto aportado)/.test(value));
}
export function reviewNotices(review: EvidenceReview, extra: string[] = []) {
  const notices = [
    "Aplicación al caso pendiente: la revisión documental no confirma vigencia ni aplicabilidad.",
    review.missing.length ? `Para aplicarla al caso, falta precisar: ${review.missing.join(", ")}.` : "El contexto aportado es declarado, no acreditado.",
    review.omittedCount ? `Se ${review.omittedCount === 1 ? "omitió una afirmación" : `omitieron ${review.omittedCount} afirmaciones`} sin comprobación suficiente.` : "",
    ...review.warnings, ...extra,
  ];
  return [...new Set(notices.filter(Boolean))].filter(value =>
    !(review.reviewStatus === "failed" && /no se pudo completar.*comprobación automática/i.test(value)));
}
export function reviewFooter(review: EvidenceReview, answer = "") {
  const details = reviewTechnicalNotes(review);
  return REVIEW_FOOTER + reviewSummary(review, answer) + "\n" + reviewApplicability(review)
    + (details.length ? "\nDetalles de revisión: " + details.join(" ") : "");
}
export function chatAnswerBody(answer: string, review?: EvidenceReview) {
  if (!review?.presentation) return answer;
  const at = answer.indexOf(REVIEW_FOOTER);
  if (at < 0) return answer;
  const sourceAt = answer.indexOf("\n\n**Documentos y páginas citados**", at);
  return answer.slice(0, at) + (sourceAt >= 0 ? answer.slice(sourceAt) : "");
}

export function chatAnswerSections(answer: string, review?: EvidenceReview) {
  const body = chatAnswerBody(answer, review);
  if (!review?.presentation) return { main: body, detail: "" };
  const sourceAt = body.indexOf("\n\n**Documentos y páginas citados**");
  const sources = sourceAt >= 0 ? body.slice(sourceAt) : "";
  const content = sourceAt >= 0 ? body.slice(0, sourceAt) : body;
  const marker = "\n\n**Desarrollo comprobado**\n";
  const at = content.indexOf(marker);
  return { main: at >= 0 ? content.slice(0, at) : content,
    detail: (at >= 0 ? content.slice(at + marker.length) : "") + sources };
}
