import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { type LegalSource, searchLegalSources } from "./legal-chat";
import { assessProcedureSourceCoverage } from "./procedure-catalog";

export type ClauseCheck = {
  key: string;
  label: string;
  evidence?: string;
  presente: boolean;
  nota: string;
};

export type AnalysisFinding = {
  category: "incumplimiento" | "riesgo" | "recomendacion" | "revision_humana";
  message: string;
  severity: "alto" | "medio" | "bajo";
  sources: number[];
};

export type CriticalSourceCheck = {
  code: string;
  label: string;
  ok: boolean;
  missing: string | null;
};

export type LegalAnalysis = {
  resumen: string;
  confidence: "alta" | "media" | "baja";
  confidenceReason: string;
  clausulas: ClauseCheck[];
  riesgos: string[];
  recomendaciones: string[];
  findings: AnalysisFinding[];
  checklist: Array<{ done: boolean; label: string; note: string }>;
  criticalSources: CriticalSourceCheck[];
  coverage: Record<"bases" | "directiva" | "ley" | "opinion" | "reglamento", boolean>;
  normasAplicables: Array<{ documentTitle: string; documentType: string; citation: string }>;
  sources: LegalSource[];
  model: string;
};

// Clausulas obligatorias del articulo 60 de la Ley 32069.
const mandatoryClauses: Array<{ key: string; label: string; patterns: string[] }> = [
  { key: "garantias", label: "Garantías", patterns: ["garantia", "carta fianza", "fiel cumplimiento", "retencion", "fideicomiso"] },
  {
    key: "anticorrupcion",
    label: "Cláusula anticorrupción y antisoborno",
    patterns: ["anticorrupcion", "antisoborno", "soborno", "corrupcion"],
  },
  {
    key: "controversias",
    label: "Solución de controversias",
    patterns: ["solucion de controversias", "arbitraje", "conciliacion", "junta de resolucion", "controversia"],
  },
  {
    key: "resolucion",
    label: "Resolución de contrato por incumplimiento",
    patterns: ["resolucion del contrato", "resolucion por incumplimiento", "incumplimiento"],
  },
  {
    key: "riesgos",
    label: "Gestión de riesgos",
    patterns: ["gestion de riesgos", "asignacion de riesgos", "matriz de riesgos", "gestion del riesgo"],
  },
];

const documentKindLabels: Record<string, string> = {
  bases: "bases",
  bases_integradas: "bases integradas",
  contrato: "contrato",
  directiva: "directiva",
  expediente: "expediente",
  informe: "informe",
  requerimiento: "requerimiento",
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return {};
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSourceContext(sources: LegalSource[]) {
  return sources
    .map(
      (source, index) =>
        `[F${index + 1}] ${source.documentTitle} (${source.documentType}) - ${source.citation}\n${source.excerpt.slice(0, 700)}`,
    )
    .join("\n\n");
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function hasNegationNear(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 80), index);
  return /\b(no|sin|excepto|no se exige|no corresponde|no aplica|queda prohibid[ao])\b/i.test(before);
}

function findPositiveEvidence(normalizedText: string, patterns: string[]) {
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern);
    const index = normalizedText.indexOf(normalizedPattern);
    if (index >= 0 && !hasNegationNear(normalizedText, index)) {
      return pattern;
    }
  }
  return null;
}

function buildCriticalSources(processType?: string | null, sources: LegalSource[] = []): CriticalSourceCheck[] {
  const coverage = assessProcedureSourceCoverage(processType, sources);
  return coverage.results
    .filter((item) => item.critical || !item.optional)
    .map((item) => ({
      code: `${processType || "general"}-${item.documentType}-${item.article ?? item.label}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toUpperCase(),
      label: item.label,
      missing: item.ok ? null : item.message,
      ok: item.ok,
    }));
}

function buildCoverage(sources: LegalSource[]): LegalAnalysis["coverage"] {
  return {
    bases: sources.some((source) => source.documentType === "bases_integradas"),
    directiva: sources.some((source) => source.documentType === "directiva"),
    ley: sources.some((source) => source.documentType === "ley"),
    opinion: sources.some((source) => source.documentType === "opinion"),
    reglamento: sources.some((source) => source.documentType === "reglamento"),
  };
}

function calculateConfidence(params: {
  criticalSources: CriticalSourceCheck[];
  documentKind?: string;
  sources: LegalSource[];
}) {
  const normativeSources = params.sources.filter((source) => ["ley", "reglamento", "directiva", "opinion"].includes(source.documentType));
  const exactSources = normativeSources.filter((source) => source.article && source.pageStart);
  const currentSources = normativeSources.filter((source) => source.vigencia !== "derogado");
  const criticalOk = params.criticalSources.every((item) => item.ok);
  const averageQuality =
    normativeSources.reduce((sum, source) => sum + (source.evidenceQuality || source.score || 0), 0) /
    Math.max(normativeSources.length, 1);

  if (criticalOk && exactSources.length >= 2 && currentSources.length >= 2 && averageQuality >= 0.45) {
    return {
      confidence: "alta" as const,
      reason: "Hay fuentes normativas vigentes, con articulo/pagina y fuentes criticas suficientes.",
    };
  }
  if (criticalOk && exactSources.length >= 1 && normativeSources.length >= 1) {
    return {
      confidence: "media" as const,
      reason: "Hay sustento normativo minimo, pero conviene revisar cobertura, vigencia o evidencia adicional.",
    };
  }
  return {
    confidence: "baja" as const,
    reason: "No se recuperaron fuentes criticas suficientes con articulo/pagina verificable.",
  };
}

function buildChecklist(documentKind: string | undefined, processType: string | undefined, clauses: ClauseCheck[], criticalSources: CriticalSourceCheck[]) {
  const kind = documentKind ?? "otros";
  const common = [
    {
      done: criticalSources.every((item) => item.ok),
      label: "Fuentes criticas recuperadas",
      note: criticalSources.every((item) => item.ok) ? "Cuenta con sustento minimo." : "Revisar documentos faltantes del corpus.",
    },
  ];

  if (kind === "contrato") {
    return [
      ...common,
      ...clauses.map((clause) => ({
        done: clause.presente,
        label: clause.label,
        note: clause.nota,
      })),
    ];
  }
  if (["bases", "bases_integradas"].includes(kind)) {
    return [
      ...common,
      { done: Boolean(processType), label: "Procedimiento identificado", note: processType ? "Permite aplicar reglas especificas." : "Selecciona tipo de proceso." },
      { done: true, label: "Bases tratadas como esquema", note: "No se usan como fundamento normativo principal." },
    ];
  }
  if (kind === "requerimiento") {
    return [
      ...common,
      { done: Boolean(processType), label: "Proceso vinculado", note: "Necesario para validar requisitos del objeto." },
      { done: true, label: "Revision de sustento", note: "Contrastar especificaciones/TDR contra norma aplicable." },
    ];
  }
  return [
    ...common,
    { done: Boolean(documentKind), label: "Tipo de documento", note: documentKind ? `Analisis para ${documentKindLabels[documentKind] ?? documentKind}.` : "Selecciona tipo de documento." },
  ];
}

function parseFindings(value: unknown): AnalysisFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const category = record.category;
      const severity = record.severity;
      const sources = Array.isArray(record.sources)
        ? record.sources.filter((source): source is number => typeof source === "number")
        : [];
      if (
        !["incumplimiento", "riesgo", "recomendacion", "revision_humana"].includes(String(category)) ||
        !["alto", "medio", "bajo"].includes(String(severity)) ||
        typeof record.message !== "string"
      ) {
        return null;
      }
      return {
        category: category as AnalysisFinding["category"],
        message: record.message,
        severity: severity as AnalysisFinding["severity"],
        sources,
      };
    })
    .filter((item): item is AnalysisFinding => Boolean(item));
}

export async function analyzeLegalDocument(input: {
  documentKind?: string;
  processType?: string;
  text: string;
  title?: string;
  documentType?: string;
}): Promise<LegalAnalysis> {
  const normalizedText = normalize(input.text);

  // Presencia de clausulas obligatorias (deterministica).
  const shouldCheckContractClauses = (input.documentKind ?? input.documentType) === "contrato";
  const clausulas: ClauseCheck[] = shouldCheckContractClauses
    ? mandatoryClauses.map((clause) => {
        const evidence = findPositiveEvidence(normalizedText, clause.patterns);
        return {
          evidence: evidence ?? undefined,
          key: clause.key,
          label: clause.label,
          presente: Boolean(evidence),
          nota: "",
        };
      })
    : [];

  // Normas aplicables del corpus.
  const query = [
    input.title,
    input.documentKind ? `Tipo de documento: ${documentKindLabels[input.documentKind] ?? input.documentKind}` : "",
    input.processType ? `Tipo de proceso: ${input.processType}` : "",
    input.text.slice(0, 1800),
  ]
    .filter(Boolean)
    .join(". ");
  const { sources } = await searchLegalSources({
    filters: {
      processType: input.processType && input.processType !== "todos" ? input.processType : undefined,
    },
    query,
    topK: 10,
  });
  const criticalSources = buildCriticalSources(input.processType, sources);
  const coverage = buildCoverage(sources);

  const normasAplicables = sources.slice(0, 6).map((source) => ({
    documentTitle: source.documentTitle,
    documentType: source.documentType,
    citation: source.citation,
  }));

  const clauseList = clausulas
    .map((clause) => `${clause.label}: ${clause.presente ? "detectada" : "NO detectada"}`)
    .join("\n");

  let resumen = "";
  let riesgos: string[] = [];
  let recomendaciones: string[] = [];
  let findings: AnalysisFinding[] = [];
  let model = legalAnswerModel;
  const calculatedConfidence = calculateConfidence({
    criticalSources,
    documentKind: input.documentKind,
    sources,
  });

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres un asistente juridico de contrataciones publicas peruanas. Analizas un documento contra la normativa proporcionada. Separa incumplimientos, riesgos, recomendaciones y puntos de revision humana. Fundamenta con fuentes [F#]. No inventes normas. Las bases son apoyo operativo, no fundamento legal. Devuelve solo JSON valido.",
          role: "system",
        },
        {
          content: `Documento a analizar (titulo: ${input.title ?? "sin titulo"}; tipo documental de trabajo: ${input.documentKind ?? input.documentType ?? "desconocido"}; proceso: ${input.processType ?? "sin dato"}):
${input.text.slice(0, 12000)}

Clausulas obligatorias del articulo 60 detectadas por busqueda positiva de texto:
${shouldCheckContractClauses ? clauseList : "No aplica: el documento no fue marcado como contrato."}

Fuentes criticas requeridas:
${criticalSources.map((item) => `${item.label}: ${item.ok ? "ok" : item.missing}`).join("\n")}

Normas recuperadas del corpus:
${buildSourceContext(sources)}

Devuelve JSON con esta forma exacta:
{
  "resumen": "3-6 lineas sobre que es el documento y su estado frente a la normativa, con marcadores [F#]",
  "confidence": "alta|media|baja",
  "clauseNotes": { "garantias": "nota breve", "anticorrupcion": "...", "controversias": "...", "resolucion": "...", "riesgos": "..." },
  "riesgos": ["riesgo con [F#] si aplica"],
  "recomendaciones": ["recomendacion accionable con [F#] si aplica"],
  "findings": [
    { "category": "incumplimiento|riesgo|recomendacion|revision_humana", "severity": "alto|medio|bajo", "message": "hallazgo con [F#]", "sources": [1] }
  ]
}
Para clauseNotes, solo aplica si el documento es contrato. Si faltan fuentes criticas, indicalo como revision_humana o riesgo, no inventes el requisito.`,
          role: "user",
        },
      ],
      max_output_tokens: 1400,
      model: legalAnswerModel,
      temperature: 0.2,
    });

    const parsed = parseJsonObject(response.output_text);
    resumen = typeof parsed.resumen === "string" ? parsed.resumen : "";
    riesgos = stringArray(parsed.riesgos);
    recomendaciones = stringArray(parsed.recomendaciones);
    findings = parseFindings(parsed.findings);

    const clauseNotes = (parsed.clauseNotes ?? {}) as Record<string, unknown>;
    for (const clause of clausulas) {
      const note = clauseNotes[clause.key];
      clause.nota =
        typeof note === "string" && note.trim()
          ? note.trim()
          : clause.presente
            ? "Detectada en el documento."
            : "No se detecto; el articulo 60 la exige como clausula obligatoria.";
    }
  } catch (error) {
    model = `fallback-analysis (${error instanceof Error ? error.message.slice(0, 80) : "OpenAI error"})`;
    resumen =
      "No se pudo generar el analisis con IA en este momento. Se muestran las normas recuperadas y la deteccion automatica de clausulas obligatorias.";
    for (const clause of clausulas) {
      clause.nota = clause.presente
        ? "Detectada en el documento."
        : "No se detecto; el articulo 60 la exige como clausula obligatoria.";
    }
  }
  const checklist = buildChecklist(input.documentKind ?? input.documentType, input.processType, clausulas, criticalSources);

  return {
    resumen,
    confidence: calculatedConfidence.confidence,
    confidenceReason: calculatedConfidence.reason,
    clausulas,
    checklist,
    coverage,
    criticalSources,
    findings,
    riesgos,
    recomendaciones,
    normasAplicables,
    sources,
    model,
  };
}
