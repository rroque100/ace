import { activeValidityReview } from "./validity-review";
/** Identifies the document's declared framework, never applicability or current law. */
export function declaredRegime(title: string, metadata: Record<string, unknown>) {
  const explicit = title.match(/\bley\s*(?:(?:general\s+de\s+contrataciones\s+p[uú]blicas)\s*)?(?:n[.°ºo\s]*\s*)?(32\s*069|30\s*225)\b/gi) ?? [];
  const laws = [...new Set(explicit.map(value => value.replace(/\D/g, "")))];
  if (laws.length !== 1) return null;
  return { regime: laws[0], evidence: title, method: "explicit-document-title", scope: "documentary-identification", humanReviewed: false, source: typeof metadata.officialPublicationUrl === "string" ? metadata.officialPublicationUrl : null };
}

export function documentReviewSummary(metadata: Record<string, unknown>) {
  const review = metadata.regimeReview as Record<string, unknown> | undefined;
  return {
    validity: activeValidityReview(metadata),
    regime: typeof metadata.regime === "string" ? metadata.regime : null,
    method: review?.method === "explicit-document-title" ? "Identificación automática por denominación del documento" : review?.method === "official-publication-title" ? "Identificación automática por publicación oficial del archivo" : "Método de identificación sin registrar",
    evidence: typeof review?.evidence === "string" ? review.evidence : null,
    reviewedAt: typeof review?.checkedAt === "string" ? review.checkedAt : null,
    reviewer: review?.humanReviewed === false ? "ACE · comprobación documental automática" : "Revisor sin registrar",
    validityRecord: typeof metadata.vigencia === "string" ? metadata.vigencia : "Sin registrar",
    validityReview: activeValidityReview(metadata) ? "Existe una revisión de vigencia registrada con su sustento, versión y fecha. La aplicación al caso se comprueba por separado." : "La etiqueta de registro no acredita una revisión de vigencia ni la aplicación a tu contrato.",
  };
}
