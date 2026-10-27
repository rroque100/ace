import { z } from "zod";

export const VALIDITY_RESULTS = [
  { value: "current", label: "Vigente" },
  { value: "partial", label: "Parcialmente vigente" },
  { value: "not_current", label: "No vigente" },
  { value: "insufficient", label: "Información insuficiente" },
] as const;

export function officialEvidenceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.hostname === "gob.pe" || url.hostname.endsWith(".gob.pe"));
  } catch { return false; }
}

export const validityReviewInput = z.object({
  result: z.enum(["current", "partial", "not_current", "insufficient"]),
  scope: z.enum(["document", "articles"]),
  articleIds: z.array(z.string().uuid()).max(30).default([]),
  version: z.string().trim().min(3).max(200),
  asOf: z.iso.date(),
  sourceUrl: z.string().trim().max(2000).refine(officialEvidenceUrl, "Usa un enlace HTTPS de una publicación oficial gob.pe").transform(value => new URL(value).toString()),
  basis: z.string().trim().min(20).max(6000),
  revision: z.number().int().min(0),
}).superRefine((value, ctx) => {
  if ((value.scope === "articles") !== (value.articleIds.length > 0)) {
    ctx.addIssue({ code: "custom", message: "Selecciona los artículos del alcance o elige documento completo" });
  }
  if (new Set(value.articleIds).size !== value.articleIds.length) {
    ctx.addIssue({ code: "custom", message: "No repitas un artículo dentro del alcance" });
  }
  if (value.asOf > new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) {
    ctx.addIssue({ code: "custom", message: "La fecha de comprobación no puede ser futura" });
  }
});

export const validityRecordSchema = z.object({
  id: z.string().uuid(),
  result: z.enum(["current", "partial", "not_current", "insufficient"]),
  scope: z.enum(["document", "articles"]),
  articleIds: z.array(z.string().uuid()),
  version: z.string(), asOf: z.iso.date(), sourceUrl: z.string().refine(officialEvidenceUrl), basis: z.string(),
  reviewer: z.string(), recordedAt: z.string(), revision: z.number().int(),
});
export type ValidityRecord = z.infer<typeof validityRecordSchema>;

/** Only an identified article may inherit an article-specific review. */
export function activeValidityReview(metadata: Record<string, unknown>, articleId?: string | null): ValidityRecord | null {
  const cache = metadata.validityReviews as { document?: unknown; articles?: Record<string, unknown> } | undefined;
  const article = articleId ? validityRecordSchema.safeParse(cache?.articles?.[articleId]) : null;
  const document = validityRecordSchema.safeParse(cache?.document);
  let full = document.success && document.data.scope === "document" ? document.data : null;
  if (full && Object.values(cache?.articles ?? {}).some(value => {
    const parsed = validityRecordSchema.safeParse(value);
    return parsed.success && parsed.data.revision > full!.revision;
  })) full = null;
  if (article?.success && article.data.scope === "articles" && article.data.articleIds.includes(articleId!) && (!full || article.data.revision > full.revision)) return article.data;
  return full;
}

export function validityLabel(review: ValidityRecord) {
  return `${review.scope === "articles" ? "Artículo revisado" : "Vigencia revisada"}: ${VALIDITY_RESULTS.find(item => item.value === review.result)!.label.toLowerCase()}`;
}

export function reviewedValidity(review: ValidityRecord) {
  return {
    state: review.result === "current" ? "current" as const : review.result === "not_current" ? "not_current" as const : "unknown" as const,
    label: validityLabel(review),
    tone: review.result === "not_current" || review.result === "partial" ? "warn" as const : "neutral" as const,
  };
}
