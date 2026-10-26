import { z } from "zod";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { type ChatAuthContext, type LegalSource, type SourceAssessment, searchLegalSources } from "./legal-chat";
import { documentTypeLabel, processTypeLabel } from "./legal-taxonomy";
import { supabaseUserRest, writeAuditLog } from "./supabase-server";

// Jerarquia normativa: la prevalencia NO la decide el modelo, se calcula aqui y
// se le entrega como dato (ley > reglamento > directiva > opinion).
const normativePriority: Record<string, number> = {
  ley: 4,
  reglamento: 3,
  directiva: 2,
  opinion: 1,
  bases_integradas: 0,
};

const comparisonSideSchema = z.object({
  label: z.string().trim().max(120).optional().or(z.literal("")),
  documentType: z.string().trim().optional().or(z.literal("")),
  documentId: z.string().trim().optional().or(z.literal("")),
  processType: z.string().trim().optional().or(z.literal("")),
});

export const compareRequestSchema = z.object({
  topic: z.string().min(5),
  sideA: comparisonSideSchema,
  sideB: comparisonSideSchema,
  mode: z.enum(["tema", "articulo", "texto"]).default("tema"),
});

type ComparisonSide = z.infer<typeof comparisonSideSchema>;
type Confidence = SourceAssessment["confidence"];

const confidenceOrder: Record<Confidence, number> = { baja: 0, media: 1, alta: 2 };

function sideFilters(side: ComparisonSide) {
  return {
    documentId: side.documentId?.trim() || "",
    documentType: side.documentType?.trim() || "",
    processType: side.processType?.trim() || "",
  };
}

function describeScope(side: ComparisonSide) {
  const parts = [
    side.documentType ? documentTypeLabel(side.documentType) : null,
    side.processType ? processTypeLabel(side.processType) : null,
    side.documentId ? "documento especifico" : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Toda la biblioteca";
}

function sameScope(a: ReturnType<typeof sideFilters>, b: ReturnType<typeof sideFilters>) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function topRank(sources: LegalSource[]) {
  return sources.reduce((max, source) => Math.max(max, normativePriority[source.documentType] ?? 0), 0);
}

function isNotCurrent(source: LegalSource) {
  const text = `${source.status ?? ""} ${source.vigencia ?? ""}`.toLowerCase();
  return text.includes("derogad") || text.includes("modificad");
}

function buildHierarchyNote(labelA: string, labelB: string, sourcesA: LegalSource[], sourcesB: LegalSource[]) {
  const rankA = topRank(sourcesA);
  const rankB = topRank(sourcesB);

  if (rankA === 0 && rankB === 0) {
    return "No se pudo determinar la jerarquia normativa de las fuentes recuperadas.";
  }

  if (rankA === rankB) {
    return `Ambos lados tienen el mismo nivel jerarquico (${labelA} y ${labelB}); ante conflicto debe primar la norma posterior o mas especifica.`;
  }

  const higher = rankA > rankB ? labelA : labelB;
  return `Ante conflicto prevalece ${higher}, por su mayor jerarquia normativa (ley > reglamento > directiva > opinion). Una opinion es criterio interpretativo no vinculante.`;
}

function buildVigenciaNote(sourcesA: LegalSource[], sourcesB: LegalSource[]) {
  const flagged = [...sourcesA, ...sourcesB].filter(isNotCurrent);

  if (flagged.length === 0) {
    return "No se detectaron fuentes marcadas como derogadas o modificadas; aun asi, verifica la vigencia antes de usar la comparacion.";
  }

  return `Atencion: hay fuentes marcadas como derogadas o modificadas (${flagged
    .map((source) => source.citation)
    .slice(0, 4)
    .join("; ")}); revisa la version vigente antes de concluir.`;
}

function buildSideContext(sources: LegalSource[], prefix: "A" | "B") {
  if (sources.length === 0) {
    return "Sin fuentes recuperadas para este lado.";
  }

  return sources
    .map(
      (source, index) => `[${prefix}${index + 1}]
Documento: ${source.documentTitle}
Tipo: ${source.documentType}
Ubicacion: ${source.citation}
Vigencia: ${source.vigencia ?? "no registrada"}
Fragmento: ${source.excerpt}`,
    )
    .join("\n\n");
}

function combineConfidence(a: SourceAssessment, b: SourceAssessment): Confidence {
  if (a.sufficient !== b.sufficient) {
    return "baja";
  }

  return confidenceOrder[a.confidence] <= confidenceOrder[b.confidence] ? a.confidence : b.confidence;
}

function applyConfidence(text: string, confidence: Confidence) {
  const cleaned = text
    .replace(/(?:^|\n)\s*Nivel de confianza\s*:\s*(alta|media|baja)\s*\.?\s*$/gim, "")
    .trim();

  return `${cleaned}\n\nNivel de confianza: ${confidence}`;
}

function buildNotComparableAnswer(labelA: string, labelB: string, topic: string) {
  return `**Resumen comparativo**
No es posible comparar ${labelA} con ${labelB} sobre "${topic}" con sustento suficiente: no se recuperaron fuentes trazables en al menos uno de los lados.

**Limitaciones**
- Sube o selecciona normativa aplicable en ambos lados (ley, reglamento, directiva u opinion) y vuelve a intentar.

Nivel de confianza: baja`;
}

function buildFallbackComparison(input: {
  labelA: string;
  labelB: string;
  sourcesA: LegalSource[];
  sourcesB: LegalSource[];
}) {
  const lineA = input.sourcesA[0]?.excerpt.slice(0, 400) ?? "Sin fragmento recuperado.";
  const lineB = input.sourcesB[0]?.excerpt.slice(0, 400) ?? "Sin fragmento recuperado.";

  return `**Resumen comparativo**
No se pudo generar la redaccion con IA, pero se recuperaron fuentes en ambos lados.

**Diferencias**
- ${input.labelA}: ${lineA} [A1]
- ${input.labelB}: ${lineB} [B1]

**Limitaciones**
- Revisa los fragmentos recuperados manualmente; la comparacion automatica no se completo.

Nivel de confianza: baja`;
}

async function persistComparison(input: {
  accessToken: string;
  assessmentA: SourceAssessment;
  assessmentB: SourceAssessment;
  filtersA: ReturnType<typeof sideFilters>;
  filtersB: ReturnType<typeof sideFilters>;
  model: string;
  overall: Confidence;
  ownerId: string;
  result: string;
  sourcesA: LegalSource[];
  sourcesB: LegalSource[];
  topic: string;
}) {
  try {
    // Comparacion privada por dueno: se escribe con el JWT del usuario (RLS).
    const [row] = await supabaseUserRest<Array<{ id: string }>>(input.accessToken, "normative_comparisons", {
      body: JSON.stringify({
        assessment: { a: input.assessmentA, b: input.assessmentB, overall: input.overall },
        model: input.model,
        owner_id: input.ownerId,
        result: input.result,
        side_a: input.filtersA,
        side_b: input.filtersB,
        sources_a: input.sourcesA,
        sources_b: input.sourcesB,
        topic: input.topic,
      }),
      method: "POST",
    });

    return row?.id ?? null;
  } catch {
    // La persistencia no debe romper la respuesta al usuario.
    return null;
  }
}

export async function compareNorms(input: z.infer<typeof compareRequestSchema>, auth: ChatAuthContext) {
  const filtersA = sideFilters(input.sideA);
  const filtersB = sideFilters(input.sideB);

  if (sameScope(filtersA, filtersB)) {
    throw new Error("Los dos lados de la comparacion deben tener alcances distintos.");
  }

  const labelA = input.sideA.label?.trim() || describeScope(input.sideA);
  const labelB = input.sideB.label?.trim() || describeScope(input.sideB);

  const [resultA, resultB] = await Promise.all([
    searchLegalSources({ filters: filtersA, query: input.topic, topK: 8 }),
    searchLegalSources({ filters: filtersB, query: input.topic, topK: 8 }),
  ]);

  const sourcesA = resultA.sources;
  const sourcesB = resultB.sources;
  const overall = combineConfidence(resultA.assessment, resultB.assessment);

  if (!resultA.assessment.sufficient && !resultB.assessment.sufficient) {
    const result = buildNotComparableAnswer(labelA, labelB, input.topic);
    const model = "compare-insufficiency-gate";
    const comparisonId = await persistComparison({
      accessToken: auth.accessToken,
      ownerId: auth.ownerId,
      assessmentA: resultA.assessment,
      assessmentB: resultB.assessment,
      filtersA,
      filtersB,
      model,
      overall: "baja",
      result,
      sourcesA,
      sourcesB,
      topic: input.topic,
    });

    await writeAuditLog({
      action: "compare.run",
      details: { gate: "insufficient", labelA, labelB, topic: input.topic },
      entityType: "comparison",
    });

    return { assessment: { a: resultA.assessment, b: resultB.assessment, overall: "baja" }, comparisonId, labelA, labelB, model, result, sourcesA, sourcesB };
  }

  const hierarchyNote = buildHierarchyNote(labelA, labelB, sourcesA, sourcesB);
  const vigenciaNote = buildVigenciaNote(sourcesA, sourcesB);
  const articleHint =
    input.mode === "articulo"
      ? "La comparacion debe alinearse articulo por articulo cuando ambos lados regulen el mismo articulo o numeral."
      : "";

  let result = "";
  let model = legalAnswerModel;

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content:
            "Eres un jurista especializado en contrataciones publicas peruanas. Comparas dos cuerpos normativos SOLO con base en las fuentes proporcionadas (Lado A y Lado B). No inventes normas, articulos ni documentos. Respeta la jerarquia normativa que se te entrega. Si una fuente esta derogada o modificada, advierte sobre su vigencia.",
          role: "system",
        },
        {
          content: `Tema a comparar:
${input.topic}

Lado A (${labelA}):
${buildSideContext(sourcesA, "A")}

Lado B (${labelB}):
${buildSideContext(sourcesB, "B")}

Jerarquia normativa (dato, no la decidas tu):
${hierarchyNote}

Nota de vigencia:
${vigenciaNote}

${articleHint}

Formato obligatorio (Markdown simple):
- Cada afirmacion sustantiva termina con marcadores de fuente del lado correspondiente: [A1], [B2], etc.
- No escribas afirmaciones sin marcador; si no hay fuente, ponlo en Limitaciones.
- Los marcadores deben corresponder exactamente a las fuentes listadas arriba.

Estructura:
**Resumen comparativo**
(1-2 lineas)

**Coincidencias**
- Punto en comun... [A1][B1]

**Diferencias**
- Aspecto — ${labelA}: ... [A1]; ${labelB}: ... [B1]

**Prevalencia / jerarquia**
- Que norma prima ante conflicto y por que. [A#][B#]

**Alcance practico**
- Como impacta en la practica.

**Riesgos de interpretacion y vigencia**
- Advertencias relevantes. [A# o B# si aplica]

**Limitaciones**
- Que no se pudo comparar por falta de fuente en algun lado.

No escribas el nivel de confianza; el sistema lo agrega despues.`,
          role: "user",
        },
      ],
      max_output_tokens: 1500,
      model: legalAnswerModel,
      temperature: 0.2,
    });

    result = applyConfidence(response.output_text, overall);
  } catch (error) {
    result = applyConfidence(buildFallbackComparison({ labelA, labelB, sourcesA, sourcesB }), overall);
    model = `fallback-compare (${error instanceof Error ? error.message.slice(0, 80) : "OpenAI error"})`;
  }

  const comparisonId = await persistComparison({
    accessToken: auth.accessToken,
    ownerId: auth.ownerId,
    assessmentA: resultA.assessment,
    assessmentB: resultB.assessment,
    filtersA,
    filtersB,
    model,
    overall,
    result,
    sourcesA,
    sourcesB,
    topic: input.topic,
  });

  await writeAuditLog({
    action: "compare.run",
    details: {
      confidence: overall,
      labelA,
      labelB,
      sourceCountA: sourcesA.length,
      sourceCountB: sourcesB.length,
      topic: input.topic,
    },
    entityType: "comparison",
  });

  return { assessment: { a: resultA.assessment, b: resultB.assessment, overall }, comparisonId, labelA, labelB, model, result, sourcesA, sourcesB };
}
