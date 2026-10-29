// Controles de «grounding» de las respuestas evaluadas: cita de normas derogadas, términos vetados por la
// pregunta y marcadores [F#] fuera de rango. Módulo puro (sin red ni BD), compartido por el evaluador con base
// de datos (legal-eval.ts) y por el banco de regresión de archivo (scripts/evaluar-chat-oro.mts).
//
// Antes, CUALQUIER mención de la Ley 30225 o su reglamento contaba como «alucinación grave» y ponía la
// puntuación a cero. Eso era correcto cuando el chat nunca debía salir del régimen vigente, pero ya no lo es:
// un procedimiento convocado antes del 22-04-2025 se rige por la Ley 30225, y las preguntas de comparación o de
// vigencia exigen nombrarla. Con la regla antigua, la respuesta correcta a «convoqué en 2024» habría suspendido.

import { isRegimeComparison, isTemporalApplicabilityQuestion, questionRegimeIntent } from "./chat-regime";

// Normas del régimen anterior: en una pregunta común, citarlas es traer la norma equivocada.
export const derogatedNormPatterns = ["30225", "344-2018", "320-2019", "350-2015", "ley de contrataciones del estado"];

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** ¿La pregunta trata justamente del régimen anterior (convocatoria previa a la vigencia, comparación, vigencia)? */
export function allowsPreviousRegime(question: string): boolean {
  const intent = questionRegimeIntent(question);
  return intent.regime === "30225" || intent.regime === "ambos" || isRegimeComparison(question) || isTemporalApplicabilityQuestion(question);
}

/**
 * Fallas de grounding de una respuesta. Citar el régimen anterior solo es falla si la pregunta no trata de él Y
 * ninguna fuente recuperada lo menciona: «el Reglamento 009-2025-EF deroga el D.S. 344-2018-EF» es correcto y está
 * en la Disposición Derogatoria, y la regla antigua lo trataba como alucinación. Los términos que la propia
 * pregunta veta y las citas [F#] inexistentes fallan siempre.
 */
export function detectGroundingViolations(answer: string, sourcesCount: number, mustNotContain: string[], question?: string, sourceTexts: string[] = []): string[] {
  const haystack = normalize(answer);
  const violations: string[] = [];

  if (!question || !allowsPreviousRegime(question)) {
    const grounded = sourceTexts.map(normalize);
    for (const pattern of derogatedNormPatterns) {
      if (haystack.includes(normalize(pattern)) && !grounded.some((text) => text.includes(normalize(pattern)))) violations.push(`Cita norma derogada/ajena al corpus: "${pattern}".`);
    }
  }

  for (const term of mustNotContain) {
    if (term.trim() && haystack.includes(normalize(term))) violations.push(`Contiene termino vetado: "${term}".`);
  }

  const citationNumbers = [...answer.matchAll(/\[F(\d+)\]/g)].map((match) => Number(match[1]));
  const outOfRange = Array.from(new Set(citationNumbers.filter((number) => number < 1 || number > sourcesCount)));
  if (outOfRange.length > 0) violations.push(`Citas [F#] fuera de rango (inexistentes): ${outOfRange.map((n) => `F${n}`).join(", ")}.`);

  return violations;
}
