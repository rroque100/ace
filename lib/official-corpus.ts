export const OFFICIAL_CORPUS_TYPES = [
  { value: "ley", label: "Ley", group: "normas", kind: "norma" },
  { value: "reglamento", label: "Reglamento", group: "normas", kind: "norma" },
  { value: "directiva", label: "Directiva", group: "normas", kind: "norma" },
  { value: "opinion", label: "Opinión", group: "jurisprudencia", kind: "criterio" },
  { value: "resolucion", label: "Resolución", group: "jurisprudencia", kind: "criterio" },
  { value: "acuerdo_sala_plena", label: "Acuerdo de Sala Plena", group: "jurisprudencia", kind: "criterio" },
  { value: "pronunciamiento", label: "Pronunciamiento", group: "jurisprudencia", kind: "criterio" },
  { value: "informe_vicio_nulidad", label: "Informe de vicios de nulidad", group: "jurisprudencia", kind: "criterio" },
  { value: "bases_estandar", label: "Bases estándar", group: "orientacion", kind: "orientacion" },
  { value: "guia_instructivo", label: "Guía e instructivo", group: "orientacion", kind: "orientacion" },
] as const;
export type OfficialCorpusType = typeof OFFICIAL_CORPUS_TYPES[number]["value"];
export type CorpusGroup = typeof OFFICIAL_CORPUS_TYPES[number]["group"];
export function corpusGroupForType(type: string): CorpusGroup {
  return OFFICIAL_CORPUS_TYPES.find(x => x.value === type)?.group ?? "normas";
}
export const CORPUS_ANSWER_TYPES: string[] = OFFICIAL_CORPUS_TYPES.map(x => x.value);
export function corpusTypesForGroup(group: string): string[] {
  return OFFICIAL_CORPUS_TYPES.filter(x => x.group === group).map(x => x.value);
}
export function corpusSourceKind(type: string): "norma" | "criterio" | "orientacion" {
  return OFFICIAL_CORPUS_TYPES.find(x => x.value === type)?.kind ?? "orientacion";
}
/** En criterios y guías, un artículo mencionado pertenece a la norma citada. */
export function corpusOwnArticle(type: string, article: string | null): string | null {
  return corpusSourceKind(type) === "norma" ? article : null;
}
