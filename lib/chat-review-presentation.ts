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
export function reviewNotices(review: EvidenceReview, extra: string[] = []) {
  const notices = [
    "Aplicación al caso pendiente: la revisión documental no confirma vigencia ni aplicabilidad.",
    review.missing.length ? `Para aplicarla al caso, falta precisar: ${review.missing.join(", ")}.` : "El contexto aportado es declarado, no acreditado.",
    review.omittedCount ? `Se retiraron ${review.omittedCount} afirmación(es) sin comprobación suficiente.` : "",
    ...review.warnings, ...extra,
  ];
  return [...new Set(notices.filter(Boolean))].filter(value =>
    !(review.reviewStatus === "failed" && /no se pudo completar.*comprobación automática/i.test(value)));
}
export function reviewFooter(review: EvidenceReview) {
  return REVIEW_FOOTER + reviewTitle(review) + ".\n" + reviewNotices(review).join("\n");
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
