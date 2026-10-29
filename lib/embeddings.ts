import { embeddingDimensions, embeddingModel, embeddingProvider, embedWithGoogle, getEmbeddingClient, googleEmbeddingModel } from "./openai-server";

// Generación de embeddings, compartida por todo lo que necesite vectores (antes
// vivía solo dentro de lib/pinecone.ts). Se extrae aparte porque pgvector
// también la necesita (lib/expedientes-archivo-vectors.ts) y no debe haber dos
// copias de la lógica de proveedor/lotes/truncado divergiendo con el tiempo.

const maxEmbeddingBatchSize = 96;

// ── Caché de consultas ──────────────────────────────────────────────────────────────────────────────────
// Cada pregunta al chat o a la búsqueda pagaba una llamada de embedding (y ~0,4–0,8 s) incluso cuando era la
// misma de hace un minuto: el chat lanza varias recuperaciones por pregunta con la misma consulta, y las
// preguntas frecuentes se repiten entre usuarios. El vector de un texto es determinista para un mismo modelo y
// dimensión, así que se puede recordar sin riesgo de servir algo desactualizado; la clave incluye proveedor, modelo
// y dimensión para que cambiar de modelo (que obliga a reindexar) no mezcle vectores de espacios distintos.
//
// Solo se recuerdan textos CORTOS (consultas): los fragmentos que se indexan son largos, se calculan una sola vez y
// llenarían la memoria desplazando justo lo que sí se repite. Es memoria de cada instancia del servidor, no
// compartida: en un despliegue sin servidor el beneficio es parcial, y por eso solo se cachea lo barato de
// conservar. No se cachean RESPUESTAS: dependen del historial, del caso y del corpus de ese momento.
const QUERY_CACHE_MAX_CHARS = 800;
const QUERY_CACHE_MAX_ENTRIES = 500;
const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { vector: number[]; storedAt: number };
const queryCache = new Map<string, CacheEntry>();
const cacheStats = { hits: 0, misses: 0 };

const cacheKey = (text: string) =>
  `${embeddingProvider}|${embeddingProvider === "google" ? googleEmbeddingModel : embeddingModel}|${embeddingDimensions}|${text}`;
const cacheable = (text: string) => text.length <= QUERY_CACHE_MAX_CHARS;

function cacheGet(text: string, now: number): number[] | undefined {
  const key = cacheKey(text);
  const entry = queryCache.get(key);
  if (!entry) return undefined;
  if (now - entry.storedAt > QUERY_CACHE_TTL_MS) { queryCache.delete(key); return undefined; }
  // Se reinserta para que el recorrido por orden de inserción deje al final lo usado hace poco (LRU).
  queryCache.delete(key); queryCache.set(key, entry);
  return entry.vector.slice();
}

function cacheSet(text: string, vector: number[], now: number) {
  const key = cacheKey(text);
  queryCache.delete(key);
  queryCache.set(key, { vector: vector.slice(), storedAt: now });
  while (queryCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldest = queryCache.keys().next().value;
    if (oldest === undefined) break;
    queryCache.delete(oldest);
  }
}

/** Vacía la caché (los tests y los cambios de modelo la necesitan limpia). */
export function clearEmbeddingCache() { queryCache.clear(); cacheStats.hits = 0; cacheStats.misses = 0; }
export function embeddingCacheStats() { return { ...cacheStats, size: queryCache.size }; }

/** Calcula un embedding por texto de entrada, en el mismo orden. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const now = Date.now();
  const result: number[][] = new Array(texts.length);
  const missing: number[] = [];
  texts.forEach((text, index) => {
    const hit = cacheable(text) ? cacheGet(text.slice(0, 8000), now) : undefined;
    if (hit) { result[index] = hit; cacheStats.hits += 1; } else { missing.push(index); if (cacheable(text)) cacheStats.misses += 1; }
  });
  if (missing.length === 0) return result;

  const computed = await computeEmbeddings(missing.map((index) => texts[index]));
  missing.forEach((index, position) => {
    result[index] = computed[position];
    if (cacheable(texts[index])) cacheSet(texts[index].slice(0, 8000), computed[position], now);
  });
  return result;
}

async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  // El proveedor se elige con EMBEDDING_PROVIDER. Con `google` se usa Gemini a
  // 1536 dimensiones, que es la del índice. Ver el aviso de embeddingProvider en
  // openai-server: cambiar de proveedor obliga a reindexar, porque los espacios
  // vectoriales no son intercambiables aunque coincida la dimensión.
  if (embeddingProvider === "google") {
    const vectores: number[][] = [];
    for (let start = 0; start < texts.length; start += maxEmbeddingBatchSize) {
      const batch = texts.slice(start, start + maxEmbeddingBatchSize).map((text) => text.slice(0, 8000));
      vectores.push(...(await embedWithGoogle(batch, embeddingDimensions)));
    }
    return vectores;
  }

  const client = getEmbeddingClient();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += maxEmbeddingBatchSize) {
    const batch = texts.slice(start, start + maxEmbeddingBatchSize).map((text) => text.slice(0, 8000));
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: batch,
      dimensions: embeddingDimensions,
    });
    for (const item of response.data) {
      vectors.push(item.embedding as number[]);
    }
  }

  return vectors;
}
