// Preguntas de vigencia: «¿la Ley 30225 sigue vigente?», «¿qué norma deroga el
// D.S. 344-2018-EF?».
//
// Por qué necesitan su propio camino. La respuesta no está en el articulado de
// la norma preguntada sino en las DISPOSICIONES COMPLEMENTARIAS (derogatoria,
// transitorias, finales) de la norma que la sustituye. Medido en producción: con
// la derogatoria de la Ley 32069 ya indexada, «¿qué norma deroga la Ley 30225?»
// la recuperaba como fuente pero no entraba en la respuesta, por tres motivos:
//  1. la recuperación abierta devuelve los artículos de la propia Ley 30225
//     (hablan de «Ley 30225», no de su derogación), que desplazan a la derogatoria;
//  2. la selección coherente descarta una de las dos familias normativas (30225 o
//     32069) cuando la pregunta no es una comparación de regímenes, y aquí hacen
//     falta las dos: la preguntada y la que la deroga;
//  3. nada le pedía al modelo que respondiera con la disposición derogatoria.
// Este módulo aporta lo que falta en (1) y (3); (2) se arregla haciendo que
// isRegimeComparison (chat-evidence-audit) reconozca estas preguntas.
//
// Módulo puro (sin red ni BD).

export type NormTarget = {
  /** Cómo se nombra en las consultas: «Ley 30225», «Decreto Supremo 344-2018-EF». */
  label: string;
  /** Número tal como aparece en los textos, en minúsculas: «30225», «344-2018-ef». */
  number: string;
};

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Qué se pregunta. «vigencia» y «vigente» sueltos no bastan: «plazo de vigencia
// de la garantía» o «contratos vigentes» no preguntan por la norma.
const VALIDITY_INTENT: RegExp[] = [
  /\b(?:sigue|siguen|continua|continuan|esta|estan|permanece|permanecen|aun|todavia|sera|es)\s+(?:\w+\s+){0,2}(?:vigente|vigentes|en vigor|en pie)\b/,
  /\bvigente\s+(?:la|el|las|los)?\s*(?:ley|decreto|reglamento|norma)\b/,
  /\bvigencia\s+de\s+(?:la|el|las|los)\s+(?:ley|decreto|reglamento|norma)\b/,
  /\bderog\w*/,
  /\babrog\w*/,
  /\b(?:sigue|siguen)\s+(?:rigiendo|aplicandose)\b/,
  /\bya\s+no\s+(?:rige|se\s+aplica|esta\s+vigente)\b/,
  /\bdejo\s+de\s+(?:regir|estar\s+vigente|aplicarse)\b/,
  /\bsin\s+efecto\b/,
  /\b(?:reemplaz|sustituy|sustituid)\w*/,
];

const NORM_REFERENCE =
  /\b(ley|decreto\s+legislativo|decreto\s+supremo|decreto\s+de\s+urgencia|d\.?\s?leg\.?|d\.?\s?s\.?|dleg|d\.?\s?u\.?)\s*(?:n\s*[.°º]*\s*)?(\d{3,6}(?:\s?-\s?\d{4}(?:\s?-\s?[a-z]{2,6}(?:\/\d{1,3}(?:\.\d{1,2})?)?)?)?)/g;

const KIND_LABEL: Array<[RegExp, string]> = [
  [/^ley$/, "Ley"],
  [/^decreto\s+legislativo$|^d\.?\s?leg\.?$|^dleg$/, "Decreto Legislativo"],
  [/^decreto\s+supremo$|^d\.?\s?s\.?$/, "Decreto Supremo"],
  [/^decreto\s+de\s+urgencia$|^d\.?\s?u\.?$/, "Decreto de Urgencia"],
];

// Nombres con los que se conoce a las normas del corpus cuando la pregunta no
// trae el número. Solo las dos leyes y sus reglamentos: el resto se pregunta por
// número.
const NORM_ALIASES: Array<[RegExp, NormTarget]> = [
  [/reglamento\s+de\s+la\s+ley\s+general\s+de\s+contrataciones\s+publicas/, { label: "Decreto Supremo 009-2025-EF", number: "009-2025-ef" }],
  [/reglamento\s+de\s+la\s+ley\s+de\s+contrataciones\s+del\s+estado/, { label: "Decreto Supremo 344-2018-EF", number: "344-2018-ef" }],
  [/ley\s+general\s+de\s+contrataciones\s+publicas/, { label: "Ley 32069", number: "32069" }],
  [/ley\s+de\s+contrataciones\s+del\s+estado/, { label: "Ley 30225", number: "30225" }],
];

function normTargets(text: string): NormTarget[] {
  const targets = new Map<string, NormTarget>();
  NORM_REFERENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NORM_REFERENCE.exec(text)) !== null) {
    const kind = KIND_LABEL.find(([pattern]) => pattern.test(match![1].trim()))?.[1];
    if (!kind) continue;
    const number = match[2].replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
    targets.set(number, { label: `${kind} ${number.toUpperCase()}`, number });
  }
  if (targets.size === 0) {
    for (const [pattern, target] of NORM_ALIASES) {
      if (pattern.test(text)) targets.set(target.number, target);
    }
  }
  return [...targets.values()];
}

/**
 * Las normas por cuya vigencia o derogación se pregunta, o null si la pregunta
 * no es de ese tipo. Hacen falta las dos cosas —la intención y una norma
 * concreta—: «¿qué plazo de vigencia tiene la garantía?» no es de vigencia de
 * una norma.
 */
export function detectValidityTarget(question: string): { norms: NormTarget[] } | null {
  const text = plain(question);
  if (!VALIDITY_INTENT.some((pattern) => pattern.test(text))) return null;
  const norms = normTargets(text);
  return norms.length > 0 ? { norms: norms.slice(0, 2) } : null;
}

/**
 * Consultas dirigidas a donde está la respuesta: la derogatoria que nombra la
 * norma, y las transitorias/finales que dicen qué sigue aplicándose de ella. La
 * etiqueta «Disposiciones Complementarias Derogatorias» repite el encabezado que
 * lleva cada fragmento al indexarse, que es lo que el embedding reconoce.
 */
export function validityRetrievalQueries(norms: NormTarget[]): string[] {
  const [target] = norms;
  if (!target) return [];
  return [
    `Disposiciones Complementarias Derogatorias: derógase ${target.label} y las normas que la modifican`,
    `Disposiciones Complementarias Transitorias y Finales: ${target.label} continúa vigente y se aplica a los procedimientos en trámite y contratos suscritos`,
  ];
}

type EvidenceCandidate = {
  article?: string | null;
  chunkId: string;
  documentNumber?: string | null;
  documentType: string;
  excerpt: string;
};

const DISPOSITION = /^DC([FTMD])-\d+$/;
// Qué disposición responde mejor a «¿sigue vigente?»: la derogatoria, luego las
// transitorias (qué se sigue aplicando), luego las finales y las modificatorias.
const DISPOSITION_ORDER: Record<string, number> = { D: 0, T: 1, F: 2, M: 3 };
const TYPE_ORDER: Record<string, number> = { ley: 0, decreto_legislativo: 1, reglamento: 2 };

function mentionsNorm(excerpt: string, target: NormTarget): boolean {
  return plain(excerpt).replace(/\s*-\s*/g, "-").includes(target.number);
}

/**
 * De lo recuperado, las disposiciones complementarias (derogatorias,
 * transitorias, finales, modificatorias) que NOMBRAN a la norma preguntada, en el
 * orden en que responden a la pregunta. Una disposición que no la menciona no
 * dice nada de su vigencia, así que no entra aunque sea una derogatoria.
 */
export function pickValidityEvidence<T extends EvidenceCandidate>(candidates: T[], norms: NormTarget[], max = 4): T[] {
  const seen = new Set<string>();
  return candidates
    .filter((source) => {
      const kind = DISPOSITION.exec(source.article ?? "")?.[1];
      return kind !== undefined && norms.some((target) => mentionsNorm(source.excerpt, target));
    })
    .filter((source) => {
      // Las copias oficial y SPIJ de una misma norma traen la misma disposición.
      const key = `${source.documentType}|${source.article}|${(source.documentNumber ?? "").replace(/\D/g, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const kindA = DISPOSITION_ORDER[DISPOSITION.exec(a.article ?? "")![1]];
      const kindB = DISPOSITION_ORDER[DISPOSITION.exec(b.article ?? "")![1]];
      return kindA - kindB || (TYPE_ORDER[a.documentType] ?? 9) - (TYPE_ORDER[b.documentType] ?? 9);
    })
    .slice(0, max);
}

/** Instrucción para el generador cuando hay disposiciones que sustentan la respuesta. */
export function validityInstruction(norms: NormTarget[]): string {
  const labels = norms.map((norm) => norm.label).join(" y ");
  return (
    `La pregunta es sobre la vigencia o derogación de ${labels}. Responde con lo que dicen las disposiciones complementarias derogatorias, transitorias y finales recuperadas: qué norma la deroga, a partir de cuándo y con qué excepciones, y qué ` +
    "queda regulado por la norma anterior durante la transición. Nombra cada disposición con su etiqueta (p. ej. «Disposición Complementaria Derogatoria Única») y cítala con [F#]. " +
    "No afirmes que una norma sigue vigente por el solo hecho de que su texto exista en el corpus ni por la fecha de su entrada en vigencia; si ninguna fuente recuperada trata su derogación, dilo. "
  );
}
