import { z } from "zod";
import {
  extendedLegalFiltersSchema,
  matchesExtendedFilters,
  reviewedRegime,
} from "./legal-workspace-filters";
import { legalValidity } from "./legal-center";

export const searchObjects = [
  { value: "bienes", label: "Bienes" },
  { value: "servicios", label: "Servicios" },
  { value: "consultoria", label: "Consultoría" },
  { value: "obras", label: "Obras" },
  { value: "sin_clasificar", label: "Sin objeto clasificado" },
];
export const searchSubjects = [
  { value: "preparacion", label: "Preparación de la contratación" },
  { value: "seleccion", label: "Selección del proveedor" },
  { value: "ejecucion", label: "Ejecución del contrato" },
  { value: "controversias", label: "Controversias y recursos" },
  { value: "general", label: "Aspectos generales" },
  { value: "sin_clasificar", label: "Sin materia clasificada" },
];
export const searchTopics = [
  {
    value: "requerimiento",
    subject: "preparacion",
    label: "Requerimiento y bases",
  },
  {
    value: "presupuesto",
    subject: "preparacion",
    label: "Presupuesto y valor de contratación",
  },
  {
    value: "ofertas",
    subject: "seleccion",
    label: "Ofertas, evaluación y buena pro",
  },
  {
    value: "perfeccionamiento",
    subject: "ejecucion",
    label: "Perfeccionamiento del contrato",
  },
  { value: "garantias", subject: "ejecucion", label: "Garantías" },
  {
    value: "modificaciones",
    subject: "ejecucion",
    label: "Modificaciones y ampliaciones",
  },
  { value: "penalidades", subject: "ejecucion", label: "Penalidades" },
  {
    value: "resolucion",
    subject: "ejecucion",
    label: "Resolución del contrato",
  },
  { value: "pagos", subject: "ejecucion", label: "Pagos y adelantos" },
  {
    value: "recursos",
    subject: "controversias",
    label: "Recursos y apelaciones",
  },
  {
    value: "arbitraje",
    subject: "controversias",
    label: "Arbitraje y conciliación",
  },
  {
    value: "impedimentos",
    subject: "general",
    label: "Impedimentos e incompatibilidades",
  },
  {
    value: "principios",
    subject: "general",
    label: "Principios y procedimiento administrativo",
  },
  { value: "sin_clasificar", subject: "", label: "Sin tema clasificado" },
];
const option = (values: { value: string }[]) =>
  z
    .string()
    .refine(
      (v) => !v || values.some((x) => x.value === v),
      "Clasificación inválida",
    )
    .optional();
export const documentSearchFiltersSchema = extendedLegalFiltersSchema.extend({
  documentId: z.string().uuid().optional().or(z.literal("")),
  documentType: z.string().max(80).optional(),
  article: z.string().max(50).optional(),
  sourceEntity: z.string().max(200).optional(),
  processType: z.string().max(200).optional(),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(2200)
    .optional()
    .or(z.literal("")),
  topic: z.string().max(250).optional(),
  status: z.string().max(80).optional(),
  vigencia: z.string().max(80).optional(),
  object: option(searchObjects),
  subject: option(searchSubjects),
  guidedTopic: option(searchTopics),
});
export const documentSearchRequestSchema = z
  .object({
    query: z.string().trim().min(2).max(8000),
    mode: z.enum(["literal", "semantic"]).default("literal"),
    sort: z.enum(["relevance", "newest", "oldest"]).default("relevance"),
    page: z.number().int().min(1).max(10000).default(1),
    pageSize: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
    filters: documentSearchFiltersSchema.default({}),
  })
  .superRefine((value, context) => {
    if (value.mode === "literal" && value.query.length > 500)
      context.addIssue({
        code: "custom",
        path: ["query"],
        message: "La frase literal admite hasta 500 caracteres.",
      });
  });
export type DocumentSearchInput = z.infer<typeof documentSearchRequestSchema>;
export type DocumentSearchFilters = z.infer<typeof documentSearchFiltersSchema>;
export type SearchCatalogueRow = {
  id: string;
  title: string;
  document_type: string;
  source_entity: string | null;
  process_type: string | null;
  metadata: Record<string, unknown>;
};
export type SearchClassification = {
  objects: string[];
  subjects: string[];
  topics: string[];
  origin: "registered" | "suggested" | "unknown";
};
export function foldSearchText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Etiquetas orientativas de navegación; nunca deducen régimen, vigencia o reglas. */
export function classifySearchDocument(
  row: SearchCatalogueRow,
): SearchClassification {
  const registered = row.metadata.searchClassification as
    | Record<string, unknown>
    | undefined;
  if (registered?.reviewed === true) {
    const take = (key: string, allowed: { value: string }[]) =>
      Array.isArray(registered[key])
        ? (registered[key] as unknown[]).filter(
            (v): v is string =>
              typeof v === "string" &&
              allowed.some((x) => x.value === v) &&
              v !== "sin_clasificar",
          )
        : [];
    return {
      objects: take("objects", searchObjects),
      subjects: take("subjects", searchSubjects),
      topics: take("topics", searchTopics),
      origin: "registered",
    };
  }
  const text = foldSearchText(
    `${row.title} ${typeof row.metadata.topic === "string" ? row.metadata.topic : ""}`,
  );
  const objects: string[] = [];
  const topics: string[] = [];
  if (/\bbienes\b|suministro/.test(text)) objects.push("bienes");
  if (/\bservicios\b/.test(text)) objects.push("servicios");
  if (/consultor/.test(text)) objects.push("consultoria");
  if (/\bobras?\b/.test(text)) objects.push("obras");
  const rules: [string, RegExp][] = [
    [
      "requerimiento",
      /requerimiento|bases |especificaciones|terminos de referencia/,
    ],
    ["presupuesto", /presupuesto|valor estimado|valor referencial/],
    ["ofertas", /ofertas|buena pro|admision|evaluacion/],
    ["perfeccionamiento", /perfeccionamiento|perfeccionar/],
    ["garantias", /garantia|fianza|fideicomiso/],
    ["modificaciones", /modificaci|ampliacion|adicional/],
    ["penalidades", /penalidad|mora/],
    ["resolucion", /resolucion del contrato|resolucion contractual/],
    ["pagos", /\bpago|adelanto/],
    ["recursos", /apelacion|recurso|impugnaci/],
    ["arbitraje", /arbitraje|conciliaci/],
    ["impedimentos", /impedimento|incompatibilidad/],
    ["principios", /principio|procedimiento administrativo/],
  ];
  for (const [topic, regex] of rules) if (regex.test(text)) topics.push(topic);
  const subjects = [
    ...new Set(
      topics.map(
        (topic) => searchTopics.find((t) => t.value === topic)!.subject,
      ),
    ),
  ];
  return {
    objects,
    subjects,
    topics,
    origin: objects.length || topics.length ? "suggested" : "unknown",
  };
}
export function matchesSearchCatalogue(
  row: SearchCatalogueRow,
  filters: DocumentSearchFilters,
) {
  const metadata = row.metadata;
  const year = typeof metadata.year === "number" ? metadata.year : null;
  const regime = reviewedRegime(metadata);
  if (
    !matchesExtendedFilters(
      {
        documentType: row.document_type,
        year,
        regime,
        regimeReviewed: regime !== "no_determinado",
      },
      filters,
    )
  )
    return false;
  if (filters.documentId && row.id !== filters.documentId) return false;
  if (
    !filters.documentTypes?.length &&
    filters.documentType &&
    row.document_type !== filters.documentType
  )
    return false;
  if (!filters.years?.length && filters.year && year !== filters.year)
    return false;
  const contains = (value: unknown, query?: string) =>
    !query ||
    foldSearchText(String(value ?? "")).includes(foldSearchText(query));
  if (
    !contains(row.source_entity, filters.sourceEntity) ||
    !contains(metadata.topic, filters.topic) ||
    !contains(metadata.status, filters.status)
  )
    return false;
  if (
    filters.processType &&
    row.process_type !== filters.processType &&
    row.process_type !== "todos"
  )
    return false;
  const validity = legalValidity(
    typeof metadata.vigencia === "string" ? metadata.vigencia : null,
    typeof metadata.status === "string" ? metadata.status : null,
  );
  if (filters.vigencia === "vigente" && validity.state !== "current")
    return false;
  if (
    ["no vigente", "derogado"].includes(filters.vigencia ?? "") &&
    validity.state !== "not_current"
  )
    return false;
  if (
    filters.vigencia &&
    !["unknown", "vigente", "no vigente", "derogado"].includes(
      filters.vigencia,
    ) &&
    !contains(metadata.vigencia, filters.vigencia)
  )
    return false;
  if (filters.vigencia === "unknown" && validity.state !== "unknown")
    return false;
  const cls = classifySearchDocument(row);
  for (const [filter, values] of [
    [filters.object, cls.objects],
    [filters.subject, cls.subjects],
    [filters.guidedTopic, cls.topics],
  ] as const) {
    if (
      filter &&
      (filter === "sin_clasificar"
        ? values.length > 0
        : !values.includes(filter))
    )
      return false;
  }
  return true;
}
export function documentPublication(row: SearchCatalogueRow) {
  const value =
    row.metadata.publicationDate ??
    row.metadata.publishedAt ??
    row.metadata.datePublished;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value.slice(0, 10)
    )
      return { label: value.slice(0, 10), time: date.getTime() };
  }
  if (typeof row.metadata.year === "number")
    return {
      label: String(row.metadata.year),
      time: Date.UTC(row.metadata.year, 0, 1),
    };
  return { label: null, time: null };
}
export function compareSearchDocuments(
  a: { documentId: string; rank: number; dateTime: number | null },
  b: { documentId: string; rank: number; dateTime: number | null },
  sort: DocumentSearchInput["sort"],
) {
  if (sort !== "relevance") {
    if (a.dateTime === null && b.dateTime !== null) return 1;
    if (b.dateTime === null && a.dateTime !== null) return -1;
    const delta = (a.dateTime ?? 0) - (b.dateTime ?? 0);
    if (delta) return sort === "newest" ? -delta : delta;
  }
  return b.rank - a.rank || a.documentId.localeCompare(b.documentId);
}

export type DocumentSearchMatch = {
  chunkId: string;
  excerpt: string;
  pageStart: number | null;
  pageEnd: number | null;
  article: string | null;
  score: number | null;
};
export type DocumentSearchResult = {
  documentId: string;
  title: string;
  documentType: string;
  sourceEntity: string | null;
  publication: string | null;
  dateTime: number | null;
  rank: number;
  validity: ReturnType<typeof legalValidity>;
  classification: SearchClassification;
  matchCount: number;
  matches: DocumentSearchMatch[];
  titleMatch?: boolean;
};
export type DocumentSearchResponse = {
  documents: DocumentSearchResult[];
  totalDocuments: number;
  page: number;
  pageSize: number;
  pages: number;
  scope: "catalogue" | "retrieved";
  warnings: string[];
  historyWarning?: string;
  query: string;
  mode: DocumentSearchInput["mode"];
};

/** Mapa de caracteres para resaltar sin alterar el original ni interpretar HTML. */
export function literalMatchParts(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const target = foldSearchText(query);
  if (!target) return [{ text, match: false }];
  let folded = "";
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = foldSearchText(text[i]) || (/\s/.test(text[i]) ? " " : "");
    if (char === " " && (!folded || folded.endsWith(" "))) continue;
    for (const c of char) {
      folded += c;
      positions.push(i);
    }
  }
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let from = 0;
  while (true) {
    const found = folded.indexOf(target, from);
    if (found < 0) break;
    const start = positions[found];
    const end = (positions[found + target.length - 1] ?? start) + 1;
    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
    from = found + target.length;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
