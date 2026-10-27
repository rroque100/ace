import { z } from "zod";
import { documentSearchRequestSchema } from "./document-search";
import { OFFICIAL_CORPUS_TYPES } from "./official-corpus";

export const assistantRequestSchema = z.object({ text: z.string().trim().min(3).max(500), scope: z.enum(["search", "global"]).default("search") });
export const assistantProposalSchema = z.object({
  destination: z.enum(["/busqueda", "/chat", "/normas", "/guardado", "/historial", "/archivo"]),
  explanation: z.string().max(400), clarification: z.preprocess(value=>value===null?undefined:value,z.string().max(200).optional()),
  search: documentSearchRequestSchema,
});
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;
export function parseAssistantProposal(text: string, scope: "search" | "global", original: string): AssistantProposal {
  const raw=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  const destination=assistantProposalSchema.shape.destination.parse(raw?.destination);
  // Navigation has no document search criteria. A model may omit or empty them.
  // Validate the route first; never let an arbitrary route reach this branch.
  if(scope==="global" && destination!=="/busqueda") raw.search=documentSearchRequestSchema.parse({query:original,mode:original.length<5?"literal":"semantic"});
  if(Array.isArray(raw?.search?.filters)) {
    const entries=raw.search.filters.flatMap((item:unknown)=>{
      if(!item || typeof item!=="object" || Array.isArray(item)) throw new Error("Filtro inválido");
      return Object.entries(item);
    });
    if(entries.length>10 || new Set(entries.map(([key]:[string,unknown])=>key)).size!==entries.length) throw new Error("Filtros ambiguos");
    raw.search.filters=Object.fromEntries(entries);
  }
  const parsed = assistantProposalSchema.parse(raw);
  if (scope === "search") parsed.destination = "/busqueda";
  if (parsed.search.filters.documentType && !OFFICIAL_CORPUS_TYPES.some(type => type.value === parsed.search.filters.documentType)) throw new Error("Tipo desconocido");
  // The assistant cannot introduce identity, hidden classification or applicability constraints.
  const allowed = ["documentType", "year", "article"];
  parsed.search.filters = Object.fromEntries(Object.entries(parsed.search.filters).filter(([key]) => allowed.includes(key)));
  if (parsed.search.filters.year && !original.includes(String(parsed.search.filters.year))) delete parsed.search.filters.year;
  if (parsed.search.filters.article && !original.includes(parsed.search.filters.article)) delete parsed.search.filters.article;
  const exact = original.match(/["“]([^"”]+)["”]/)?.[1];
  if (exact) { parsed.search.query = exact; parsed.search.mode = "literal"; }
  parsed.search.page = 1;
  return parsed;
}
export function fallbackProposal(text: string): AssistantProposal {
  const exact=text.match(/["“]([^"”]+)["”]/)?.[1];
  return { destination: "/busqueda", explanation: "La ayuda de IA no está disponible. Revisa y edita estos criterios para continuar.", search: documentSearchRequestSchema.parse({ query: exact || text, mode: exact || text.length < 5 ? "literal" : "semantic" }) };
}
export function catalogueSuggestions<T extends {title: string; documentId: string; documentNumber?: string | null}>(rows: T[], query: string): T[] {
  const fold = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = fold(query).trim().split(/\s+/);
  if (query.trim().length < 2) return [];
  return rows.filter(row => terms.every(term => fold(`${row.title} ${row.documentNumber ?? ""}`).includes(term))).slice(0, 6);
}
/** Preview only; original source and PDF remain untouched. */
export function readableSearchPreview(text:string) {
  const cleaned = text.split(/\n/).filter(line => !/^\s*(?:firmado digitalmente por\b|firma digital\b|c[oó]digo de verificaci[oó]n\b)/i.test(line)).join("\n")
    .replace(/https?:\/\/apps\.firmaperu\.gob\.pe\/web\/\s*validador\.xhtml/gi," ")
    .replace(/La integridad del documento y la autor[ií]a de la\(s\) firma\(s\) pueden ser verificadas en:\s*/gi," ")
    .replace(/\bExpediente\s+N[°ºo.]?\s*\d+(?:\s+T\.D\.\s*\d+)?/gi," ")
    .replace(/\bSolicitante:\s*[^\n]{1,180}?(?=\s+Asunto:)/gi, " ").trim();
  return cleaned || text;
}
