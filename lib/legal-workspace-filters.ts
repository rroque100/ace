import { z } from "zod";

export const extendedLegalFiltersSchema = z.object({
  documentTypes: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  years: z.array(z.number().int().min(1900).max(2200)).max(12).optional(),
  regime: z
    .enum(["", "32069", "30225", "especial", "no_determinado"])
    .optional(),
  includeUnknownRegime: z.boolean().optional(),
});
export type ExtendedLegalFilters = z.infer<typeof extendedLegalFiltersSchema>;
export function reviewedRegime(metadata: Record<string, unknown>) {
  const reviewed =
    metadata.regimeReviewed === true ||
    metadata.regimeReviewStatus === "confirmed";
  if (!reviewed || typeof metadata.regime !== "string") return "no_determinado";
  const normalized = metadata.regime
    .toLowerCase()
    .trim()
    .replace(/^ley[ _-]*/, "");
  return ["32069", "30225", "especial"].includes(normalized)
    ? normalized
    : "no_determinado";
}
export function matchesExtendedFilters(
  source: {
    documentType: string;
    year: number | null;
    regime?: string | null;
    regimeReviewed?: boolean;
    metadata?: Record<string, unknown>;
  },
  filters: ExtendedLegalFilters,
) {
  if (
    filters.documentTypes?.length &&
    !filters.documentTypes.includes(source.documentType)
  )
    return false;
  if (
    filters.years?.length &&
    (source.year === null || !filters.years.includes(source.year))
  )
    return false;
  const regime = source.regimeReviewed ? source.regime : "no_determinado";
  if (filters.regime === "no_determinado")
    return !regime || regime === "no_determinado";
  if (
    filters.regime &&
    regime !== filters.regime &&
    !(source.regimeReviewed && Array.isArray(source.metadata?.declaredRegimes) && source.metadata.declaredRegimes.includes(filters.regime)) &&
    !(filters.includeUnknownRegime && (!regime || regime === "no_determinado"))
  )
    return false;
  return true;
}

export function extendedFiltersFromParams(params: { get:(key:string)=>string|null }): ExtendedLegalFilters {
  const parsed = extendedLegalFiltersSchema.safeParse({ documentTypes: params.get("documentTypes")?.split(",").filter(Boolean), years: params.get("years")?.split(",").filter(Boolean).map(Number), regime: params.get("regime") ?? "", includeUnknownRegime: params.get("includeUnknownRegime") === "true" });
  return parsed.success ? parsed.data : {};
}
