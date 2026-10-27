// Coherencia entre lo que el sistema SABE de una respuesta y lo que le dice al
// usuario.
//
// Caso que lo motivó (medido en producción): para «¿qué porcentaje del monto
// debe tener la garantía de fiel cumplimiento?» el sistema generó internamente
// «Faltan fuentes criticas: Reglamento vigente» —y de hecho el 10 % está en el
// Reglamento, que no se recuperó—, pero la tarjeta decía «Requiere
// verificación», el detalle «Fuentes suficientes… coincidencia literal 89 %» y
// la advertencia quedaba en un panel plegado. Y una consulta de vigencia sobre
// la Ley 30225, respondida «no se pudo determinar», salió con confianza «alta».
// Quien lee solo la etiqueta no distingue una respuesta fallida de una buena.
//
// Módulo puro (sin red ni BD): lo usan el servidor, para fijar la confianza
// real, y la interfaz, para decidir qué advertencias mostrar a la vista.

export type SignalConfidence = "alta" | "media" | "baja";

export type SignalAssessment = {
  confidence: SignalConfidence;
  reason: string;
  evidenceWarnings: string[];
};

type SourceValidity = { vigencia?: string | null; documentNumber?: string | null; article?: string | null; excerpt?: string };

// El texto de assessSources va sin tildes («criticas»): se admiten ambas grafías.
const MISSING_CRITICAL = /^Faltan fuentes cr[ií]ticas/i;

// «vigente», «vigencia», «derogada»… precedidas o no de un verbo: basta con que
// la pregunta gire en torno a si una norma sigue en pie.
const VALIDITY_QUESTION = /\b(vigente|vigentes|vigencia|derogad[oa]s?|derogaci[oó]n|en vigor|dej[oó] de regir)\b/i;

export function hasMissingCritical(warnings: string[]): boolean {
  return warnings.some((warning) => MISSING_CRITICAL.test(warning));
}

export function isValidityQuestion(question: string): boolean {
  return VALIDITY_QUESTION.test(question);
}

/** Números de norma que cita la pregunta («Ley 30225», «D.S. 009-2025-EF»). */
function citedNumbers(question: string): string[] {
  return question.match(/\d{3,6}(?:-\d{4})?/g) ?? [];
}

/**
 * ¿Alguna fuente declara de forma firme que LA NORMA PREGUNTADA está vigente o
 * derogada? Si la pregunta cita un número, solo cuenta una fuente de esa norma:
 * el Reglamento marcado «vigente» no confirma la vigencia de la Ley 30225
 * (medido: hacía pasar «¿sigue vigente la Ley 30225?» con confianza alta).
 * Sin número en la pregunta, basta cualquier fuente que lo declare.
 */
export function hasConfirmedValidity(sources: SourceValidity[], question = ""): boolean {
  const numbers = citedNumbers(question);
  return sources.some((source) => {
    // Una disposición derogatoria o transitoria que NOMBRA la norma preguntada
    // declara su suerte con su propio texto, aunque el registro del documento
    // diga «desconocida» (así están las copias SPIJ de la Ley 32069).
    if (
      /^DC[DT]-\d+$/.test(source.article ?? "") &&
      numbers.some((number) => (source.excerpt ?? "").replace(/\s*-\s*/g, "-").includes(number))
    ) {
      return true;
    }
    const value = (source.vigencia ?? "").toLowerCase();
    if (!(value === "vigente" || value.startsWith("derogad"))) return false;
    if (numbers.length === 0) return true;
    const own = source.documentNumber ?? "";
    return numbers.some((number) => own.includes(number));
  });
}

const VALIDITY_WARNING =
  "La vigencia no se puede confirmar con las fuentes recuperadas: el registro la marca como desconocida o no la declara.";

/**
 * Ajusta la evaluación para que la confianza refleje lo que falta:
 *  - faltan fuentes críticas → confianza «baja» y un motivo que lo diga;
 *  - pregunta de vigencia sin ninguna fuente que la declare → «baja» + aviso.
 * Nunca SUBE la confianza ni toca `sufficient`: solo corrige hacia abajo.
 */
export function reconcileAssessment<T extends SignalAssessment>(
  assessment: T,
  context: { question: string; sources: SourceValidity[] },
): T {
  const next: T = { ...assessment, evidenceWarnings: [...assessment.evidenceWarnings] };

  const missing = next.evidenceWarnings.filter((warning) => MISSING_CRITICAL.test(warning));
  if (missing.length > 0) {
    next.confidence = "baja";
    next.reason = `Fuentes parciales: ${missing.join(" ")} La respuesta puede omitir datos que sí constan en esas normas.`;
  }

  if (isValidityQuestion(context.question) && !hasConfirmedValidity(context.sources, context.question)) {
    next.confidence = "baja";
    if (!next.evidenceWarnings.includes(VALIDITY_WARNING)) next.evidenceWarnings.push(VALIDITY_WARNING);
  }

  return next;
}

// Advertencias que cambian cómo debe usarse la respuesta; el resto
// («similitud semántica no es fuerte», «se excluyeron bases integradas»…) es
// detalle de ingeniería y se queda en el panel plegable.
const MATERIAL_WARNING =
  /^(Faltan fuentes|Recuperaci[oó]n parcial|Existen fuentes marcadas|La vigencia no se puede|No se recuper[oó] el original|No se pudo completar|Solo se recuperaron bases)/i;

export function materialWarnings(warnings: string[] | undefined, max = 3): string[] {
  return (warnings ?? []).filter((warning) => MATERIAL_WARNING.test(warning)).slice(0, max);
}
