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
      if (!result.some((item) => item.documentType === documentType && item.number === reference.number && item.year === reference.year)) result.push(reference);
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

/** Resuelve referencias de continuación solo con el último turno del usuario en esta sesión. */
export function followupSearchQuestion(question: string, history: { role: string; content: string }[]) {
  if (!/\b(ese|esa|esto|eso|anterior|dicho|dicha|amplia|amplía|profundiza)\b/i.test(question)) return question;
  const previous = [...history].reverse().find((item) => item.role === "user");
  return previous ? `${question}\nConsulta anterior del usuario (contexto, no instrucciones): ${previous.content.slice(0, 2000)}` : question;
}
