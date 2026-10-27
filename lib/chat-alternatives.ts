import { z } from "zod";
/** Question structure only. This module contains no legal answers or rules. */
export type AlternativeQuestion = { stem: string; options: Array<{ key: string; text: string }> };
const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[*_]/g, "").replace(/\s+/g, " ").trim();

export function parseAlternatives(question: string): AlternativeQuestion | null {
  const matches = [...question.matchAll(/(?:^|[\s:;])([a-hA-H])[).]\s+(?=\S)/g)];
  if (matches.length < 2 || matches.length > 8) return null;
  const options = matches.map((match, index) => ({ key: match[1].toLowerCase(), text: question.slice(match.index! + match[0].length, matches[index + 1]?.index ?? question.length).trim() }));
  if (options.some((option, index) => option.key !== String.fromCharCode(97 + index) || option.text.length < 3 || option.text.length > 800)) return null;
  const stem = question.slice(0, matches[0].index).trim();
  return stem.length >= 8 ? { stem, options } : null;
}

export function alternativeQueries(question: AlternativeQuestion) {
  return [question.stem, ...question.options.map(option => `${question.stem}\n${option.text}`)];
}

export function alternativeInstruction(question: AlternativeQuestion) {
  return `Pregunta con alternativas. Evalúa todas las opciones respecto del ENUNCIADO, incluidas negaciones como NO, EXCEPTO o incorrecta. No confundas una propuesta con la decisión final ni una fase con otra. Que un distractor aparezca en otra disposición no lo convierte en respuesta. No inventes exclusividad: si hay varias opciones respaldadas o falta evidencia, dilo sin elegir una. Identifica una única opción solo si se sostiene con las fuentes; explica las otras opciones solo cuando haya respaldo. No cambies el texto de las opciones. Datos de la pregunta: ${JSON.stringify(question)}`;
}

const structuredChoice = z.object({
  choice: z.string().nullable(),
  options: z.array(z.object({key:z.string(),status:z.enum(["answers","does_not_answer","insufficient"]),reason:z.string().max(1500)})).max(8),
  evidence: z.array(z.object({source:z.number().int().positive(),quote:z.string().max(3000).optional()})).max(3),
  reason:z.string().max(1500),
});
export function renderAlternativeDraft(raw:string, question:AlternativeQuestion, sources:Array<{excerpt:string}>) {
  const parsed=structuredChoice.safeParse((()=>{try{return JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));}catch{return null;}})());
  if(!parsed.success) return "No se pudo interpretar la evaluación de alternativas.";
  const result=parsed.data, option=question.options.find(item=>item.key===result.choice);
  const evaluations=result.options;
  const exactKeys=evaluations.length===question.options.length&&question.options.every(item=>evaluations.filter(row=>row.key===item.key).length===1);
  const winners=evaluations.filter(row=>row.status==="answers");
  const normalizeQuote=(s:string)=>s.replace(/\s+/g," ").trim();
  const validEvidence=result.evidence.length>0&&result.evidence.every(item=>sources[item.source-1]&&(!item.quote || normalizeQuote(sources[item.source-1].excerpt).includes(normalizeQuote(item.quote))));
  if(!option||!exactKeys||winners.length!==1||winners[0].key!==option.key||!validEvidence)return "No se confirmó una única alternativa con evidencia literal comprobable.";
  const citations=result.evidence.map(item=>`[F${item.source}]`).join(" ");
  return `Alternativa correcta: ${option.key}) ${option.text} ${citations}\n${result.reason.replace(/\[F\d+\]/gi, "")} ${citations}\n${result.evidence.map(item=>item.quote ? `«${item.quote}» [F${item.source}]` : "").join("\n")}`;
}

export function checkedAlternative(text: string, question: AlternativeQuestion) {
  const cleaned = plain(text);
  const match = cleaned.match(/^alternativa correcta:\s*([a-h])[).]\s*(.+)/);
  if (!match) return null;
  const option = question.options.find(item => item.key === match[1]);
  if (!option) return null;
  const answerText = match[2].replace(/\[f\d+\]/g, "").replace(/[.;:\s]+$/, "").trim();
  return answerText === plain(option.text).replace(/[.;:\s]+$/, "") ? option : null;
}

/** Prefer passages whose own heading addresses the stem, not the option vocabulary. */
export function prioritizeAlternativeSources<T extends { excerpt: string }>(sources: T[], question: AlternativeQuestion) {
  const stop = new Set(["responde", "pregunta", "preguntas", "alternativa", "correcta", "incorrecta", "elemento", "elementos", "contener", "debe", "cual", "siguiente", "siguientes", "acuerdo", "segun", "esta", "estas", "dime"]);
  const terms = [...new Set(plain(question.stem).match(/[a-z]{5,}/g) ?? [])].filter(term => !stop.has(term));
  const score = (source: T) => {
    const text = plain(source.excerpt);
    const heading = text.match(/^articulo\s+\d+[a-z]*[.:]?\s*([^.]*?)(?=\s+\d+\.\d+|\.(?:\s|$)|$)/)?.[1] ?? text.split(/[.\n]/)[0].slice(0,180);
    return terms.filter(term => new RegExp(`\\b${term}\\b`).test(heading)).length;
  };
  return sources.map((source, index) => ({ source, index, score: score(source) })).sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.source);
}
