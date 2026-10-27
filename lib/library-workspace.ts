import { z } from "zod";
export const LIBRARY_PROCEDURES = [
  { value: "licitacion_publica_bienes", label: "Licitación pública · bienes" },
  {
    value: "licitacion_publica_abreviada_bienes",
    label: "Licitación pública abreviada · bienes",
  },
  { value: "licitacion_publica_obras", label: "Licitación pública · obras" },
  {
    value: "licitacion_publica_abreviada_obras",
    label: "Licitación pública abreviada · obras",
  },
  {
    value: "concurso_publico_servicios",
    label: "Concurso público · servicios",
  },
  {
    value: "concurso_publico_abreviado_servicios",
    label: "Concurso público abreviado · servicios",
  },
  {
    value: "concurso_publico_consultoria",
    label: "Concurso público · consultoría",
  },
  {
    value: "concurso_publico_abreviado_consultoria",
    label: "Concurso público abreviado · consultoría",
  },
  {
    value: "concurso_proyectos_arquitectonicos",
    label: "Proyectos arquitectónicos y urbanísticos",
  },
  {
    value: "concurso_publico_expertos",
    label: "Expertos y gerentes de proyectos",
  },
  {
    value: "subasta_inversa_electronica",
    label: "Subasta inversa electrónica",
  },
  { value: "comparacion_precios", label: "Comparación de precios" },
  {
    value: "procedimiento_no_competitivo",
    label: "Procedimiento de selección no competitivo",
  },
];
export function libraryProcedureForTitle(title: string) {
  const t = normalizeLibraryText(title);
  if (t.includes("subasta inversa")) return "subasta_inversa_electronica";
  if (t.includes("comparacion de precios")) return "comparacion_precios";
  if (/no competitivo/.test(t)) return "procedimiento_no_competitivo";
  if (/arquitectonic|urbanistic/.test(t))
    return "concurso_proyectos_arquitectonicos";
  if (/expertos|gerentes/.test(t)) return "concurso_publico_expertos";
  if (t.includes("licitacion publica"))
    return `licitacion_publica${t.includes("abreviada") ? "_abreviada" : ""}_${t.includes("obra") ? "obras" : "bienes"}`;
  if (t.includes("concurso publico"))
    return `concurso_publico${t.includes("abreviado") ? "_abreviado" : ""}_${/consultori/.test(t) ? "consultoria" : "servicios"}`;
  return null;
}
export const LIBRARY_COLLECTIONS = [
  {
    id: "rnp",
    label: "Proveedores y RNP",
    pattern: /\brnp\b|registro nacional de proveedores/i,
  },
  { id: "seace", label: "SEACE", pattern: /\bseace\b/i },
  {
    id: "obras",
    label: "Obras",
    pattern: /\bobra|valorizacion|cuaderno de incidencia/i,
  },
  {
    id: "garantias",
    label: "Garantías",
    pattern: /garantia|fiel cumplimiento|retencion/i,
  },
  {
    id: "arbitraje",
    label: "Arbitraje y controversias",
    pattern: /arbitra|disputa|controversia|\bjprd\b|regaju/i,
  },
  {
    id: "sanciones",
    label: "Sanciones",
    pattern: /sancion|multa|inhabilitacion/i,
  },
] as const;
export const normalizeLibraryText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function libraryCollectionIds(
  title: string,
  metadata: Record<string, unknown> = {},
) {
  const recorded = metadata.libraryCollections as
    { reviewed?: boolean; values?: unknown[] } | undefined;
  if (recorded?.reviewed && Array.isArray(recorded.values))
    return recorded.values.filter(
      (x): x is string =>
        typeof x === "string" && LIBRARY_COLLECTIONS.some((c) => c.id === x),
    );
  const text = normalizeLibraryText(title + " " + String(metadata.topic ?? ""));
  return LIBRARY_COLLECTIONS.filter((c) => c.pattern.test(text)).map(
    (c) => c.id,
  );
}
export const libraryFiltersSchema = z.object({
  view: z.enum(["collections", "templates", "news"]).default("collections"),
  q: z.string().trim().max(200).default(""),
  collection: z
    .enum(["", "rnp", "seace", "obras", "garantias", "arbitraje", "sanciones"])
    .default(""),
  documentType: z.string().max(80).default(""),
  processType: z.string().max(100).default(""),
  object: z.string().max(40).default(""),
  contractingEntity: z.string().trim().max(200).default(""),
  ruc: z
    .string()
    .regex(/^(?:\d{11})?$/, "Escribe los 11 dígitos del RUC.")
    .default(""),
  regime: z
    .enum(["", "32069", "30225", "especial", "no_determinado"])
    .default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  editableOnly: z.enum(["true", "false"]).default("true"),
  publishedFrom: z.string().date().optional().or(z.literal("")),
  publishedTo: z.string().date().optional().or(z.literal("")),
  version: z.string().trim().max(160).default(""),
});
export function librarySourceNotice(type: string) {
  return type === "comunicado"
    ? "Publicación informativa; no sustituye una disposición normativa."
    : type === "indice_documental"
      ? "Índice de consulta; comprueba los documentos enlazados."
      : type === "bases_estandar"
        ? "Modelo oficial editable. Revisa procedimiento, versión y aplicación antes de utilizarlo."
        : "Comprueba la versión y su aplicación al caso.";
}
