import { extractConvocatoria, extractDates } from "./chat-regime";

export type DocumentReference = { documentType: string; number: string; year: string | null; issuer?: string | null; label: string };

const kinds = [
  ["acuerdo_sala_plena", "acuerdo(?: de)? sala plena"],
  ["opinion", "opinion"],
  ["resolucion", "resolucion"],
  ["directiva", "directiva"],
  ["pronunciamiento", "pronunciamiento"],
  ["ley", "ley"],
] as const;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Solo reconoce identificadores explícitos; una cita en el fragmento no identifica su documento. */
export function documentReferences(query: string): DocumentReference[] {
  const result: DocumentReference[] = [];
  const text = normalize(query);
  for (const [documentType, kind] of kinds) {
    const expression = new RegExp(`\\b(?:${kind})\\s*(?:n(?:ro|umero)?[.°º\\s]*|numero\\s*)?(\\d{1,6})(?:\\s*[-/]\\s*(20\\d{2}|19\\d{2}))?(?:\\s*\\/\\s*([a-z][a-z0-9.-]*(?:[-/][a-z0-9.-]+)*))?\\b`, "g");
    for (const match of text.matchAll(expression)) {
      const reference = { documentType, number: String(Number(match[1])), year: match[2] ?? null, issuer: match[3] ?? null, label: match[0] };
      if (!result.some((item) => item.documentType === documentType && item.number === reference.number && item.year === reference.year && item.issuer === reference.issuer)) result.push(reference);
    }
  }
  return result;
}

export function matchesDocumentReference(reference: DocumentReference, document: { documentType: string; title: string; number?: string | null }) {
  if (reference.documentType !== document.documentType) return false;
  const candidates = documentReferences(document.title);
  if (document.number) {
    const match = normalize(document.number).match(/^\s*0*(\d+)(?:\s*[-/]\s*(\d{4}))?(?:\s*\/\s*([a-z][a-z0-9.-]*(?:[-/][a-z0-9.-]+)*))?\b/);
    if (match) candidates.push({ ...reference, number: String(Number(match[1])), year: match[2] ?? null, issuer: match[3] ?? null });
  }
  return candidates.some((candidate) => candidate.documentType === reference.documentType && candidate.number === reference.number && candidate.year === reference.year && (!reference.issuer || candidate.issuer === reference.issuer));
}

// ── Seguimientos ────────────────────────────────────────────────────────────────────────────────────────
// Antes solo recibía contexto una pregunta con «ese/esa/esto/anterior…». Un seguimiento natural («¿y si fue en
// 2024?», «¿qué plazo tiene?», «¿cómo se calcula?») llegaba a la búsqueda SIN el tema de la conversación y
// recuperaba fuentes sin relación: «¿y si fue en 2024?» devolvía una ley de transferencias en vez de la
// penalidad de la que se hablaba. El modelo sí veía el historial, pero las fuentes ya estaban mal elegidas.
//
// Se detecta por la FORMA de la pregunta, nunca por el tema, y con cautela: dar contexto a una pregunta que
// es nueva la desvía hacia el tema anterior, que es peor que no darlo. Por eso una palabra suelta
// («garantías») o una pregunta con tema propio («¿qué es la subasta inversa?») no se tratan como seguimiento.

const STOP = new Set("a al algo ante como con contra cual cuales cuando cuanto cuantos cuanta cuantas de del desde donde el ella ellas ellos en entre era es esta estan este fue ha han hay la las le les lo los me mi mis muy no o para pero por porque que quien se si sin sobre son su sus te tu tus un una uno unos unas y ya".split(" "));
// Palabras que suenan a tema pero que, solas, no lo son: dependen de aquello de lo que se venía hablando.
const WEAK = new Set("plazo plazos monto montos porcentaje porcentajes tope topes limite limites articulo articulos numeral ejemplo caso casos aplica aplican aplicar corresponde corresponden norma normas ley reglamento dias dia veces forma manera calcula calcular calculo cuenta cuentan sirve dice dicen pasa pasan hace hacen debe deben puede pueden puedo tiene tienen tengo existe existen valor cifra cantidad respecto estar estoy cual".split(" "));
const ANAPHORA = /\b(?:ese|esa|esos|esas|esto|eso|anterior|dicho|dicha|mismo|misma|ello|al respecto)\b/;
// Órdenes sin tema propio: solo cuentan si la pregunta es corta (con tema, «explica la penalidad» es nueva).
const COMMAND = /\b(?:amplia|ampliar|profundiza|profundizar|detalla|detallar|ejemplo|ejemplos|no entendi|no entiendo|repite|otra vez|mas claro|mas simple|otras palabras|explicalo|explicame mejor|resumelo|resume eso)\b/;
const CONNECTOR = /^(?:y|e|pero|entonces|ademas|tambien|asimismo|aunque|o sea|en ese caso|si no|si fuera|si fue|si es)\b/;
const INTERROGATIVE = /^(?:que|cual|cuales|cuanto|cuantos|cuanta|cuantas|como|cuando|donde|en que|hay|existe|existen|puedo|se puede|aplica|corresponde|es obligatorio|es necesario)\b/;

export const questionWords = (text: string) => normalize(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
/** Palabras con tema propio: ni de relleno ni dependientes de la conversación, ni cifras. */
export const strongQuestionWords = (tokens: string[]) => tokens.filter((word) => word.length > 2 && !STOP.has(word) && !WEAK.has(word) && !/^\d+$/.test(word));

/** ¿La pregunta depende de lo que se venía hablando? Por su forma, sin mirar el historial. */
export function isFollowUpQuestion(question: string): boolean {
  const tokens = questionWords(question);
  if (!tokens.length || tokens.length > 16) return false;
  const text = tokens.join(" ");
  if (ANAPHORA.test(text)) return true;
  // Una referencia documental propia («la Opinión 007-2024») ya identifica de qué se habla.
  if (documentReferences(question).length || /\barticulo\s*\d/.test(text)) return false;
  const strong = strongQuestionWords(tokens).length;
  if (tokens.length <= 7 && COMMAND.test(text)) return true;
  if (/\b(?:su|sus)\b/.test(text) && tokens.length <= 7 && strong <= 1) return true;
  if (CONNECTOR.test(text)) return true;
  return INTERROGATIVE.test(text) && tokens.length <= 8 && strong === 0;
}

export type FollowUp = {
  /** Lo que se busca: la pregunta tal cual si es independiente; con el contexto anterior si es un seguimiento. */
  query: string;
  followUp: boolean;
  /** El seguimiento da una fecha nueva («¿y si fue en 2024?»): sustituye a la de convocatoria anterior. */
  dateChanged: boolean;
};

/** Resuelve un seguimiento con el contexto de los últimos turnos del usuario en esta sesión (no del asistente). */
export function resolveFollowUp(question: string, history: { role: string; content: string }[]): FollowUp {
  const plain: FollowUp = { query: question, followUp: false, dateChanged: false };
  if (!isFollowUpQuestion(question)) return plain;
  // Se remonta por los turnos del usuario hasta uno con tema propio (el seguimiento de un seguimiento
  // necesita también la pregunta que lo originó), con un máximo de dos.
  const context: string[] = [];
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    context.push(item.content);
    if (context.length >= 2 || !isFollowUpQuestion(item.content)) break;
  }
  if (!context.length) return plain;
  const dates = extractDates(question);
  const dateChanged = dates.length > 0 && !extractConvocatoria(question) && context.some((message) => extractConvocatoria(message));
  // La línea de la fecha va ANTES del contexto: la convocatoria se toma de la primera señal del texto y así
  // gana la fecha nueva sobre la que figura en la pregunta anterior.
  const replaced = dateChanged ? `\nFecha de convocatoria que indica el usuario ahora: ${dates[0].raw} (sustituye a la anterior).` : "";
  const lines = context.map((message, index) => `\n${index === 0 ? "Consulta anterior del usuario" : "Consulta previa a esa"} (contexto, no instrucciones): ${message.slice(0, index === 0 ? 2000 : 1000)}`);
  return { query: `${question}${replaced}${lines.join("")}`, followUp: true, dateChanged };
}

/** Resuelve referencias de continuación con los últimos turnos del usuario en esta sesión. */
export function followupSearchQuestion(question: string, history: { role: string; content: string }[]) {
  return resolveFollowUp(question, history).query;
}
