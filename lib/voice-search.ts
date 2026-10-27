import { documentSearchRequestSchema, type DocumentSearchFilters } from "./document-search";
import { fallbackProposal, type AssistantProposal } from "./search-assistant";

export const VOICE_MAX_MS = 45_000;
export const VOICE_MAX_BYTES = 3 * 1024 * 1024;
export const VOICE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const units: Record<string, number> = Object.fromEntries("cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve".split(" ").map((word, i) => [word, i]));
const tens: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const hundreds: Record<string, number> = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
const numberWords = [...Object.keys(units), ...Object.keys(tens), ...Object.keys(hundreds), "mil", "y"].join("|");

export function spanishNumber(text: string): number | null {
  const words = fold(text).trim().split(/\s+/);
  const under100 = (tokens: string[]): number | null => {
    if (tokens.length === 1) return units[tokens[0]] ?? tens[tokens[0]] ?? null;
    return tokens.length === 3 && tens[tokens[0]] && tokens[1] === "y" && units[tokens[2]] > 0 && units[tokens[2]] < 10 ? tens[tokens[0]] + units[tokens[2]] : null;
  };
  const under1000 = (tokens: string[]): number | null => {
    if (!tokens.length) return 0;
    if (hundreds[tokens[0]]) {
      if (tokens[0] === "ciento" && tokens.length === 1) return null;
      if (tokens[0] === "cien" && tokens.length > 1) return null;
      const rest = tokens.length === 1 ? 0 : under100(tokens.slice(1));
      return rest === null ? null : hundreds[tokens[0]] + rest;
    }
    return under100(tokens);
  };
  const mil = words.indexOf("mil");
  if (mil < 0) return under1000(words);
  if (words.lastIndexOf("mil") !== mil) return null;
  const prefix = mil === 0 ? 1 : under1000(words.slice(0, mil));
  const suffix = under1000(words.slice(mil + 1));
  return prefix === null || prefix === 0 || suffix === null ? null : prefix * 1000 + suffix;
}

/** Interpretation only. The original transcript is always retained separately. */
export function reviewVoiceText(original: string) {
  const warnings: string[] = [];
  const doubtful = new RegExp(`\\b(?:o|u)\\s+(?:\\d+|${numberWords})\\b|\\b(?:creo|quiz[aá]s|tal vez|no s[eé]|no estoy segur[oa])\\b`, "i").test(fold(original));
  if (doubtful) warnings.push("Hay una referencia dudosa. Aclara el número o vuelve a grabar antes de preparar la búsqueda.");
  let normalized = original;
  if (!doubtful) {
    const reference = new RegExp(`\\b(art[ií]culo|numeral|año)\\s+((?:${numberWords})(?:\\s+(?:${numberWords}))*)\\b`, "gi");
    normalized = normalized.replace(reference, (full, kind: string, words: string) => {
      const number = spanishNumber(words);
      if (number === null) { warnings.push(`Revisa la referencia «${full}»; no se convirtió.`); return full; }
      return `${kind} ${number}`;
    });
    normalized = normalized.replace(/\b(?:dos mil)(?:\s+(?:[a-záéíóúñ]+)){0,5}/gi, (full) => {
      // Only a complete number sequence; never absorb the following topic.
      const words = full.split(/\s+/); let length = 2;
      while (length < words.length && new RegExp(`^(?:${numberWords})$`).test(fold(words[length]))) length++;
      const number = spanishNumber(words.slice(0, length).join(" "));
      return number !== null && number >= 2000 && number <= 2099 ? `${number}${length < words.length ? ` ${words.slice(length).join(" ")}` : ""}` : full;
    });
    normalized = normalized.replace(/(art[ií]culo\s+\d+)\s*[.,;]?\s+numeral\s+(\d+)/gi, "$1.$2");
  }
  if (new RegExp(`\\b(?:opinion|resolucion|pronunciamiento|directiva|numero)\\s+(?:${numberWords})\\b`, "i").test(fold(normalized))) warnings.push("Escribe el identificador documental completo para confirmar sus ceros, guiones y año antes de buscar.");
  const references = [...new Set([...(normalized.match(/\d+(?:[./-]\d+)*/g) ?? []), ...(normalized.match(/\b(?:OECE|OSCE|DTN|TCP|IVN)\b/gi) ?? []).map(value => value.toUpperCase())])];
  return { normalized, references, warnings, ambiguous: warnings.length > 0 };
}

export function voiceFallback(text: string): AssistantProposal {
  const proposal = fallbackProposal(text);
  const type = /\bopini[oó]n(?:es)?\b/i.test(text) ? "opinion" : /\bresoluci[oó]n(?:es)?\b/i.test(text) ? "resolucion" : /\breglamento\b/i.test(text) ? "reglamento" : /\bdirectivas?\b/i.test(text) ? "directiva" : /\bpronunciamientos?\b/i.test(text) ? "pronunciamiento" : /\bacuerdo(?:s)? de sala plena\b/i.test(text) ? "acuerdo_sala_plena" : undefined;
  const years = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].filter(match => {
    const prefix = text.slice(0, match.index).slice(-70);
    const suffix = text.slice(match.index + match[0].length);
    return !/^\s*(?:soles|d[oó]lares|euros|unidades|por ciento|%)/i.test(suffix) && /(?:\b(?:año|de|del|en|opiniones|resoluciones|directivas|pronunciamientos|DTN|TCP|OECE|OSCE)\s*|[-/]\s*)$/i.test(prefix);
  }).map(match => match[0]);
  const year = new Set(years).size === 1 ? years[0] : undefined;
  const article = text.match(/\bart[ií]culo\s+(\d+(?:\.\d+)*)/i)?.[1];
  const theme = text.match(/\bsobre\s+(.+)/i)?.[1]?.trim();
  const otherNumbers = (text.match(/\d+(?:\.\d+)*/g) ?? []).filter(value => value !== year && value !== article);
  const acronyms = [...new Set(text.match(/\b(?:OECE|OSCE|DTN|TCP|IVN)\b/gi) ?? [])];
  const missingAcronyms = theme ? acronyms.filter(word => !theme.toUpperCase().includes(word.toUpperCase())) : [];
  const themeQuery = theme ? [theme, ...missingAcronyms].join(" ") : text;
  const query = article && !otherNumbers.length && !acronyms.length ? `Artículo ${article}` : theme && !article && !otherNumbers.length ? themeQuery : text;
  proposal.search = documentSearchRequestSchema.parse({ query, mode: article || text.length < 5 ? "literal" : "semantic", filters: { documentType: type, year: year ? Number(year) : undefined, article } });
  proposal.explanation = "Criterios preparados a partir de lo que indicaste. Confirma las referencias antes de buscar.";
  return proposal;
}

/** Reject model-invented or dropped numeric references; no confidence score. */
export function guardVoiceProposal(text: string, proposal: AssistantProposal) {
  const numeric = (value: string) => new Set(value.match(/\d+(?:\.\d+)*/g) ?? []);
  const source = numeric(text);
  const output = numeric(`${proposal.search.query} ${proposal.search.filters.article ?? ""} ${proposal.search.filters.year ?? ""}`);
  const acronyms = text.match(/\b(?:OECE|OSCE|DTN|TCP|IVN)\b/gi) ?? [];
  if (acronyms.some(value => !new RegExp(`\\b${value}\\b`, "i").test(proposal.search.query))) return voiceFallback(text);
  if ((proposal.search.query.match(/\b(?:OECE|OSCE|DTN|TCP|IVN)\b/gi) ?? []).some(value => !acronyms.some(original => original.toUpperCase() === value.toUpperCase()))) return voiceFallback(text);
  if ([...output].some(value => !source.has(value)) || [...source].some(value => !output.has(value))) return voiceFallback(text);
  const explicitFilters = voiceFallback(text).search.filters;
  const search = documentSearchRequestSchema.parse({ ...proposal.search, filters: explicitFilters });
  const finalNumbers = numeric(`${search.query} ${search.filters.article ?? ""} ${search.filters.year ?? ""}`);
  if ([...source].some(value => !finalNumbers.has(value))) return voiceFallback(text);
  return { ...proposal, destination: "/busqueda" as const, search };
}

export function voiceSearchInput(filters: DocumentSearchFilters, proposal: AssistantProposal) {
  return documentSearchRequestSchema.parse({ ...proposal.search, page: 1, filters: {
    ...filters, documentId: undefined,
    ...Object.fromEntries(Object.entries(proposal.search.filters).filter(([, value]) => value !== undefined && value !== "")),
    ...(proposal.search.filters.documentType ? { documentTypes: undefined } : {}),
    ...(proposal.search.filters.year ? { years: undefined } : {}),
  } });
}

export function audioMimeFromBytes(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  return null;
}
