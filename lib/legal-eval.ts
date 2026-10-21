import { answerLegalQuestion } from "@/lib/legal-chat";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";
import { procedureEntries, procedureSourceRequirements } from "@/lib/procedure-catalog";
import { supabaseUserRest } from "@/lib/supabase-server";

// Evaluacion continua del RAG (Fase 4): corre un set de preguntas curadas contra el
// pipeline real de respuesta del chat y mide cobertura de keywords, suficiencia de
// fuentes y confianza. No persiste el intercambio en el historial (persist:false).

export type EvalQuestion = {
  id: string;
  question: string;
  expected_keywords: string[];
  expected_must_not_contain: string[];
  expected_sources: ExpectedSource[];
  document_type: string | null;
  process_type: string | null;
  created_at: string;
};

// Normas del regimen DEROGADO: si aparecen en una respuesta (y no estan en el
// corpus 32069), es una alucinacion grave. Se chequea en TODA respuesta evaluada.
const derogatedNormPatterns = [
  "30225",
  "344-2018",
  "320-2019",
  "350-2015",
  "ley de contrataciones del estado",
];

// Detecta fallas de grounding (criticas en materia legal): cita de normas
// derogadas, terminos vetados por la pregunta, y marcadores [F#] fuera del rango
// de fuentes recuperadas (cita inventada). Devuelve la lista de violaciones.
function detectGroundingViolations(
  answer: string,
  sourcesCount: number,
  mustNotContain: string[],
): string[] {
  const haystack = normalize(answer);
  const violations: string[] = [];

  for (const pattern of derogatedNormPatterns) {
    if (haystack.includes(normalize(pattern))) {
      violations.push(`Cita norma derogada/ajena al corpus: "${pattern}".`);
    }
  }

  for (const term of mustNotContain) {
    if (term.trim() && haystack.includes(normalize(term))) {
      violations.push(`Contiene termino vetado: "${term}".`);
    }
  }

  const citationNumbers = [...answer.matchAll(/\[F(\d+)\]/g)].map((match) => Number(match[1]));
  const outOfRange = Array.from(
    new Set(citationNumbers.filter((number) => number < 1 || number > sourcesCount)),
  );
  if (outOfRange.length > 0) {
    violations.push(`Citas [F#] fuera de rango (inexistentes): ${outOfRange.map((n) => `F${n}`).join(", ")}.`);
  }

  return violations;
}

export type EvalResult = {
  id: string;
  corrida_id: string;
  pregunta_id: string | null;
  question: string | null;
  confidence: string | null;
  sufficient: boolean | null;
  sources_count: number | null;
  keyword_hit: number | null;
  source_hit: number | null;
  score: number | null;
  feedback: string | null;
  source_feedback: Record<string, unknown> | null;
  created_at: string;
};

export type EvalRun = {
  id: string;
  run_at: string;
  summary: EvalRunSummary;
};

export type FeedbackExample = {
  id: string;
  answer: string | null;
  created_at: string;
  expected_sources: ExpectedSource[];
  feedback: "correct" | "incorrect";
  question: string;
  recovered_sources: Array<Record<string, unknown>>;
};

export type EvalRunSummary = {
  total: number;
  avgScore: number;
  sufficientCount: number;
  avgKeywordHit: number | null;
  avgSourceHit?: number | null;
  confidence: { alta: number; media: number; baja: number };
};

export type ExpectedSource = {
  article?: string;
  documentType?: string;
  processType?: string;
  titleIncludes?: string;
};

export const baselineEvalQuestions: Array<{
  documentType?: string;
  expectedKeywords: string[];
  expectedMustNotContain?: string[];
  expectedSources: ExpectedSource[];
  processType?: string;
  question: string;
}> = [
  {
    expectedKeywords: ["comparacion de precios", "reglamento", "precio"],
    expectedSources: [
      {
        documentType: "reglamento",
        processType: "comparacion_precios",
        titleIncludes: "reglamento",
      },
    ],
    processType: "comparacion_precios",
    question: "Cuales son los requisitos para una compra por comparacion de precios?",
  },
  {
    expectedKeywords: ["subasta inversa electronica", "ficha tecnica", "directiva"],
    expectedSources: [
      { documentType: "reglamento", processType: "subasta_inversa_electronica" },
      { documentType: "directiva", processType: "subasta_inversa_electronica" },
    ],
    processType: "subasta_inversa_electronica",
    question: "Como revisar si estan bien hechas las especificaciones tecnicas de subasta inversa electronica?",
  },
  {
    documentType: "opinion",
    expectedKeywords: ["opinion", "no es norma obligatoria", "criterio"],
    expectedSources: [{ documentType: "opinion" }],
    question: "Que valor tiene una opinion del OECE frente a la Ley y el Reglamento?",
  },
  // Preguntas trampa anti-alucinacion: el corpus NO trae un monto en UIT para
  // comparacion de precios; la respuesta correcta es "no consta", no inventar
  // cifras ni citar el regimen derogado.
  {
    expectedKeywords: ["no consta"],
    expectedMustNotContain: ["8 uit", "ley 30225", "30225", "320-2019", "344-2018"],
    expectedSources: [],
    processType: "comparacion_precios",
    question: "Cual es el monto maximo exacto en UIT para usar comparacion de precios?",
  },
  {
    expectedKeywords: ["32069"],
    expectedMustNotContain: ["30225", "320-2019", "344-2018"],
    expectedSources: [{ documentType: "ley" }],
    question: "Que ley regula las contrataciones publicas y cual es su reglamento vigente?",
  },

  // --- Cobertura ampliada de temas del corpus ---
  {
    expectedKeywords: ["garantia"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que tipos de garantias contractuales existen en las contrataciones publicas?",
  },
  {
    expectedKeywords: ["garantia", "fiel cumplimiento"],
    expectedSources: [{ documentType: "ley" }],
    question: "Para que sirve la garantia de fiel cumplimiento?",
  },
  {
    expectedKeywords: ["expediente"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que es el expediente de contratacion y que debe contener?",
  },
  {
    expectedKeywords: ["oece"],
    expectedSources: [{ documentType: "ley" }],
    question: "Cuales son las funciones del OECE?",
  },
  {
    expectedKeywords: ["tribunal"],
    expectedSources: [{ documentType: "ley" }],
    question: "Que funciones tiene el Tribunal de Contrataciones Publicas?",
  },
  {
    expectedKeywords: ["impedimento"],
    expectedSources: [{ documentType: "ley" }],
    question: "Quienes estan impedidos de ser participantes o contratistas del Estado?",
  },
  {
    expectedKeywords: ["apelacion"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Como funciona el recurso de apelacion contra el otorgamiento de la buena pro?",
  },
  {
    expectedKeywords: ["sancion"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que sanciones existen para un postor que presenta documentos falsos?",
  },
  {
    expectedKeywords: ["consorcio"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que reglas aplican cuando los proveedores se presentan en consorcio?",
  },
  {
    expectedKeywords: ["adelanto"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Estan permitidos los adelantos al contratista y como se garantizan?",
  },
  {
    expectedKeywords: ["penalidad"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que penalidades se pueden aplicar al contratista por incumplimiento?",
  },
  // Variantes coloquiales (lenguaje normal, sin jerga): deben responderse igual.
  {
    expectedKeywords: ["apelacion"],
    expectedSources: [{ documentType: "reglamento" }],
    question: "Que hago si no estoy de acuerdo con quien gano una licitacion?",
  },
  {
    expectedKeywords: ["licitacion publica"],
    // El detalle operativo (cuando corresponde, umbrales, reglas) se recupera del
    // reglamento en este corpus; la tipologia general esta en la ley pero el
    // contenido indexado que responde la consulta es reglamentario.
    expectedSources: [{ documentType: "reglamento" }],
    question: "Cuando se debe usar una licitacion publica?",
  },
];

export const matrixEvalQuestions = procedureEntries
  .filter((entry) => entry.value !== "otros")
  .flatMap((entry) => {
    const required = procedureSourceRequirements(entry.value).filter(
      (requirement) => requirement.critical || !requirement.optional,
    );
    return [
      {
        expectedKeywords: [
          entry.label.toLowerCase(),
          ...required
            .map((requirement) => requirement.article ? `articulo ${requirement.article}` : requirement.documentType)
            .slice(0, 4),
        ],
        expectedMustNotContain: ["30225", "344-2018", "320-2019"] as string[],
        expectedSources: required.map((requirement) => ({
          article: requirement.article,
          documentType: requirement.documentType,
          processType: entry.value,
          titleIncludes: requirement.titleIncludes?.[0],
        })),
        documentType: undefined,
        processType: entry.value,
        question: `Que fuentes normativas debo revisar para validar ${entry.label}?`,
      },
    ];
  });

const confidenceWeight: Record<string, number> = { alta: 1, media: 0.6, baja: 0.2 };

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function keywordHitRatio(answer: string, keywords: string[]) {
  if (keywords.length === 0) {
    return { ratio: null as number | null, missing: [] as string[] };
  }
  const haystack = normalize(answer);
  const missing = keywords.filter((keyword) => !haystack.includes(normalize(keyword)));
  return { ratio: (keywords.length - missing.length) / keywords.length, missing };
}

function scoreOf(input: {
  sufficient: boolean;
  confidence: string;
  keywordHit: number | null;
  sourceHit: number | null;
}) {
  const confW = confidenceWeight[input.confidence] ?? 0.2;
  const sufW = input.sufficient ? 1 : 0;
  const raw =
    input.keywordHit === null
      ? input.sourceHit === null
        ? 0.6 * sufW + 0.4 * confW
        : 0.35 * sufW + 0.25 * confW + 0.4 * input.sourceHit
      : input.sourceHit === null
        ? 0.4 * sufW + 0.25 * confW + 0.35 * input.keywordHit
        : 0.25 * sufW + 0.2 * confW + 0.25 * input.keywordHit + 0.3 * input.sourceHit;
  return Math.round(raw * 1000) / 1000;
}

type RunRow = {
  pregunta_id: string;
  question: string;
  confidence: string;
  sufficient: boolean;
  sources_count: number;
  keyword_hit: number | null;
  source_hit: number | null;
  score: number;
  source_feedback: Record<string, unknown>;
  feedback: string;
};

function normalizeOptional(value?: string | null) {
  return normalize(value ?? "").trim();
}

function sourceMatchesExpected(
  source: Awaited<ReturnType<typeof answerLegalQuestion>>["sources"][number],
  expected: ExpectedSource,
) {
  const expectedArticle = normalizeOptional(expected.article);
  const article = normalizeOptional(source.article);
  const title = normalizeOptional(source.documentTitle);

  if (expected.documentType && source.documentType !== expected.documentType) {
    return false;
  }

  if (expected.processType && source.processType !== expected.processType && source.processType !== "todos") {
    return false;
  }

  if (expectedArticle && !article.includes(expectedArticle)) {
    return false;
  }

  if (expected.titleIncludes && !title.includes(normalizeOptional(expected.titleIncludes))) {
    return false;
  }

  return true;
}

function expectedSourceHitRatio(
  sources: Awaited<ReturnType<typeof answerLegalQuestion>>["sources"],
  expectedSources: ExpectedSource[],
) {
  if (expectedSources.length === 0) {
    return {
      details: [] as Array<ExpectedSource & { found: boolean }>,
      missing: [] as ExpectedSource[],
      ratio: null as number | null,
    };
  }

  const details = expectedSources.map((expected) => ({
    ...expected,
    found: sources.some((source) => sourceMatchesExpected(source, expected)),
  }));
  const missing = details.filter((item) => !item.found).map(({ found: _found, ...item }) => item);

  return {
    details,
    missing,
    ratio: (details.length - missing.length) / details.length,
  };
}

// Corre todas las preguntas del banco y persiste una corrida + sus resultados.
// Devuelve la corrida creada con su resumen y las filas de resultado.
export async function runEvaluation(accessToken: string) {
  const preguntas = await supabaseUserRest<EvalQuestion[]>(
    accessToken,
    "eval_preguntas?select=id,question,expected_keywords,expected_must_not_contain,expected_sources,document_type,process_type,created_at&order=created_at.asc",
  );

  if (preguntas.length === 0) {
    throw new Error("No hay preguntas de evaluacion. Agrega al menos una.");
  }

  const rows: RunRow[] = [];
  // Secuencial para no saturar OpenAI/Pinecone con N respuestas en paralelo.
  for (const pregunta of preguntas) {
    try {
      const result = await answerLegalQuestion(
        {
          filters: {
            documentType: pregunta.document_type ?? "",
            processType: pregunta.process_type ?? "",
          },
          mode: "tecnica",
          tone: "formal",
          length: "detallada",
          question: pregunta.question,
        },
        { accessToken, ownerId: "eval", persist: false },
      );
      const { ratio, missing } = keywordHitRatio(result.answer, pregunta.expected_keywords ?? []);
      const sourceCheck = expectedSourceHitRatio(result.sources, pregunta.expected_sources ?? []);
      const confidence = result.assessment.confidence;
      const sufficient = result.assessment.sufficient;
      const feedbackParts: string[] = [];
      if (!sufficient) {
        feedbackParts.push(result.assessment.reason || "Fuentes insuficientes.");
      }
      if (missing.length > 0) {
        feedbackParts.push(`Faltan terminos esperados: ${missing.join(", ")}.`);
      }
      if (sourceCheck.missing.length > 0) {
        feedbackParts.push(
          `No recupero fuentes esperadas: ${sourceCheck.missing
            .map((source) =>
              [source.documentType, source.article ? `art. ${source.article}` : null, source.titleIncludes]
                .filter(Boolean)
                .join(" "),
            )
            .join("; ")}.`,
        );
      }
      // Grounding: en materia legal una alucinacion (norma derogada, dato vetado,
      // cita inexistente) es una falla critica -> score 0 aunque lo demas pase.
      const groundingViolations = detectGroundingViolations(
        result.answer,
        result.sources.length,
        pregunta.expected_must_not_contain ?? [],
      );
      // Fidelidad de cita: datos especificos citados deben constar en el fragmento.
      const faithfulness = checkCitationFaithfulness(result.answer, result.sources);
      if (!faithfulness.ok) {
        groundingViolations.push(...faithfulness.issues.map((issue) => `Cita infiel: ${issue.reason}`));
      }
      if (groundingViolations.length > 0) {
        feedbackParts.unshift(`FALLA DE GROUNDING: ${groundingViolations.join(" ")}`);
      }
      const baseScore = scoreOf({ confidence, keywordHit: ratio, sourceHit: sourceCheck.ratio, sufficient });
      rows.push({
        confidence,
        feedback: feedbackParts.join(" ") || "Respuesta correcta y con cobertura esperada.",
        keyword_hit: ratio,
        pregunta_id: pregunta.id,
        question: pregunta.question,
        score: groundingViolations.length > 0 ? 0 : baseScore,
        source_feedback: { expected: sourceCheck.details, groundingViolations },
        source_hit: sourceCheck.ratio,
        sources_count: result.sources.length,
        sufficient,
      });
    } catch (error) {
      rows.push({
        confidence: "baja",
        feedback: error instanceof Error ? error.message : "Error al responder.",
        keyword_hit: null,
        pregunta_id: pregunta.id,
        question: pregunta.question,
        score: 0,
        source_feedback: { error: error instanceof Error ? error.message : "Error al responder." },
        source_hit: null,
        sources_count: 0,
        sufficient: false,
      });
    }
  }

  const keywordRatios = rows.map((row) => row.keyword_hit).filter((value): value is number => value !== null);
  const sourceRatios = rows.map((row) => row.source_hit).filter((value): value is number => value !== null);
  const summary: EvalRunSummary = {
    avgKeywordHit: keywordRatios.length
      ? Math.round((keywordRatios.reduce((sum, value) => sum + value, 0) / keywordRatios.length) * 1000) / 1000
      : null,
    avgScore: Math.round((rows.reduce((sum, row) => sum + row.score, 0) / rows.length) * 1000) / 1000,
    avgSourceHit: sourceRatios.length
      ? Math.round((sourceRatios.reduce((sum, value) => sum + value, 0) / sourceRatios.length) * 1000) / 1000
      : null,
    confidence: {
      alta: rows.filter((row) => row.confidence === "alta").length,
      baja: rows.filter((row) => row.confidence === "baja").length,
      media: rows.filter((row) => row.confidence === "media").length,
    },
    sufficientCount: rows.filter((row) => row.sufficient).length,
    total: rows.length,
  };

  const [corrida] = await supabaseUserRest<EvalRun[]>(accessToken, "eval_corridas", {
    body: JSON.stringify({ summary }),
    method: "POST",
  });

  await supabaseUserRest(accessToken, "eval_resultados", {
    body: JSON.stringify(rows.map((row) => ({ ...row, corrida_id: corrida.id }))),
    method: "POST",
  });

  return { corrida, results: rows };
}

// Carga el banco de preguntas, las ultimas corridas y los resultados de la mas reciente.
export async function getEvaluationOverview(accessToken: string) {
  const [preguntas, corridas, feedbackExamples] = await Promise.all([
    supabaseUserRest<EvalQuestion[]>(
      accessToken,
      "eval_preguntas?select=id,question,expected_keywords,expected_must_not_contain,expected_sources,document_type,process_type,created_at&order=created_at.asc",
    ),
    supabaseUserRest<EvalRun[]>(
      accessToken,
      "eval_corridas?select=id,run_at,summary&order=run_at.desc&limit=10",
    ),
    supabaseUserRest<FeedbackExample[]>(
      accessToken,
      "ai_feedback_examples?select=id,question,answer,feedback,expected_sources,recovered_sources,created_at&order=created_at.desc&limit=25",
    ).catch(() => []),
  ]);

  const latest = corridas[0];
  const lastResults = latest
    ? await supabaseUserRest<EvalResult[]>(
        accessToken,
        `eval_resultados?corrida_id=eq.${latest.id}&select=id,corrida_id,pregunta_id,question,confidence,sufficient,sources_count,keyword_hit,source_hit,score,feedback,source_feedback,created_at&order=score.asc`,
      )
    : [];

  return { corridas, feedbackExamples, lastResults, preguntas };
}

export async function seedBaselineEvalQuestions(accessToken: string) {
  const existing = await supabaseUserRest<Array<{ question: string }>>(
    accessToken,
    "eval_preguntas?select=question&limit=200",
  );
  const existingQuestions = new Set(existing.map((item) => normalize(item.question)));
  const rows = [...baselineEvalQuestions, ...matrixEvalQuestions]
    .filter((item) => !existingQuestions.has(normalize(item.question)))
    .map((item) => ({
      document_type: item.documentType ?? null,
      expected_keywords: item.expectedKeywords,
      expected_must_not_contain: item.expectedMustNotContain ?? [],
      expected_sources: item.expectedSources,
      process_type: item.processType ?? null,
      question: item.question,
    }));

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  await supabaseUserRest(accessToken, "eval_preguntas", {
    body: JSON.stringify(rows),
    method: "POST",
  });

  return { inserted: rows.length };
}
