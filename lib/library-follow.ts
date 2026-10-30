import { z } from "zod";
import {
  documentSearchRequestSchema,
  matchesSearchCatalogue,
  foldSearchText,
  type SearchCatalogueRow,
} from "./document-search";
export const followSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    search: documentSearchRequestSchema.optional(),
    label: z.string().trim().min(3).max(200),
  })
  .refine(
    (d) => Boolean(d.documentId) !== Boolean(d.search),
    "Selecciona un documento o una consulta, no ambos.",
  );
export function matchesFollow(search: unknown, doc: SearchCatalogueRow) {
  const p = documentSearchRequestSchema.safeParse(search);
  if (!p.success || !matchesSearchCatalogue(doc, p.data.filters ?? {}))
    return false;
  const text = foldSearchText(
    doc.title + " " + String(doc.metadata.topic ?? ""),
  );
  return foldSearchText(p.data.query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
export const eventLabel = (kind: string) =>
  ({
    publication: "Nueva publicación incorporada",
    version: "Posible versión relacionada · pendiente de revisión jurídica",
    reviewed_change: "Relación jurídica revisada",
  })[kind] ?? "Cambio documental registrado";
