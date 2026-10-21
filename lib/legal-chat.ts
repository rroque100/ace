import { z } from "zod";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { checkCitationFaithfulness } from "./citation-faithfulness";
import { type SearchFilters, rerankWithModel, searchTextRecords } from "./pinecone";
import {
  assessProcedureSourceCoverage,
  inferProcedureType,
  normativeDocumentTypes,
  normalizeProcedureText,
  procedureAliases,
  procedureAnchors,
  procedureCatalog,
  procedureLabel,
  procedureSourceRequirements,
  sourceMatchesRequirement,
  procedureTextIncludes,
} from "./procedure-catalog";
import { institutionalAuditDetails, supabaseRest, supabaseUserRest, writeAuditLog } from "./supabase-server";

// Contexto del usuario autenticado para escribir/leer datos privados del chat
// con su JWT (RLS). No proviene del body del cliente.
export type ChatAuthContext = {
  accessToken: string;
  actorReference?: string;
  entity?: string | null;
  ownerId: string;
  // Cuando es false, no se persiste el intercambio (sesion/mensajes/fuentes/auditoria).
  // Lo usa el evaluador continuo para no ensuciar el historial del chat. Por defecto persiste.
  persist?: boolean;
  role?: string;
};

const legalSearchFiltersSchema = z.object({
  article: z.string().trim().optional().or(z.literal("")),
  documentId: z.string().trim().optional().or(z.literal("")),
  /** Varios documentos a la vez: un procedimiento puede tener varios modelos. */
  documentIds: z.array(z.string().trim().min(1)).max(20).optional(),
  documentType: z.string().trim().optional().or(z.literal("")),
  sourceEntity: z.string().trim().optional().or(z.literal("")),
  status: z.string().trim().optional().or(z.literal("")),
  topic: z.string().trim().optional().or(z.literal("")),
  processType: z.string().trim().optional().or(z.literal("")),
  vigencia: z.string().trim().optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(2200).optional().or(z.literal("")),
});

export const chatRequestSchema = z.object({
  filters: legalSearchFiltersSchema.optional(),
  mode: z.enum(["breve", "tecnica", "informe", "checklist"]).default("tecnica"),
  // Estilo elegible por el usuario: tono (voz) y longitud (extension).
  tone: z.enum(["didactico", "formal", "tecnico"]).default("formal"),
  length: z.enum(["concisa", "media", "detallada"]).default("media"),
  question: z.string().min(5),
  sessionId: z.string().uuid().optional(),
});

export const semanticSearchRequestSchema = z.object({
  filters: legalSearchFiltersSchema.optional(),
  query: z.string().min(5),
  topK: z.coerce.number().int().min(1).max(20).default(8),
});

type DocumentChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  page_end: number | null;
  page_start: number | null;
  pinecone_vector_id: string;
  documents: {
    id: string;
    title: string;
    document_type: string;
    source_entity: string | null;
    file_name: string;
    status: string;
    metadata: Record<string, unknown>;
  } | null;
};

export type LegalSource = {
  citation: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentNumber: string | null;
  documentType: string;
  fileName: string;
  sourceEntity: string | null;
  chunkIndex: number;
  pageEnd: number | null;
  pageStart: number | null;
  article: string | null;
  sectionTitle: string | null;
  topic: string | null;
  processType: string | null;
  status: string | null;
  vigencia: string | null;
  year: number | null;
  score: number;
  semanticScore: number;
  lexicalScore: number;
  rerankScore: number;
  evidenceQuality: number;
  matchType: "semantica" | "lexical" | "hibrida";
  excerpt: string;
};

export type SourceAssessment = {
  confidence: "alta" | "media" | "baja";
  sufficient: boolean;
  reason: string;
  evidenceWarnings: string[];
  evidenceQuality: number;
  procedureCoverage?: ReturnType<typeof assessProcedureSourceCoverage>;
  coverage: {
    bases: boolean;
    directiva: boolean;
    ley: boolean;
    opinion: boolean;
    reglamento: boolean;
  };
  topScore: number;
  averageScore: number;
  lexicalScore: number;
  uniqueDocuments: number;
  queryUsed?: string;
  scope: "legal" | "off_topic" | "unknown";
};

type ChatSessionRecord = {
  id: string;
};

type ChatMessageRecord = {
  content: string;
  role: "user" | "assistant" | "system";
};

type ChatMessageInsertRecord = {
  id: string;
  role: "user" | "assistant" | "system";
};

const answerDocumentTypes = new Set(["ley", "reglamento", "directiva", "opinion"]);
const normativeDocumentTypeSet = new Set<string>(normativeDocumentTypes);
const normativePriority: Record<string, number> = {
  ley: 4,
  reglamento: 3,
  directiva: 2,
  opinion: 1,
  bases_integradas: 0,
};

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function escapePostgrestIn(values: string[]) {
  return values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",");
}

function normalizeFilters(filters?: z.infer<typeof legalSearchFiltersSchema>): SearchFilters {
  return {
    article: filters?.article?.trim() || undefined,
    documentId: filters?.documentId?.trim() || undefined,
    documentIds: filters?.documentIds?.length ? filters.documentIds : undefined,
    documentType: filters?.documentType?.trim() || undefined,
    sourceEntity: filters?.sourceEntity?.trim() || undefined,
    status: filters?.status?.trim() || undefined,
    topic: filters?.topic?.trim() || undefined,
    processType: filters?.processType?.trim() || undefined,
    vigencia: filters?.vigencia?.trim() || undefined,
    year: typeof filters?.year === "number" ? filters.year : undefined,
  };
}

function normalizeChatAnswerFilters(filters?: z.infer<typeof legalSearchFiltersSchema>) {
  if (!filters) {
    return undefined;
  }

  return {
    ...filters,
    documentType:
      filters.documentType && answerDocumentTypes.has(filters.documentType)
        ? filters.documentType
        : "",
  };
}

function inferProcessTypeFromQuestion(question: string) {
  return inferProcedureType(question);
}

function processTypeLabel(processType?: string | null) {
  return procedureLabel(processType);
}

function buildProcessAnchoredQuery(question: string, processType?: string | null) {
  return [question, ...procedureAliases(processType), ...procedureAnchors(processType)].join(" ");
}

function isRequirementsQuestion(question: string) {
  const normalized = normalizeComparable(question);
  return [
    "requisito",
    "requisitos",
    "procedencia",
    "condiciones",
    "cuantia",
    "plazo",
    "ofertas",
    "cuando procede",
    "para que procede",
    "que debe",
  ].some((term) => normalized.includes(term));
}

function hasSpecificProcessRegulationSource(sources: LegalSource[], processType?: string | null) {
  if (!processType) {
    return true;
  }

  return assessProcedureSourceCoverage(processType, sources).missingCritical.length === 0;
}

function sourceSupportsProcess(source: LegalSource, processType?: string | null) {
  if (!processType) {
    return true;
  }

  if (source.processType === processType || source.processType === "todos") {
    return true;
  }

  const config = procedureCatalog[processType];

  if (!config) {
    return false;
  }

  const sourceText = normalizeProcedureText(
    `${source.documentTitle} ${source.topic ?? ""} ${source.citation} ${source.excerpt}`,
  );

  const supportsAlias = config.aliases.some((alias) => procedureTextIncludes(sourceText, alias));
  const supportsAnchor = config.anchors.some((anchor) => {
    const anchorTokens = normalizeProcedureText(anchor)
      .split(" ")
      .filter((token) => token.length > 4);
    const matched = anchorTokens.filter((token) => sourceText.includes(token));
    return anchorTokens.length > 0 && matched.length / anchorTokens.length >= 0.45;
  });

  const requirementRule = config.requirementRule;
  const supportsRequirementRule =
    requirementRule &&
    source.documentType === requirementRule.documentType &&
    (!requirementRule.article || source.article === requirementRule.article);
  const supportsMatrixRequirement = procedureSourceRequirements(processType).some((requirement) =>
    sourceMatchesRequirement(source, requirement),
  );

  return supportsAlias || supportsAnchor || Boolean(supportsRequirementRule) || supportsMatrixRequirement;
}

function filterAnswerSources(sources: LegalSource[]) {
  return sources.filter((source) => normativeDocumentTypeSet.has(source.documentType) && answerDocumentTypes.has(source.documentType));
}

function selectHierarchicalAnswerSources(candidates: LegalSource[], topK: number) {
  const allowed = filterAnswerSources(candidates);
  const selected: LegalSource[] = [];
  const selectedIds = new Set<string>();

  for (const documentType of ["ley", "reglamento", "directiva", "opinion"]) {
    const bestForType = allowed
      .filter((source) => source.documentType === documentType)
      .slice(0, documentType === "opinion" ? 1 : 2);

    for (const source of bestForType) {
      if (!selectedIds.has(source.chunkId)) {
        selected.push(source);
        selectedIds.add(source.chunkId);
      }
    }
  }

  for (const source of allowed) {
    if (selected.length >= topK) {
      break;
    }

    if (!selectedIds.has(source.chunkId)) {
      selected.push(source);
      selectedIds.add(source.chunkId);
    }
  }

  return selected
    .sort((a, b) => {
      const priorityDelta = (normativePriority[b.documentType] ?? 0) - (normativePriority[a.documentType] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return b.evidenceQuality - a.evidenceQuality;
    })
    .slice(0, topK);
}

function buildCoverage(sources: LegalSource[]) {
  return {
    bases: sources.some((source) => source.documentType === "bases_integradas"),
    directiva: sources.some((source) => source.documentType === "directiva"),
    ley: sources.some((source) => source.documentType === "ley"),
    opinion: sources.some((source) => source.documentType === "opinion"),
    reglamento: sources.some((source) => source.documentType === "reglamento"),
  };
}

function buildCoverageText(assessment: SourceAssessment) {
  return [
    `Ley: ${assessment.coverage.ley ? "si" : "no"}`,
    `Reglamento: ${assessment.coverage.reglamento ? "si" : "no"}`,
    `Directiva: ${assessment.coverage.directiva ? "si" : "no"}`,
    `Opinion: ${assessment.coverage.opinion ? "si; no es norma obligatoria" : "no"}`,
    `Bases: ${assessment.coverage.bases ? "disponibles solo como esquema de implementacion" : "no"}`,
  ].join("\n");
}

function isNotCurrentSource(source: LegalSource) {
  const text = normalizeComparable(`${source.status ?? ""} ${source.vigencia ?? ""}`);
  return text.includes("derogado") || text.includes("derogada") || text.includes("modificado");
}

function isOldOpinion(source: LegalSource) {
  const currentYear = new Date().getFullYear();
  return source.documentType === "opinion" && Boolean(source.year && source.year <= currentYear - 5);
}

const evidenceStopWords = new Set([
  "ante",
  "bajo",
  "como",
  "con",
  "contra",
  "cual",
  "cuando",
  "de",
  "del",
  "desde",
  "dice",
  "el",
  "en",
  "entre",
  "es",
  "esta",
  "este",
  "la",
  "las",
  "le",
  "lo",
  "los",
  "para",
  "por",
  "que",
  "se",
  "sobre",
  "un",
  "una",
  "y",
]);

const legalSynonyms: Record<string, string[]> = {
  impedimentos: ["inhabilitacion", "prohibicion", "restriccion", "impedimento"],
  contratar: ["contratacion", "contratista", "proveedor"],
  especificaciones: ["especificacion tecnica", "requerimiento", "ficha tecnica"],
  emergencia: ["urgencia", "situacion de emergencia"],
  garantia: ["carta fianza", "fiel cumplimiento"],
  nulidad: ["invalidez", "anulacion"],
  expediente: ["expediente tecnico", "actuaciones preparatorias"],
  ley: ["norma", "marco normativo"],
  reglamento: ["decreto supremo", "disposicion reglamentaria"],
  subasta: ["subasta inversa electronica", "lances", "bienes comunes"],
};

function tokenizeEvidenceText(value: string) {
  return normalizeQuestionForSearch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !evidenceStopWords.has(token));
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens.filter(Boolean)));
}

function getStringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function detectArticle(text: string) {
  const match = text.match(/\b(?:art[ií]culo|art\.?)\s+([0-9]+[A-Za-z-]*)/i);
  return match?.[1] ?? null;
}

function detectRequestedArticle(text: string) {
  return detectArticle(text);
}

function normalizeQuestionForSearch(question: string) {
  const normalized = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/\bcontrtatar\b/g, "contratar"],
    [/\bcotratar\b/g, "contratar"],
    [/\bcotratacion(es)?\b/g, "contratacion$1"],
    [/\bcotratista\b/g, "contratista"],
    [/\bcontrtar\b/g, "contratar"],
    [/\bcontrtacion(es)?\b/g, "contratacion$1"],
    [/\bcontrtado\b/g, "contratado"],
    [/\bcontrtatista\b/g, "contratista"],
    [/\bcontrt(ar|acion|aciones|ado|atista|atar)\b/g, "contrat$1"],
    [/\bcontratarcion(es)?\b/g, "contratacion$1"],
    [/\bimpedimntos\b/g, "impedimentos"],
    [/\bimpedimnto\b/g, "impedimento"],
    [/\binpedimentos\b/g, "impedimentos"],
    [/\binpedimento\b/g, "impedimento"],
    [/\bimpedim(ento|entos)\b/g, "impedim$1"],
    [/\bgarantia\b/g, "garantia"],
    [/\breglamnto\b/g, "reglamento"],
    [/\bresolucion\b/g, "resolucion"],
    [/\bdirectiba\b/g, "directiva"],
    [/\bprovehedor\b/g, "proveedor"],
    [/\boecee\b/g, "oece"],
    [/\bconstratista\b/g, "contratista"],
    [/\blicitacion\b/g, "licitacion"],
    [/\bespecificacione(s)?\b/g, "especificaciones"],
    [/\bespecificasion(es)?\b/g, "especificacion$1"],
    [/\bespecificasion tecnica\b/g, "especificacion tecnica"],
    [/\btecnicas\b/g, "tecnicas"],
    [/\bsubasta inversa electronica\b/g, "subasta inversa electronica"],
    [/\bsubasta inbersa\b/g, "subasta inversa"],
    [/\beletronica\b/g, "electronica"],
    [/\belectronica\b/g, "electronica"],
  ];

  const corrected = replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    normalized,
  );

  return corrected.length >= 5 ? corrected : question;
}

function expandQueryForRecall(query: string) {
  const normalized = normalizeQuestionForSearch(query);
  const tokens = uniqueTokens(tokenizeEvidenceText(normalized));
  const expansions = tokens.flatMap((token) => legalSynonyms[token] ?? []);
  const requestedArticle = detectRequestedArticle(query);
  const articleBoost = requestedArticle ? [`articulo ${requestedArticle}`, `art. ${requestedArticle}`] : [];

  return uniqueTokens([...tokens, ...expansions, ...articleBoost]).join(" ");
}

function escapeIlikeValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("*", "").replaceAll(",", " ");
}

function normalizeComparable(value: string | null | undefined) {
  return normalizeQuestionForSearch(value ?? "");
}

function sourceMatchesFilters(source: LegalSource, filters: SearchFilters) {
  if (filters.article && source.article !== filters.article) {
    return false;
  }

  if (filters.documentIds && filters.documentIds.length > 0) {
    if (!filters.documentIds.includes(source.documentId)) return false;
  } else if (filters.documentId && source.documentId !== filters.documentId) {
    return false;
  }

  if (filters.documentType && source.documentType !== filters.documentType) {
    return false;
  }

  if (filters.sourceEntity && !normalizeComparable(source.sourceEntity).includes(normalizeComparable(filters.sourceEntity))) {
    return false;
  }

  if (filters.topic && !normalizeComparable(source.topic).includes(normalizeComparable(filters.topic))) {
    return false;
  }

  if (filters.status && !normalizeComparable(source.status).includes(normalizeComparable(filters.status))) {
    return false;
  }

  if (
    filters.processType &&
    source.processType !== filters.processType &&
    source.processType !== "todos"
  ) {
    return false;
  }

  if (filters.vigencia && !normalizeComparable(source.vigencia).includes(normalizeComparable(filters.vigencia))) {
    return false;
  }

  if (filters.year && source.year !== filters.year) {
    return false;
  }

  return true;
}

function isLikelyLegalProcurementQuestion(question: string) {
  const normalized = normalizeQuestionForSearch(question);
  const legalTerms = [
    "contratacion",
    "contratar",
    "contrato",
    "contratista",
    "proveedor",
    "entidad",
    "oece",
    "ley",
    "32069",
    "reglamento",
    "directiva",
    "resolucion",
    "opinion",
    "impedimento",
    "garantia",
    "penalidad",
    "procedimiento",
    "comparacion",
    "precios",
    "comparacion de precios",
    "licitacion",
    "adjudicacion",
    "expediente",
    "bases",
    "monto",
    "plazo",
    "conformidad",
    "requerimiento",
    "seace",
    "subasta",
    "inversa",
    "electronica",
    "sie",
    "lance",
    "lances",
    "ficha tecnica",
    "fichas tecnicas",
    "bienes comunes",
    "bases estandar",
    "bases integradas",
    "especificacion",
    "especificaciones",
    "especificaciones tecnicas",
    "terminos de referencia",
    "requerimiento",
    "publica",
    "publicas",
    // Procedimientos y figuras que faltaban (evita rechazar consultas legales validas).
    "acuerdo marco",
    "acuerdo",
    "marco",
    "catalogo",
    "catalogo electronico",
    "consultor",
    "consultores",
    "consultoria",
    "concurso",
    "contratacion directa",
    "postor",
    "oferta",
    "ofertas",
    "buena pro",
    "valor referencial",
    "valor estimado",
    "cuantia de la contratacion",
    "cuantia",
    "uit",
    "desierto",
    "nulidad",
    "apelacion",
    "recurso",
    "arbitraje",
    "junta de prevencion",
    "sancion",
    "tribunal",
    "peru compras",
    "perucompras",
    "vigencia",
    "modificatoria",
    "adenda",
    "addenda",
    "adelanto",
    "conformidad",
    "supervisor",
    "valorizacion",
    // Infracciones, sanciones y temas administrativos frecuentes (evitan rechazar
    // consultas legales validas cuya redaccion no usa una palabra del listado).
    "multa",
    "multas",
    "infraccion",
    "infracciones",
    "inhabilitacion",
    "sancionado",
    "documento",
    "documentos",
    "documentacion",
    "falso",
    "falsa",
    "falsos",
    "falsas",
    "falsedad",
    "denuncia",
    "queja",
    "reclamo",
    "responsabilidad",
    "obligacion",
    "obligaciones",
    "derecho",
    "derechos",
    "prohibicion",
    "prohibido",
    "incumplimiento",
    "resolucion del contrato",
    "ejecucion contractual",
    "ampliacion de plazo",
    "prestaciones adicionales",
    "subcontratacion",
    "consorcio",
    "postor",
    "postores",
    "ganador",
    "buena pro",
    "ficha tecnica",
    "registro nacional de proveedores",
    "rnp",
    "homologacion",
    "estandarizacion",
    "presupuesto",
    "cuantia",
    "convocatoria",
    "absolucion de consultas",
    "integracion de bases",
    "comite de seleccion",
    "organo encargado",
    "actuaciones preparatorias",
  ];

  // Tambien reconoce los alias de todos los procedimientos configurados en el
  // catalogo (DRY): asi cualquier procedimiento valido se considera dentro de
  // alcance aunque no este en la lista manual de arriba.
  const catalogAliases = Object.values(procedureCatalog).flatMap((entry) => [
    entry.label.toLowerCase(),
    ...entry.aliases,
  ]);

  return [...legalTerms, ...catalogAliases].some((term) =>
    normalized.includes(normalizeProcedureText(term)),
  );
}

function buildStyleInstruction(
  tone: z.infer<typeof chatRequestSchema>["tone"],
  length: z.infer<typeof chatRequestSchema>["length"],
) {
  const tones = {
    didactico:
      "Tono cercano y didactico: explica como a alguien que recien aprende, con lenguaje claro y, cuando ayude, un ejemplo sencillo. Si usas un termino tecnico, explicalo en pocas palabras.",
    formal:
      "Tono de asesoria legal formal: preciso y sobrio, con terminologia juridica correcta y sin coloquialismos.",
    tecnico:
      "Tono tecnico y directo para especialistas: denso en reglas y datos, minimo relleno, foco en condiciones, requisitos, plazos y fuentes.",
  };
  const lengths = {
    concisa:
      "Extension MUY BREVE: responde en 1 a 2 parrafos cortos o como maximo 3-4 viñetas. Solo lo esencial, sin encabezados de seccion ni desarrollo. Ve directo al punto; si el usuario quiere mas, lo pedira.",
    media:
      "Extension MEDIA (equilibrada y compacta): respuesta directa + una explicacion breve y, si aplica, una orientacion practica corta. Maximo ~3 parrafos cortos o 2 secciones breves; no abundes en detalles.",
    detallada:
      "Extension DETALLADA: desarrolla a fondo (que es, como funciona, condiciones, en la practica) con todas las secciones utiles.",
  };

  return `${tones[tone]} ${lengths[length]}`;
}

function buildContext(sources: LegalSource[]) {
  return sources
    .map(
      (source, index) => `[F${index + 1}]
Documento: ${source.documentTitle}${source.documentNumber ? ` (N.° ${source.documentNumber})` : ""}
Tipo: ${source.documentType}
Entidad: ${source.sourceEntity ?? "No registrada"}
Tipo de proceso: ${source.processType ?? "No registrado"}
Ubicacion: ${source.citation}
Seccion: ${source.sectionTitle ?? "No identificada"}
Calidad de evidencia: ${source.evidenceQuality.toFixed(2)}
Fragmento: ${source.excerpt}`,
    )
    .join("\n\n");
}

function groupSourcesByDocument(sources: LegalSource[]) {
  const grouped = new Map<
    string,
    {
      document: LegalSource;
      sources: LegalSource[];
    }
  >();

  for (const source of sources) {
    const key = source.documentId;
    const existing = grouped.get(key);

    if (existing) {
      existing.sources.push(source);
    } else {
      grouped.set(key, {
        document: source,
        sources: [source],
      });
    }
  }

  return Array.from(grouped.values());
}

function buildUniqueSourceLines(sources: LegalSource[]) {
  return groupSourcesByDocument(sources)
    .map(
      ({ document, sources: documentSources }, index) =>
        `${index + 1}. ${document.documentTitle} (${document.documentType}, ${documentSources
          .map(
            (source) =>
              `fragmento ${source.chunkIndex + 1}${
                source.pageStart ? `, pagina ${source.pageStart}` : ""
              }${source.article ? `, articulo ${source.article}` : ""}`,
          )
          .join("; ")})`,
    )
    .join("\n");
}

function buildFallbackAnswer(question: string, sources: LegalSource[]) {
  const sourceLines = buildUniqueSourceLines(sources);
  const excerpts = sources
    .slice(0, 2)
    .map((source, index) => `${source.excerpt.slice(0, 550)} [F${index + 1}]`)
    .join("\n\n");

  return `Respuesta:
No pude generar una redaccion completa con OpenAI en este momento, pero si encontre fuentes semanticamente relacionadas con la pregunta: "${question}".

Fundamento legal:
Los fragmentos recuperados indican lo siguiente:
${excerpts}

Fuentes usadas:
${sourceLines}

Nivel de confianza: baja`;
}

function applySystemConfidence(answer: string, confidence: SourceAssessment["confidence"]) {
  const withoutModelConfidence = answer
    .replace(/(?:^|\n)\s*Nivel de confianza\s*:\s*(alta|media|baja)\s*\.?\s*$/gim, "")
    .trim();

  return `${withoutModelConfidence}\n\nNivel de confianza: ${confidence}`;
}

async function getRecentChatHistory(accessToken: string, sessionId?: string) {
  if (!sessionId) {
    return [];
  }

  // Lectura con el JWT del usuario: el RLS garantiza que solo vea su sesion.
  const messages = await supabaseUserRest<ChatMessageRecord[]>(
    accessToken,
    `chat_messages?session_id=eq.${sessionId}&select=role,content&order=created_at.desc&limit=6`,
  );

  return messages.reverse();
}

function buildCitation(source: Pick<LegalSource, "article" | "documentTitle" | "pageEnd" | "pageStart">) {
  const location = [
    source.article ? `articulo ${source.article}` : null,
    source.pageStart
      ? source.pageEnd && source.pageEnd !== source.pageStart
        ? `paginas ${source.pageStart}-${source.pageEnd}`
        : `pagina ${source.pageStart}`
      : null,
  ].filter(Boolean);

  return `${source.documentTitle}${location.length > 0 ? `, ${location.join(", ")}` : ""}`;
}

function lexicalCoverage(query: string, text: string) {
  const queryTokens = tokenizeEvidenceText(query);

  if (queryTokens.length === 0) {
    return 0;
  }

  const textTokens = new Set(tokenizeEvidenceText(text));
  const matched = queryTokens.filter((token) => textTokens.has(token));
  return matched.length / queryTokens.length;
}

function evidenceQualityScore(source: LegalSource, query: string) {
  const hasPage = source.pageStart ? 0.08 : 0;
  const hasArticle = source.article ? 0.08 : 0;
  const hasTopic = source.topic ? 0.04 : 0;
  const hasVigencia = source.vigencia ? 0.04 : 0;
  const normativeBoost = (normativePriority[source.documentType] ?? 0) * 0.025;
  const requestedProcessType = inferProcessTypeFromQuestion(query);
  const requirements = procedureSourceRequirements(requestedProcessType);
  const criticalSourceBoost = requirements.some(
    (requirement) => requirement.critical && sourceMatchesRequirement(source, requirement),
  )
    ? 0.14
    : 0;
  const optionalSourcePenalty = requirements.some(
    (requirement) => requirement.optional && sourceMatchesRequirement(source, requirement),
  )
    ? -0.03
    : 0;
  const processBoost = requestedProcessType && sourceSupportsProcess(source, requestedProcessType) ? 0.07 : 0;
  const processMismatchPenalty = requestedProcessType && !sourceSupportsProcess(source, requestedProcessType) ? -0.25 : 0;
  const basesPenalty = source.documentType === "bases_integradas" ? -0.22 : 0;
  const nonCurrentPenalty = isNotCurrentSource(source) ? -0.12 : 0;
  const oldOpinionPenalty = isOldOpinion(source) ? -0.08 : 0;
  const lexical = lexicalCoverage(query, `${source.documentTitle} ${source.topic ?? ""} ${source.excerpt}`);
  const semantic = Math.min(Math.max(source.semanticScore, source.rerankScore), 1);

  return Math.max(
    0,
    Math.min(
      1,
      semantic * 0.54 +
        lexical * 0.27 +
        hasPage +
        hasArticle +
        hasTopic +
        hasVigencia +
        normativeBoost +
        criticalSourceBoost +
        optionalSourcePenalty +
        processBoost +
        processMismatchPenalty +
        basesPenalty +
        nonCurrentPenalty +
        oldOpinionPenalty,
    ),
  );
}

function rerankSources(sources: LegalSource[], query: string, topK: number) {
  const queryArticle = detectRequestedArticle(query);
  const byChunk = new Map<string, LegalSource>();

  for (const source of sources) {
    const existing = byChunk.get(source.chunkId);
    const merged: LegalSource = existing
      ? {
          ...existing,
          lexicalScore: Math.max(existing.lexicalScore, source.lexicalScore),
          rerankScore: Math.max(existing.rerankScore, source.rerankScore),
          matchType:
            existing.matchType === source.matchType ? existing.matchType : "hibrida",
          score: Math.max(existing.score, source.score),
          semanticScore: Math.max(existing.semanticScore, source.semanticScore),
        }
      : source;

    const articleBoost = queryArticle && merged.article === queryArticle ? 0.12 : 0;
    const quality = evidenceQualityScore(merged, query);
    byChunk.set(merged.chunkId, {
      ...merged,
      citation: buildCitation(merged),
      evidenceQuality: Math.min(1, quality + articleBoost),
      score: Math.min(1, Math.max(merged.score, quality + articleBoost)),
    });
  }

  return Array.from(byChunk.values())
    .sort((a, b) => {
      const priorityDelta = (normativePriority[b.documentType] ?? 0) - (normativePriority[a.documentType] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      if (b.evidenceQuality !== a.evidenceQuality) {
        return b.evidenceQuality - a.evidenceQuality;
      }

      return b.score - a.score;
    })
    .slice(0, topK);
}

function buildHistoryContext(messages: ChatMessageRecord[]) {
  if (messages.length === 0) {
    return "Sin historial previo en esta sesion.";
  }

  return messages
    .map((message) => `${message.role === "user" ? "Usuario" : "Asistente"}: ${message.content}`)
    .join("\n\n");
}

function assessSources(
  sources: LegalSource[],
  options?: { processType?: string | null; queryUsed?: string; scope?: SourceAssessment["scope"] },
): SourceAssessment {
  const queryTokens = tokenizeEvidenceText(options?.queryUsed ?? "");
  const evidenceText = tokenizeEvidenceText(
    sources
      .map((source) => `${source.documentTitle} ${source.documentType} ${source.topic ?? ""} ${source.excerpt}`)
      .join(" "),
  );
  const evidenceTokenSet = new Set(evidenceText);
  const matchedQueryTokens = queryTokens.filter((token) => evidenceTokenSet.has(token));
  const lexicalScore =
    queryTokens.length > 0 ? matchedQueryTokens.length / Math.max(queryTokens.length, 1) : 0;
  const topScore = sources[0]?.score ?? 0;
  const coverage = buildCoverage(sources);
  const inferredProcessType = options?.processType || (options?.queryUsed ? inferProcessTypeFromQuestion(options.queryUsed) : null);
  const procedureCoverage = assessProcedureSourceCoverage(inferredProcessType, sources);
  const averageScore =
    sources.length > 0
      ? sources.reduce((total, source) => total + source.score, 0) / sources.length
      : 0;
  const averageEvidenceQuality =
    sources.length > 0
      ? sources.reduce((total, source) => total + source.evidenceQuality, 0) / sources.length
      : 0;
  const uniqueDocuments = new Set(sources.map((source) => source.documentId)).size;
  const hasMeaningfulText = sources.reduce((total, source) => total + source.excerpt.length, 0) >= 600;
  // Señales de relevancia. El rerank dedicado (bge) es la mas fiable y NO depende
  // del modelo de embeddings; el coseno crudo de OpenAI (text-embedding-3-small)
  // es mas bajo que el del modelo anterior, por eso los umbrales semanticos son
  // menores. `topScore` (max de semantico/lexical) esta inflado por el lexical y
  // ya no se usa para confianza.
  const topRerankScore = sources.reduce((max, source) => Math.max(max, source.rerankScore), 0);
  const topSemanticScore = sources.reduce((max, source) => Math.max(max, source.semanticScore), 0);
  const hasSemanticSignal = topRerankScore >= 0.3 || topSemanticScore >= 0.32 || averageScore >= 0.38;
  const hasLexicalSignal = lexicalScore >= 0.45 && matchedQueryTokens.length >= 2;
  const hasTraceableCitation = sources.some((source) => source.pageStart || source.article);
  const nonCurrentSources = sources.filter(isNotCurrentSource);
  const oldOpinions = sources.filter(isOldOpinion);
  const scope = options?.scope ?? "unknown";
  const requestedArticle = detectRequestedArticle(options?.queryUsed ?? "");
  const exactArticleSource = requestedArticle
    ? sources.find(
        (source) =>
          source.article === requestedArticle &&
          Boolean(source.pageStart) &&
          source.evidenceQuality >= 0.52 &&
          (source.score >= 0.5 || source.lexicalScore >= 0.35),
      )
    : null;
  const sufficient =
    scope !== "off_topic" &&
    !procedureCoverage.basesOnly &&
    (sources.length >= 2 || Boolean(exactArticleSource)) &&
    uniqueDocuments >= 1 &&
    (hasMeaningfulText || Boolean(exactArticleSource)) &&
    hasTraceableCitation &&
    (hasSemanticSignal || hasLexicalSignal || averageEvidenceQuality >= 0.45);

  let confidence: SourceAssessment["confidence"] = "baja";

  // Solo se exige la fuente critica del PROCEDIMIENTO cuando la pregunta pide uno
  // concreto. En preguntas generales (definiciones, funciones del OECE, etc.) no
  // se exige Reglamento para poder dar confianza, porque muchas se responden con
  // la Ley sola.
  const criticalMet = inferredProcessType ? procedureCoverage.missingCritical.length === 0 : true;

  if (
    sufficient &&
    criticalMet &&
    sources.length >= 3 &&
    (topRerankScore >= 0.6 || averageEvidenceQuality >= 0.62) &&
    (hasLexicalSignal || topSemanticScore >= 0.35)
  ) {
    confidence = "alta";
  } else if (
    sufficient &&
    criticalMet &&
    (topRerankScore >= 0.28 ||
      topSemanticScore >= 0.32 ||
      averageEvidenceQuality >= 0.5 ||
      (sources.length >= 3 && lexicalScore >= 0.45) ||
      Boolean(exactArticleSource))
  ) {
    confidence = "media";
  }

  const evidenceWarnings = [
    scope === "off_topic" ? "La pregunta no parece pertenecer al ambito juridico/documental configurado." : null,
    sources.length < 2 && !exactArticleSource ? "Hay menos de dos fragmentos utiles recuperados." : null,
    procedureCoverage.basesOnly
      ? "Solo se recuperaron bases integradas; son apoyo operativo y no fundamento normativo suficiente."
      : null,
    procedureCoverage.missingCritical.length > 0
      ? `Faltan fuentes criticas del procedimiento: ${procedureCoverage.missingCritical.join(", ")}.`
      : null,
    procedureCoverage.warnings.length > 0 ? procedureCoverage.warnings.join(" ") : null,
    exactArticleSource
      ? "La consulta fue sustentada en un articulo exacto recuperado con pagina identificada; aun asi revise el texto completo del articulo antes de decidir."
      : null,
    !hasTraceableCitation ? "Las fuentes recuperadas no tienen pagina o articulo identificable." : null,
    !hasSemanticSignal && !exactArticleSource ? "La similitud semantica no es fuerte." : null,
    !hasLexicalSignal && !exactArticleSource ? "La coincidencia literal con la consulta es limitada." : null,
    nonCurrentSources.length > 0
      ? "Existen fuentes marcadas como derogadas, modificadas o no plenamente vigentes; revisar vigencia antes de usar la respuesta."
      : null,
    oldOpinions.length > 0
      ? "Se encontraron opiniones antiguas; recuerde que una opinion no es norma obligatoria y debe validarse su vigencia/criterio actual."
      : null,
  ].filter(Boolean) as string[];

  return {
    averageScore,
    confidence,
    reason: sufficient
      ? "Fuentes suficientes: hay evidencia documental trazable y coincidencia semantica/lexical util."
      : "No hay evidencia documental suficiente para generar una respuesta juridica sustentada.",
    coverage,
    evidenceQuality: averageEvidenceQuality,
    evidenceWarnings,
    procedureCoverage,
    sufficient,
    topScore,
    lexicalScore,
    uniqueDocuments,
    queryUsed: options?.queryUsed,
    scope,
  };
}

async function fetchChunksByVectorIds(vectorIds: string[]) {
  if (vectorIds.length === 0) {
    return [];
  }

  return supabaseRest<DocumentChunk[]>(
    `document_chunks?pinecone_vector_id=in.(${escapePostgrestIn(
      vectorIds,
    )})&select=id,document_id,chunk_index,content,metadata,page_start,page_end,pinecone_vector_id,documents(id,title,document_type,source_entity,file_name,status,metadata)`,
  );
}

async function searchLexicalChunks(query: string, limit: number) {
  const tokens = uniqueTokens(tokenizeEvidenceText(query)).slice(0, 8);

  if (tokens.length === 0) {
    return [];
  }

  const clauses = tokens
    .map((token) => `content.ilike.*${escapeIlikeValue(token)}*`)
    .join(",");

  return supabaseRest<DocumentChunk[]>(
    `document_chunks?or=(${encodeURIComponent(
      clauses,
    )})&select=id,document_id,chunk_index,content,metadata,page_start,page_end,pinecone_vector_id,documents(id,title,document_type,source_entity,file_name,status,metadata)&limit=${limit}`,
  );
}

function chunkToSource(
  chunk: DocumentChunk,
  options: {
    hit?: Awaited<ReturnType<typeof searchTextRecords>>[number];
    lexicalScore?: number;
    matchType: LegalSource["matchType"];
    query: string;
  },
): LegalSource {
  const hit = options.hit;
  const documentMetadata = chunk.documents?.metadata ?? {};
  const chunkMetadata = chunk.metadata ?? {};
  const semanticScore = hit?._score ?? 0;
  const lexicalScore =
    options.lexicalScore ??
    lexicalCoverage(options.query, `${chunk.documents?.title ?? ""} ${chunk.content}`);
  const article =
    getStringMetadata(chunkMetadata, "article") ??
    (typeof hit?.article === "string" ? hit.article : null) ??
    detectArticle(chunk.content);
  const pageStart = chunk.page_start ?? hit?.page_start ?? getNumberMetadata(chunkMetadata, "pageStart");
  const pageEnd = chunk.page_end ?? hit?.page_end ?? getNumberMetadata(chunkMetadata, "pageEnd");
  const source: LegalSource = {
    article,
    sectionTitle:
      getStringMetadata(chunkMetadata, "sectionTitle") ??
      (typeof hit?.section_title === "string" ? hit.section_title : null),
    chunkId: chunk.id,
    chunkIndex: chunk.chunk_index,
    citation: "",
    documentId: chunk.document_id,
    documentTitle: chunk.documents?.title ?? hit?.title ?? "Documento sin titulo",
    documentNumber:
      getStringMetadata(documentMetadata, "documentNumber") ??
      getStringMetadata(documentMetadata, "number") ??
      (typeof hit?.document_number === "string" ? hit.document_number : null),
    documentType: chunk.documents?.document_type ?? hit?.document_type ?? "otros",
    evidenceQuality: 0,
    excerpt: chunk.content.slice(0, 1400),
    fileName: chunk.documents?.file_name ?? "archivo.pdf",
    lexicalScore,
    rerankScore: 0,
    matchType: options.matchType,
    pageEnd,
    pageStart,
    score: Math.max(semanticScore, lexicalScore),
    semanticScore,
    sourceEntity: chunk.documents?.source_entity ?? hit?.source_entity ?? null,
    processType:
      getStringMetadata(documentMetadata, "processType") ??
      getStringMetadata(documentMetadata, "process_type") ??
      (typeof hit?.process_type === "string" ? hit.process_type : null),
    status:
      getStringMetadata(documentMetadata, "status") ??
      (typeof hit?.status === "string" ? hit.status : null),
    topic:
      getStringMetadata(documentMetadata, "topic") ??
      (typeof hit?.topic === "string" ? hit.topic : null),
    vigencia:
      getStringMetadata(documentMetadata, "vigencia") ??
      (typeof hit?.vigencia === "string" ? hit.vigencia : null),
    year: getNumberMetadata(documentMetadata, "year") ?? hit?.year ?? null,
  };

  return {
    ...source,
    citation: buildCitation(source),
    evidenceQuality: evidenceQualityScore(source, options.query),
  };
}

export async function searchLegalSources(
  input: z.infer<typeof semanticSearchRequestSchema>,
): Promise<{ assessment: SourceAssessment; sources: LegalSource[]; semanticaCaida: boolean }> {
  const filters = normalizeFilters(input.filters);
  const pineconeFilters = {
    ...filters,
    processType: undefined,
  };
  const queryUsed = normalizeQuestionForSearch(input.query);
  const expandedQuery = expandQueryForRecall(queryUsed);
  const semanticTopK = Math.min(30, Math.max(input.topK * 2, 10));
  // Si el embedding/semántico falla (p. ej. sin cuota para embeddings), la
  // búsqueda NO se cae: degrada al modo léxico (SQL). Pero el fallo se REPORTA en
  // `semanticaCaida` en vez de tragarse: el respaldo léxico es un `ilike` con OR
  // entre palabras y sin orden por relevancia, así que devuelve fragmentos casi
  // arbitrarios. Presentarlos como fundamento normativo, sin decir que la
  // búsqueda real está caída, es peor que no citar nada.
  let semanticaCaida = false;
  const [hits, lexicalChunks] = await Promise.all([
    searchTextRecords(expandedQuery, semanticTopK, pineconeFilters).catch(() => {
      semanticaCaida = true;
      return [];
    }),
    searchLexicalChunks(queryUsed, Math.min(50, semanticTopK * 2)).catch(() => []),
  ]);
  const vectorIds = uniqueValues(hits.map((hit) => hit._id));

  if (vectorIds.length === 0 && lexicalChunks.length === 0) {
    return {
      assessment: assessSources([], {
        processType: filters.processType,
        queryUsed,
        scope: isLikelyLegalProcurementQuestion(input.query) ? "legal" : "unknown",
      }),
      semanticaCaida,
      sources: [],
    };
  }

  const chunks = await fetchChunksByVectorIds(vectorIds);
  const hitById = new Map(hits.map((hit) => [hit._id, hit]));
  const semanticSources = chunks.map((chunk) =>
    chunkToSource(chunk, {
      hit: hitById.get(chunk.pinecone_vector_id),
      matchType: "semantica",
      query: queryUsed,
    }),
  );
  const lexicalSources = lexicalChunks.map((chunk) =>
    chunkToSource(chunk, {
      lexicalScore: lexicalCoverage(queryUsed, `${chunk.documents?.title ?? ""} ${chunk.content}`),
      matchType: "lexical",
      query: queryUsed,
    }),
  );
  const combined = [...semanticSources, ...lexicalSources].filter((source) =>
    sourceMatchesFilters(source, filters),
  );

  // Reranking dedicado (modelo): reordena por relevancia real del fragmento
  // frente a la consulta. Alimenta el rerank heuristico posterior (jerarquia +
  // articulo) via evidenceQualityScore; si falla, se conserva el orden previo.
  const rerankInputs = Array.from(new Map(combined.map((source) => [source.chunkId, source])).values()).map(
    (source) => ({ id: source.chunkId, text: `${source.documentTitle} ${source.excerpt}` }),
  );
  const reranked = await rerankWithModel(input.query, rerankInputs);

  if (reranked) {
    const scoreByChunk = new Map(reranked.map((hit) => [hit.id, hit.score]));
    for (const source of combined) {
      const score = scoreByChunk.get(source.chunkId);
      if (typeof score === "number") {
        source.rerankScore = score;
      }
    }
  }

  const sources = rerankSources(combined, queryUsed, input.topK);

  return {
    semanticaCaida,
    assessment: assessSources(sources, {
      processType: filters.processType,
      queryUsed,
      scope: isLikelyLegalProcurementQuestion(input.query) ? "legal" : "unknown",
    }),
    sources,
  };
}

async function persistChatExchange(input: {
  accessToken: string;
  actorReference?: string;
  answer: string;
  assessment: SourceAssessment;
  entity?: string | null;
  filters?: z.infer<typeof legalSearchFiltersSchema>;
  mode: string;
  model: string;
  ownerId: string;
  question: string;
  role?: string;
  sessionId?: string;
  sources: LegalSource[];
}) {
  let sessionId = input.sessionId;

  if (!sessionId) {
    const [session] = await supabaseUserRest<ChatSessionRecord[]>(input.accessToken, "chat_sessions", {
      body: JSON.stringify({
        metadata: {
          filters: input.filters ?? null,
          mode: input.mode,
        },
        owner_id: input.ownerId,
        title: input.question.slice(0, 90),
      }),
      method: "POST",
    });
    sessionId = session.id;
  }

  const insertedMessages = await supabaseUserRest<ChatMessageInsertRecord[]>(input.accessToken, "chat_messages", {
    body: JSON.stringify([
      {
        content: input.question,
        metadata: {
          filters: input.filters ?? null,
          mode: input.mode,
        },
        model: null,
        role: "user",
        session_id: sessionId,
      sources: [],
      },
      {
        content: input.answer,
        metadata: {
          assessment: input.assessment,
          confidence: input.assessment.confidence,
          question: input.question,
        },
        model: input.model,
        role: "assistant",
        session_id: sessionId,
        sources: input.sources,
      },
    ]),
    method: "POST",
  });
  const assistantMessage = insertedMessages.find((message) => message.role === "assistant");

  if (assistantMessage && input.sources.length > 0) {
    const extendedRows = input.sources.map((source) => ({
      article: source.article,
      chunk_id: source.chunkId,
      document_id: source.documentId,
      document_title: source.documentTitle,
      evidence_quality: source.evidenceQuality,
      lexical_score: source.lexicalScore,
      match_type: source.matchType,
      message_id: assistantMessage.id,
      metadata: {
        citation: source.citation,
        documentType: source.documentType,
        sourceEntity: source.sourceEntity,
        processType: source.processType,
        sectionTitle: source.sectionTitle,
        status: source.status,
        topic: source.topic,
        vigencia: source.vigencia,
        year: source.year,
      },
      page: source.pageStart,
      page_end: source.pageEnd,
      quote: source.excerpt,
      score: source.score,
      semantic_score: source.semanticScore,
    }));
    const legacyRows = input.sources.map((source) => ({
      article: source.article,
      chunk_id: source.chunkId,
      document_id: source.documentId,
      document_title: source.documentTitle,
      message_id: assistantMessage.id,
      page: source.pageStart,
      quote: source.excerpt,
      score: source.score,
    }));

    await supabaseUserRest(input.accessToken, "chat_sources", {
      body: JSON.stringify(extendedRows),
      method: "POST",
    }).catch(() =>
      supabaseUserRest(input.accessToken, "chat_sources", {
        body: JSON.stringify(legacyRows),
        method: "POST",
      }).catch(() => undefined),
    );
  }

  await writeAuditLog({
    action: "chat.message",
    actorReference: input.actorReference,
    details: {
      ...institutionalAuditDetails({
        conclusion: input.assessment.sufficient ? "respuesta_con_fuentes_suficientes" : "respuesta_requiere_revision",
        entity: input.entity ?? null,
        processType: input.filters?.processType ?? null,
        query: input.question,
        role: input.role ?? null,
        sources: input.sources,
        userId: input.ownerId,
      }),
      actor: {
        entity: input.entity ?? null,
        id: input.ownerId,
        role: input.role ?? null,
      },
      confidence: input.assessment.confidence,
      evidenceQuality: input.assessment.evidenceQuality,
      evidenceWarnings: input.assessment.evidenceWarnings,
      mode: input.mode,
      queryUsed: input.assessment.queryUsed ?? input.question,
      sourceCount: input.sources.length,
      sufficient: input.assessment.sufficient,
    },
    entityId: sessionId,
    entityType: "chat_session",
    module: "chat",
    processType: input.filters?.processType ?? null,
    user: {
      email: input.actorReference ?? null,
      entity: input.entity ?? null,
      id: input.ownerId,
      role: input.role ?? null,
    },
  });

  return {
    assistantMessageId: assistantMessage?.id ?? null,
    sessionId,
  };
}

type ChatFilters = z.infer<typeof legalSearchFiltersSchema>;

type GenerationParams = {
  input: Array<{ content: string; role: "system" | "user" }>;
  max_output_tokens: number;
  model: string;
  temperature: number;
};

type PreparedAnswer =
  | {
      status: "final";
      answer: string;
      model: string;
      assessment: SourceAssessment;
      sources: LegalSource[];
      chatFilters: ChatFilters;
    }
  | {
      status: "generate";
      generationParams: GenerationParams;
      assessment: SourceAssessment;
      sources: LegalSource[];
      chatFilters: ChatFilters;
    };

export type ChatStreamEvent =
  | { type: "meta"; sources: LegalSource[]; assessment: SourceAssessment; confidence: SourceAssessment["confidence"] }
  | { type: "delta"; text: string }
  | {
      type: "done";
      sessionId: string | null;
      messageId: string | null;
      model: string;
      citationWarnings?: string[];
    }
  | { type: "error"; error: string };

// Persiste el intercambio salvo que el llamador lo desactive (evaluador continuo).
async function maybePersist(auth: ChatAuthContext, args: Parameters<typeof persistChatExchange>[0]) {
  if (auth.persist === false) {
    return { assistantMessageId: null as string | null, sessionId: args.sessionId ?? null };
  }
  return persistChatExchange({
    ...args,
    actorReference: auth.actorReference,
    entity: auth.entity,
    role: auth.role,
  });
}

// Fase comun de recuperacion + gating. Devuelve una respuesta final determinista
// (guards/gates) o los parametros listos para generar con el modelo.
async function prepareLegalAnswer(
  input: z.infer<typeof chatRequestSchema>,
  auth: ChatAuthContext,
): Promise<PreparedAnswer> {
  const likelyLegal = isLikelyLegalProcurementQuestion(input.question);
  const inferredProcessType = inferProcessTypeFromQuestion(input.question);
  const normalizedChatFilters = normalizeChatAnswerFilters(input.filters);
  const chatFilters = {
    ...(normalizedChatFilters ?? {}),
    processType: normalizedChatFilters?.processType || inferredProcessType || "",
  };
  const requestedProcessType = chatFilters.processType || null;

  // El alcance se decide DESPUES de buscar, segun la relevancia real de lo
  // recuperado (no por una lista de palabras). Asi no se rechazan consultas
  // legales validas cuya redaccion no use un termino del listado.
  const shouldRunBroadNormativeSearch = Boolean(chatFilters?.processType && !chatFilters.documentType);
  const broadNormativeFilters = shouldRunBroadNormativeSearch
    ? {
        ...chatFilters,
        processType: "",
      }
    : null;
  const anchoredQuery = requestedProcessType
    ? buildProcessAnchoredQuery(input.question, requestedProcessType)
    : input.question;
  // Pasadas tipadas a la(s) fuente(s) critica(s) del procedimiento (reglamento /
  // directiva). En recuperacion abierta la Ley suele dominar y tapar al Reglamento
  // aunque sea la fuente que desarrolla las condiciones; forzar el documentType
  // garantiza que esos fragmentos entren al pool de candidatos.
  const criticalScopedTypes = requestedProcessType
    ? Array.from(
        new Set(
          procedureSourceRequirements(requestedProcessType)
            .filter(
              (requirement) =>
                requirement.critical &&
                (requirement.documentType === "reglamento" || requirement.documentType === "directiva"),
            )
            .map((requirement) => requirement.documentType),
        ),
      )
    : [];
  const [history, searchResult, broadSearchResult, anchoredSearchResult, ...scopedResults] =
    await Promise.all([
      getRecentChatHistory(auth.accessToken, input.sessionId),
      searchLegalSources({
        filters: chatFilters,
        query: input.question,
        topK: 10,
      }),
      broadNormativeFilters
        ? searchLegalSources({
            filters: broadNormativeFilters,
            query: input.question,
            topK: 10,
          })
        : Promise.resolve(null),
      requestedProcessType
        ? searchLegalSources({
            filters: {
              ...chatFilters,
              processType: "",
            },
            query: anchoredQuery,
            topK: 14,
          })
        : Promise.resolve(null),
      ...criticalScopedTypes.map((documentType) =>
        searchLegalSources({
          filters: { ...chatFilters, documentType, processType: "" },
          query: anchoredQuery,
          topK: 6,
        }),
      ),
    ]);
  const processRelevantBroadSources = (broadSearchResult?.sources ?? []).filter((source) =>
    sourceSupportsProcess(source, requestedProcessType),
  );
  const processRelevantAnchoredSources = (anchoredSearchResult?.sources ?? []).filter((source) =>
    sourceSupportsProcess(source, requestedProcessType),
  );
  const processRelevantScopedSources = scopedResults
    .flatMap((result) => result?.sources ?? [])
    .filter((source) => sourceSupportsProcess(source, requestedProcessType));
  const candidateSources = rerankSources(
    [
      ...searchResult.sources,
      ...processRelevantBroadSources,
      ...processRelevantAnchoredSources,
      ...processRelevantScopedSources,
    ].filter((source) => sourceSupportsProcess(source, requestedProcessType)),
    normalizeQuestionForSearch(input.question),
    24,
  );
  // Garantiza que las mejores fuentes criticas tipadas (reglamento/directiva del
  // procedimiento) lleguen a la seleccion jerarquica aunque su ranking global no
  // entre al top: en consultas de requisitos la Ley suele dominar y, si no se
  // inyectan, el Reglamento se queda fuera (p. ej. licitacion, contratacion directa).
  const scopedForSelection = rerankSources(
    processRelevantScopedSources,
    normalizeQuestionForSearch(input.question),
    4,
  );
  const sources = selectHierarchicalAnswerSources([...candidateSources, ...scopedForSelection], 8);
  const assessment = assessSources(sources, {
    processType: requestedProcessType,
    queryUsed: searchResult.assessment.queryUsed,
    scope: searchResult.assessment.scope,
  });
  const candidateCoverage = buildCoverage(candidateSources);
  assessment.coverage = {
    ...assessment.coverage,
    bases: candidateCoverage.bases,
  };

  if (candidateSources.length > sources.length) {
    assessment.evidenceWarnings = [
      ...assessment.evidenceWarnings,
      "Se excluyeron bases integradas porque son esquemas de implementacion y no fundamento normativo de respuesta.",
    ];
  }

  if (requestedProcessType && sources.length === 0) {
    assessment.evidenceWarnings = [
      ...assessment.evidenceWarnings,
      `La pregunta solicita ${processTypeLabel(
        requestedProcessType,
      )}; no se usaron fuentes de otros procesos ni contratos menores para evitar una respuesta inadecuada.`,
    ];
  }

  const missingSpecificRegulation =
    requestedProcessType &&
    isRequirementsQuestion(input.question) &&
    !hasSpecificProcessRegulationSource(sources, requestedProcessType);

  if (missingSpecificRegulation) {
    // No se rehusa: se responde con lo disponible y se AVISA que los requisitos
    // concretos podrian estar en el Reglamento/directiva no recuperado del todo.
    // La confianza ya refleja la cobertura parcial via assessSources.
    const requirementMessage = procedureCatalog[requestedProcessType]?.requirementRule?.message;
    assessment.evidenceWarnings = [
      ...assessment.evidenceWarnings,
      requirementMessage ??
        `Para requisitos especificos de ${processTypeLabel(
          requestedProcessType,
        )} puede faltar el Reglamento/directiva exacto; lo que sigue se basa en las fuentes recuperadas. Verifica el Reglamento aplicable antes de decidir.`,
    ];
  }

  // Alcance por RELEVANCIA de lo recuperado (no por lista de palabras). La
  // consulta esta dentro del corpus si: coincide vocabulario legal (señal
  // positiva), es un seguimiento de la sesion, el reranker la marca relevante, o
  // hay una señal semantica/lexica fuerte en las fuentes. Si nada de eso aplica
  // (o no hay fuentes), es fuera de tema / sin informacion.
  const topSemantic = sources.reduce((max, source) => Math.max(max, source.semanticScore), 0);
  const topRerank = sources.reduce((max, source) => Math.max(max, source.rerankScore), 0);
  const relevantToCorpus =
    sources.length > 0 &&
    (likelyLegal ||
      Boolean(input.sessionId) ||
      topRerank >= 0.3 ||
      topSemantic >= 0.42 ||
      (topSemantic >= 0.33 && assessment.lexicalScore >= 0.6));

  // Se rehusa cuando no hay fuentes O lo recuperado es claramente irrelevante.
  // Si hay fuentes relevantes (aunque la cobertura no sea perfecta) se responde
  // de forma util con lo que exista, con sus advertencias.
  if (!relevantToCorpus) {
    return {
      status: "final",
      answer:
        "No encontre informacion sobre esto en los documentos indexados (ley, reglamento, directivas y opiniones de contrataciones publicas). Si crees que deberia estar, sube o selecciona el documento aplicable; tambien puedes reformular la pregunta.",
      model: "out-of-scope",
      assessment,
      sources,
      chatFilters,
    };
  }

  const context = buildContext(sources);
  const historyContext = buildHistoryContext(history);

  const generationParams: GenerationParams = {
    input: [
      {
        content:
      "Eres un asistente juridico experto y claro en contrataciones publicas peruanas. Tu objetivo es dar respuestas UTILES, completas y bien explicadas, usando los documentos indexados (ley, reglamento, directivas y opiniones) como tu banco de conocimiento. EXPLICA los conceptos, da contexto, relaciona las fuentes entre si y orienta de forma practica y accionable, como lo haria un buen asesor legal — no te limites a copiar el texto. PERO toda afirmacion juridica sustantiva debe estar respaldada por las Fuentes recuperadas y citarse con [F#]. Reglas de veracidad (criticas en materia legal): no inventes datos especificos (numeros de articulo, montos, UIT, plazos, porcentajes, numeros/nombres de norma) que no aparezcan LITERALMENTE en una Fuente; si un dato puntual no consta, dilo ('no consta en las fuentes'). El marco vigente es la Ley 32069 y su Reglamento (D.S. 009-2025-EF): nunca atribuyas contenido a la Ley 30225, D.S. 344-2018-EF, D.S. 320-2019-EF ni a otro regimen anterior salvo que aparezca literal en una Fuente. Si los documentos recuperados NO contienen NADA relevante para la pregunta, dilo con claridad: 'No encontre informacion sobre esto en los documentos indexados'. Mas vale explicar bien lo que SI consta (y señalar lo que falta) que inventar; un dato inventado es una falla grave.",
        role: "system",
      },
      {
        content: `${buildStyleInstruction(input.tone, input.length)}

Historial reciente de la sesion:
${historyContext}

Pregunta:
${input.question}

Tipo de proceso solicitado:
${requestedProcessType ? processTypeLabel(requestedProcessType) : "No especificado"}

Fuentes recuperadas:
${context}

Cobertura normativa encontrada:
${buildCoverageText(assessment)}

Como responder (util y claro):
- Da una respuesta UTIL y bien explicada segun el tono y la longitud indicados arriba: define conceptos, da contexto, conecta las fuentes y orienta de forma practica. No te limites a copiar el texto de la norma.
- Formato Markdown:
  - Usa **encabezados** (## o **negrita**) para separar las partes de la respuesta.
  - Usa **tablas** cuando compares elementos (requisitos, plazos, opciones, umbrales por tipo); no fuerces tablas si no aplican.
  - **Viñetas breves**: una idea por viñeta, frases cortas.
  - Resalta en **negrita** los terminos o cifras clave.
- Citas: coloca el marcador [F#] AL FINAL de la afirmacion sustantiva que sustenta (no a mitad de frase). Cita cada afirmacion juridica sustantiva (requisito, regla, definicion, obligacion, plazo, conclusion). El texto explicativo/orientacion que se desprende de esas fuentes NO necesita [F#] en cada linea, pero no debe contradecirlas ni introducir datos nuevos. Los [F#] deben corresponder a las fuentes recuperadas y el fragmento debe sustentar la afirmacion.
- Si la pregunta pide un tipo de proceso especifico, no lo reemplaces por otro procedimiento; si las fuentes no lo regulan del todo, explica lo que SI consta y señala que falta.
- Si las fuentes no contienen NADA relevante para la pregunta, dilo: "No encontre informacion sobre esto en los documentos indexados".

Reglas anti-invencion (CRITICAS, materia legal):
- Usa EXCLUSIVAMENTE el texto literal de las Fuentes recuperadas listadas arriba. Prohibido usar conocimiento externo, tu memoria u otras normas no recuperadas.
- El marco aplicable es la Ley 32069 y su Reglamento D.S. 009-2025-EF. NUNCA menciones ni cites la Ley 30225, el D.S. 344-2018-EF, el D.S. 320-2019-EF u otras normas del regimen anterior, salvo que ese texto aparezca literalmente en una Fuente recuperada.
- Datos especificos (montos, UIT, plazos, porcentajes, numeros de articulo, numeros/nombres de norma) SOLO pueden afirmarse si aparecen LITERALMENTE en una Fuente recuperada. Si no constan, escribe "no consta en las fuentes recuperadas" y NO los inventes ni completes desde tu conocimiento.
- NO traslades una cifra (monto/UIT/plazo/porcentaje) de un fragmento que trata de OTRO tema (p. ej. sanciones, notarios, garantias, disputas) al procedimiento consultado. Un umbral solo aplica al procedimiento si el MISMO fragmento habla de ese procedimiento; si ninguna Fuente da el dato para el procedimiento preguntado, di "no consta en las fuentes recuperadas".
- Un marcador [F#] solo es valido si ESE fragmento contiene literalmente el dato que afirmas. Si ninguna fuente lo contiene, no pongas [F#]: lleva esa afirmacion a Limitaciones indicando que no consta.
- No uses frases como "es conocido que", "segun la normativa vigente" o similares para introducir datos que no esten en las Fuentes.
- PROHIBIDO completar una cifra "estandar" o "tipica" de memoria aunque la recuerdes con certeza (p. ej. el tope de adelantos, el % de la garantia de fiel cumplimiento, el tope de penalidades por mora u otras penalidades, o el umbral en UIT para apelar ante el Tribunal). Si el numero exacto (UIT, %, plazo, S/) NO esta literalmente en una Fuente, describe la regla en forma CUALITATIVA sin inventar el valor: di que "existe un tope maximo", que "se exige una garantia" o que "la competencia depende del valor", y agrega en Limitaciones que el monto/porcentaje/plazo exacto no consta en las fuentes recuperadas. Mejor omitir la cifra que arriesgar una incorrecta.
- AUTO-CHEQUEO OBLIGATORIO antes de escribir cualquier porcentaje (%), monto (S/), valor en UIT o plazo: localiza ese token EXACTO dentro del texto de la Fuente [F#] que vas a citar. Si no puedes copiarlo literalmente de ese fragmento, NO lo escribas: omite la cifra y describe la regla en palabras. Esto aplica especialmente a penalidades, garantias, adelantos y umbrales de competencia, donde la tentacion de poner el valor "de memoria" es alta.

Estructura sugerida (adaptala a la pregunta; no es rigida):
- **Respuesta directa**: contesta lo preguntado de forma clara y util, con su sustento [F#].
- **Explicacion / desarrollo**: amplia con contexto, como funciona, condiciones, relacion entre Ley y Reglamento, etc., citando lo sustantivo. Si la Ley solo define o remite al Reglamento, explicalo.
- **En la practica / como aplicarlo**: orientacion accionable derivada de las fuentes (que revisar, pasos, advertencias).
- **Fuentes y vigencia**: documento(s), articulo/pagina; si citas una Opinion, aclara que es criterio interpretativo (no norma obligatoria); si una fuente aparece derogada/modificada, adviertelo.
- Si algo relevante no consta en las fuentes, dilo explicitamente al final (no lo inventes).

No escribas el nivel de confianza; el sistema lo agregara despues con una evaluacion independiente.`,
        role: "user",
      },
    ],
    max_output_tokens: input.length === "concisa" ? 450 : input.length === "media" ? 750 : 1800,
    model: legalAnswerModel,
    temperature: 0.2,
  };

  return { status: "generate", generationParams, assessment, sources, chatFilters };
}

// Verifica fidelidad de citas sobre la respuesta generada y, si algun dato
// especifico citado no consta en su fragmento, añade una advertencia visible en
// la evidencia (el cliente la muestra). Es una red de seguridad anti-misatribucion.
function applyCitationFaithfulnessWarning(
  answer: string,
  sources: LegalSource[],
  assessment: SourceAssessment,
) {
  const faithfulness = checkCitationFaithfulness(answer, sources);
  if (!faithfulness.ok) {
    assessment.evidenceWarnings = [
      ...assessment.evidenceWarnings,
      `Verificacion de citas: ${faithfulness.issues.length} dato(s) citado(s) (${faithfulness.issues
        .map((issue) => issue.datum)
        .slice(0, 3)
        .join(", ")}) no se hallaron en el fragmento citado; confirme en el texto original.`,
    ];
  }
  return faithfulness;
}

export async function answerLegalQuestion(
  input: z.infer<typeof chatRequestSchema>,
  auth: ChatAuthContext,
) {
  const prep = await prepareLegalAnswer(input, auth);

  let answer: string;
  let model: string;

  if (prep.status === "final") {
    answer = prep.answer;
    model = prep.model;
  } else {
    try {
      const openai = getOpenAIClient();
      const response = await openai.responses.create(prep.generationParams);
      answer = applySystemConfidence(response.output_text, prep.assessment.confidence);
      model = legalAnswerModel;
    } catch (error) {
      answer = applySystemConfidence(buildFallbackAnswer(input.question, prep.sources), prep.assessment.confidence);
      model = `fallback-source-extract (${error instanceof Error ? error.message.slice(0, 90) : "OpenAI error"})`;
    }
  }

  applyCitationFaithfulnessWarning(answer, prep.sources, prep.assessment);

  const persisted = await maybePersist(auth, {
    accessToken: auth.accessToken,
    ownerId: auth.ownerId,
    answer,
    assessment: prep.assessment,
    filters: prep.chatFilters,
    mode: input.mode,
    model,
    question: input.question,
    sessionId: input.sessionId,
    sources: prep.sources,
  });

  return {
    answer,
    assessment: prep.assessment,
    confidence: prep.assessment.confidence,
    messageId: persisted.assistantMessageId,
    model,
    sessionId: persisted.sessionId,
    sources: prep.sources,
  };
}

export async function* streamLegalAnswer(
  input: z.infer<typeof chatRequestSchema>,
  auth: ChatAuthContext,
): AsyncGenerator<ChatStreamEvent> {
  let prep: PreparedAnswer;
  try {
    prep = await prepareLegalAnswer(input, auth);
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "No se pudo preparar la respuesta",
    };
    return;
  }

  yield {
    type: "meta",
    sources: prep.sources,
    assessment: prep.assessment,
    confidence: prep.assessment.confidence,
  };

  let answer: string;
  let model: string;

  if (prep.status === "final") {
    answer = prep.answer;
    model = prep.model;
    yield { type: "delta", text: answer };
  } else {
    let acc = "";
    try {
      const openai = getOpenAIClient();
      const stream = await openai.responses.create({ ...prep.generationParams, stream: true });
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          acc += event.delta;
          yield { type: "delta", text: event.delta };
        }
      }
      answer = applySystemConfidence(acc, prep.assessment.confidence);
      model = legalAnswerModel;
    } catch (error) {
      answer = applySystemConfidence(buildFallbackAnswer(input.question, prep.sources), prep.assessment.confidence);
      model = `fallback-source-extract (${error instanceof Error ? error.message.slice(0, 90) : "OpenAI error"})`;
      yield { type: "delta", text: answer };
    }
  }

  const faithfulness = applyCitationFaithfulnessWarning(answer, prep.sources, prep.assessment);

  const persisted = await maybePersist(auth, {
    accessToken: auth.accessToken,
    ownerId: auth.ownerId,
    answer,
    assessment: prep.assessment,
    filters: prep.chatFilters,
    mode: input.mode,
    model,
    question: input.question,
    sessionId: input.sessionId,
    sources: prep.sources,
  });

  yield {
    type: "done",
    sessionId: persisted.sessionId,
    messageId: persisted.assistantMessageId,
    model,
    citationWarnings: faithfulness.ok ? [] : faithfulness.issues.map((issue) => issue.reason),
  };
}
