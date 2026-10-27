import { z } from "zod";
import{libraryCollectionIds,normalizeLibraryText}from"./library-workspace";

export const extendedLegalFiltersSchema = z.object({
  collection:z.enum(["","rnp","seace","obras","garantias","arbitraje","sanciones"]).optional(),
  contractingEntity:z.string().trim().max(200).optional(),
  ruc:z.string().regex(/^(?:\d{11})?$/).optional(),
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
    collections?:string[];contractingEntity?:string|null;requestingEntity?:string|null;contractingEntityRuc?:string|null;requestingEntityRuc?:string|null;metadata?:Record<string,unknown>;documentTitle?:string;
  },
  filters: ExtendedLegalFilters,
) {
  const m=source.metadata??{};
  if(filters.collection&&!(source.collections??libraryCollectionIds(source.documentTitle??"",m)).includes(filters.collection))return false;
  if(filters.contractingEntity&&!normalizeLibraryText(`${source.contractingEntity??m.contractingEntity??""} ${source.requestingEntity??m.requestingEntity??""}`).includes(normalizeLibraryText(filters.contractingEntity)))return false;
  if(filters.ruc&&![source.contractingEntityRuc??m.contractingEntityRuc,source.requestingEntityRuc??m.requestingEntityRuc].includes(filters.ruc))return false;
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
    !(filters.includeUnknownRegime && (!regime || regime === "no_determinado"))
  )
    return false;
  return true;
}

export function extendedFiltersFromParams(params: { get:(key:string)=>string|null }): ExtendedLegalFilters {
  const parsed = extendedLegalFiltersSchema.safeParse({collection:params.get("collection")??undefined,contractingEntity:params.get("contractingEntity")??undefined,ruc:params.get("ruc")??undefined, documentTypes: params.get("documentTypes")?.split(",").filter(Boolean), years: params.get("years")?.split(",").filter(Boolean).map(Number), regime: params.get("regime") ?? "", includeUnknownRegime: params.get("includeUnknownRegime") === "true" });
  return parsed.success ? parsed.data : {};
}
