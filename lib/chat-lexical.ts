// Búsqueda léxica del chat: elección de palabras clave y patrones tolerantes a tildes.
//
// Medido en producción con «¿Qué porcentaje del monto del contrato original debe
// tener la garantía de fiel cumplimiento?» (10 %, Reglamento art. 113.1):
//  - la consulta léxica hacía un OR de 8 palabras con ilike y SIN orden, así que
//    devolvía las primeras 50 filas en orden físico: 24 de ellas de la Ley 27444
//    (chunk_index 0, 1, 2, 3…) y ninguna del Reglamento;
//  - las palabras iban sin tildes («garantia») y ilike distingue tildes: no
//    coincidían con «garantía» del texto, justo las más informativas.
// Resultado: la LPAG ocupaba 6-7 de las 8 fuentes y el Reglamento no entraba.
//
// Aquí se arregla sin migración de BD: se exigen (AND) las 2-3 palabras más
// específicas y las largas se comparan con comodín en las vocales. Módulo puro.

// Palabras tan presentes en cualquier norma de contratación que no discriminan:
// con un AND, solo dejarían pasar fragmentos al azar.
const GENERIC_TOKENS = new Set([
  "articulo", "articulos", "caso", "casos", "contrataciones", "contratacion", "contrato", "contratos",
  "debe", "deben", "dice", "entidad", "entidades", "establece", "estado", "monto", "montos",
  "norma", "normas", "original", "publica", "publicas", "puede", "pueden", "reglamento", "segun",
  "tener", "ley", "leyes",
]);

/** Las palabras más específicas de la consulta (las más largas, sin las genéricas). */
export function pickKeyTokens(tokens: string[], max = 3): string[] {
  const unique = Array.from(new Set(tokens));
  const candidates = unique.filter((token) => !GENERIC_TOKENS.has(token));
  return candidates
    .map((token, index) => ({ token, index }))
    .sort((a, b) => b.token.length - a.token.length || a.index - b.index)
    .slice(0, max)
    .map((entry) => entry.token);
}

/**
 * Patrón ilike que tolera tildes. La consulta llega normalizada (sin tildes) pero
 * el texto indexado las conserva; ilike no ignora tildes, así que en las palabras
 * largas las vocales pasan a ser comodín `_`. En las cortas se deja exacta: con
 * comodines, «fiel» pasaría a ser «cualquier palabra de 4 letras que empiece por f».
 */
export function accentTolerantPattern(token: string): string {
  const clean = token.replaceAll("\\", "").replaceAll("*", "").replaceAll(",", " ").replaceAll("_", "");
  return clean.length >= 7 ? clean.replace(/[aeiou]/g, "_") : clean;
}

function clause(token: string): string {
  return `content.ilike.*${accentTolerantPattern(token)}*`;
}

/** Cláusula PostgREST de nivel superior: `and=(...)` exige todas; `or=(...)`, alguna. */
export function lexicalFilter(tokens: string[], mode: "and" | "or"): string {
  return `${mode}=${encodeURIComponent(`(${tokens.map(clause).join(",")})`)}`;
}

export type LexicalStep = { mode: "and" | "or"; tokens: string[] };

/**
 * Máximo de palabras en el OR. Medido en producción (statement_timeout de PostgREST ≈ 8 s): cada patrón `ilike '%…%'` sobre
 * `document_chunks.content` recorre la tabla entera sin índice, y con 1-3 palabras raras el OR tarda 0,2-0,5 s, pero con 4 sube
 * a ~8 s y con 5-6 agota el tiempo (error 57014). Con 3 se queda en el lado seguro; el índice trigram de
 * docs/supabase/chat-lexico-indice-trigram.sql permitiría subirlo.
 */
export const MAX_TOKENS_OR = 3;

/**
 * Niveles de la búsqueda léxica, de más a menos exigente. Cada nivel solo se
 * ejecuta si el anterior no reunió suficientes fragmentos:
 *  1. AND de las 3 palabras más específicas de TODA la consulta;
 *  2. AND de las 2 más específicas;
 *  3. OR de las específicas (hasta MAX_TOKENS_OR). Solo si la consulta no tiene
 *     ninguna específica se usan las primeras MAX_TOKENS_OR.
 * Importa elegir las claves sobre toda la consulta: recortar a 8 palabras antes
 * de elegir dejaba fuera «cumplimiento» en la pregunta de la garantía.
 */
export function lexicalPlan(allTokens: string[]): LexicalStep[] {
  const unique = Array.from(new Set(allTokens.filter(Boolean)));
  const keys = pickKeyTokens(unique, 3);
  const steps: LexicalStep[] = [];
  if (keys.length >= 3) steps.push({ mode: "and", tokens: keys });
  if (keys.length >= 2) steps.push({ mode: "and", tokens: keys.slice(0, 2) });
  const orTokens = pickKeyTokens(unique, MAX_TOKENS_OR);
  steps.push({ mode: "or", tokens: orTokens.length > 0 ? orTokens : unique.slice(0, MAX_TOKENS_OR) });
  return steps;
}

/**
 * Ejecuta el plan paso a paso y se queda con lo que haya reunido aunque un paso falle.
 *
 * Antes el bucle vivía en `searchLexicalChunks` y una excepción en el último paso (el OR, el más caro) descartaba también los
 * fragmentos que los AND anteriores ya habían encontrado: la vía léxica entera quedaba «caída» con resultados en la mano.
 * Si TODOS los pasos fallan se relanza el primer error (no hay nada que devolver y la vía debe contar como caída); si alguno
 * respondió, los fallos se reportan por `alFallar` y la búsqueda sigue con lo recuperado.
 */
export async function runLexicalPlan<T extends { id: string }>(
  plan: LexicalStep[],
  buscar: (step: LexicalStep) => Promise<T[]>,
  opciones: { limit: number; suficientes?: number; alFallar?: (error: unknown, step: LexicalStep) => void },
): Promise<T[]> {
  const suficientes = opciones.suficientes ?? Math.min(opciones.limit, 12);
  const found: T[] = [];
  const seen = new Set<string>();
  let primerError: unknown;
  let huboFallo = false;
  let respondio = false;
  for (const step of plan) {
    try {
      for (const chunk of await buscar(step)) {
        if (!seen.has(chunk.id)) {
          seen.add(chunk.id);
          found.push(chunk);
        }
      }
      respondio = true;
    } catch (error) {
      if (!huboFallo) primerError = error;
      huboFallo = true;
      opciones.alFallar?.(error, step);
    }
    if (found.length >= suficientes) break;
  }
  if (huboFallo && !respondio) throw primerError;
  return found.slice(0, opciones.limit);
}

/**
 * Completa las fuentes de una respuesta con un tope de fragmentos por documento.
 * Sin tope, una norma extensa (la Ley 27444 tiene 241 artículos) puede llenar
 * casi todos los puestos y desplazar a las que sí responden. El tope es blando:
 * si no hay otros documentos que completar, se rellena igual para no dejar la
 * respuesta sin fuentes. `selected` (la selección jerárquica) se conserva tal cual.
 */
export function fillWithDocumentCap<T extends { documentId: string; chunkId: string }>(
  selected: T[],
  ranked: T[],
  limit: number,
  perDocument = 3,
): T[] {
  const result = [...selected];
  const taken = new Set(result.map((item) => item.chunkId));
  const counts = new Map<string, number>();
  for (const item of result) counts.set(item.documentId, (counts.get(item.documentId) ?? 0) + 1);

  for (const strict of [true, false]) {
    for (const item of ranked) {
      if (result.length >= limit) return result;
      if (taken.has(item.chunkId)) continue;
      if (strict && (counts.get(item.documentId) ?? 0) >= perDocument) continue;
      taken.add(item.chunkId);
      counts.set(item.documentId, (counts.get(item.documentId) ?? 0) + 1);
      result.push(item);
    }
  }
  return result;
}

/**
 * Quita el mismo artículo repetido por copias del mismo documento. La
 * biblioteca tiene dos copias de la Ley 32069 y del Reglamento (la oficial y la
 * «texto actualizado» de SPIJ): el mismo artículo llegaba dos veces y gastaba
 * las dos plazas que la selección reserva para el Reglamento, dejando fuera al
 * artículo que sí respondía. `ranked` ya viene ordenado: se conserva la primera.
 * Los fragmentos sin artículo o sin número de norma no se tocan.
 */
export function dedupeArticleCopies<
  T extends { documentType: string; documentNumber: string | null; article: string | null; documentId: string },
>(ranked: T[]): T[] {
  const firstDocument = new Map<string, string>();
  return ranked.filter((item) => {
    if (!item.article || !item.documentNumber) return true;
    const key = `${item.documentType}|${item.documentNumber}|${item.article}`;
    const owner = firstDocument.get(key);
    if (owner === undefined) {
      firstDocument.set(key, item.documentId);
      return true;
    }
    // Varios fragmentos del MISMO documento y artículo se conservan: es el mismo
    // texto troceado, no una copia.
    return owner === item.documentId;
  });
}
