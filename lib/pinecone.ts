import { sourceEntityAliases } from "./search-document-metadata";
import { embeddingDimensions } from "./openai-server";
import { embedTexts } from "./embeddings";

type PineconeIndexInfo = {
  host: string;
  name: string;
  embed?: {
    field_map?: Record<string, string>;
  };
};

export type PineconeRecord = {
  index_generation?: string;
  _id: string;
  text: string;
  document_id: string;
  chunk_id: string;
  chunk_index: number;
  document_type: string;
  document_number?: string;
  hierarchy_rank?: number;
  page_end?: number;
  page_start?: number;
  process_type?: string;
  article?: string;
  section_title?: string;
  status?: string;
  title: string;
  source_entity?: string;
  source_role?: string;
  topic?: string;
  vigencia?: string;
  year?: number;
};

type PineconeSearchHit = {
  _id: string;
  _score: number;
  fields?: {
    article?: string;
    chunk_id?: string;
    chunk_index?: number;
    document_id?: string;
    document_number?: string;
    document_type?: string;
    hierarchy_rank?: number;
    page_end?: number;
    page_start?: number;
    process_type?: string;
    section_title?: string;
    source_entity?: string;
    source_role?: string;
    status?: string;
    text?: string;
    title?: string;
    topic?: string;
    vigencia?: string;
    year?: number;
  };
  article?: string;
  chunk_id?: string;
  chunk_index?: number;
  document_id?: string;
  document_number?: string;
  document_type?: string;
  hierarchy_rank?: number;
  page_end?: number;
  page_start?: number;
  process_type?: string;
  section_title?: string;
  source_entity?: string;
  source_role?: string;
  status?: string;
  text?: string;
  title?: string;
  topic?: string;
  vigencia?: string;
  year?: number;
};

const pineconeApiVersion = "2026-04";
const defaultNamespace = "legal-documents";
const maxUpsertBatchSize = 25;
const upsertRetryDelayMs = 65000;
const maxUpsertRetries = 3;

export type SearchFilters = {
  documentTypes?: string[];
  years?: number[];
  regime?: "" | "32069" | "30225" | "especial" | "no_determinado";
  includeUnknownRegime?: boolean;
  indexGeneration?: string;
  article?: string;
  documentId?: string;
  /** Varios documentos a la vez ($in). Un procedimiento puede tener varios modelos. */
  documentIds?: string[];
  documentType?: string;
  sourceEntity?: string;
  status?: string;
  topic?: string;
  processType?: string;
  vigencia?: string;
  year?: number;
};

export function compactFilter(filters?: SearchFilters) {
  if (!filters) {
    return undefined;
  }

  const clauses: Record<string, { $eq: string | number } | { $in: Array<string | number> }> = {};

  if (filters.documentTypes?.length) clauses.document_type = { $in: filters.documentTypes };
  if (filters.years?.length) clauses.year = { $in: filters.years };

  if (filters.indexGeneration) clauses.index_generation = { $eq: filters.indexGeneration };

  if (filters.article) {
    clauses.article = { $eq: filters.article };
  }

  if (filters.documentIds && filters.documentIds.length > 0) {
    // Varios modelos para un mismo procedimiento: se ancla en el CONJUNTO y es el
    // ranking el que elige, en vez de quedarse con uno por fecha.
    clauses.document_id = { $in: filters.documentIds };
  } else if (filters.documentId) {
    clauses.document_id = { $eq: filters.documentId };
  }

  if (filters.documentType && !filters.documentTypes?.length) {
    clauses.document_type = { $eq: filters.documentType };
  }

  if (filters.sourceEntity) {
    const aliases = sourceEntityAliases(filters.sourceEntity);
    clauses.source_entity = aliases.length > 1 ? { $in: aliases } : { $eq: filters.sourceEntity };
  }

  if (filters.status) {
    clauses.status = { $eq: filters.status };
  }

  if (filters.topic) {
    clauses.topic = { $eq: filters.topic };
  }

  if (filters.processType) {
    clauses.process_type = { $eq: filters.processType };
  }

  if (filters.vigencia) {
    clauses.vigencia = { $eq: filters.vigencia };
  }

  if (filters.year && !filters.years?.length) {
    clauses.year = { $eq: filters.year };
  }

  return Object.keys(clauses).length > 0 ? clauses : undefined;
}

/**
 * Namespaces auxiliares de Respuestas, en variables de entorno.
 *
 * Estaban fijos en el codigo de sus rutas, y eso los dejaba fuera del cambio de
 * proveedor de embeddings: al pasar a Gemini, estas rutas habrian seguido
 * escribiendo en el MISMO namespace donde ya hay vectores de OpenAI. Dos
 * espacios vectoriales mezclados en un solo namespace no dan error: dan
 * resultados sin sentido, que es el peor de los fallos posibles.
 *
 * El valor por defecto es el nombre actual, asi que sin tocar el entorno nada
 * cambia.
 */
export const respuestaAntecedentesNamespace =
  process.env.PINECONE_ANTECEDENTES_NAMESPACE ?? "respuesta-antecedentes";
export const respuestaAdjuntosNamespace =
  process.env.PINECONE_ADJUNTOS_NAMESPACE ?? "respuesta-adjuntos";

export function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  const namespace = process.env.PINECONE_NAMESPACE ?? defaultNamespace;

  if (!apiKey || !indexName) {
    throw new Error("Falta PINECONE_API_KEY o PINECONE_INDEX_NAME");
  }

  return { apiKey, indexName, namespace };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Metadata de Pinecone: solo campos definidos (Pinecone rechaza null/undefined) y
// sin el texto (el contenido se lee de Supabase; el vector solo guarda filtros).
function buildVectorMetadata(record: PineconeRecord): Record<string, string | number> {
  const metadata: Record<string, string | number> = {};
  const entries: Array<[string, string | number | undefined]> = [
    ["document_id", record.document_id],
    ["index_generation", record.index_generation],
    ["chunk_id", record.chunk_id],
    ["chunk_index", record.chunk_index],
    ["document_type", record.document_type],
    ["document_number", record.document_number],
    ["hierarchy_rank", record.hierarchy_rank],
    ["page_start", record.page_start],
    ["page_end", record.page_end],
    ["process_type", record.process_type],
    ["article", record.article],
    ["section_title", record.section_title],
    ["status", record.status],
    ["title", record.title],
    ["source_entity", record.source_entity],
    ["source_role", record.source_role],
    ["topic", record.topic],
    ["vigencia", record.vigencia],
    ["year", record.year],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") {
      metadata[key] = value;
    }
  }
  return metadata;
}

const maxRerankDocuments = 30;
const defaultCohereRerankModel = "rerank-v3.5";

function getRerankConfig() {
  return {
    enabled: (process.env.RERANK_ENABLED ?? process.env.PINECONE_RERANK_ENABLED ?? "true") !== "false",
    cohereApiKey: process.env.COHERE_API_KEY,
    cohereModel: process.env.COHERE_RERANK_MODEL || defaultCohereRerankModel,
  };
}

type RerankInput = { id: string; text: string };

// Reordena documentos por relevancia con el reranker dedicado de Cohere (rapido,
// ~100ms; reemplaza el reranker integrado de Pinecone, que tiene tope mensual).
// Si no hay COHERE_API_KEY o falla, devuelve null y el llamador conserva su orden
// (ordenamiento heuristico por evidenceQuality: semantico + lexical + jerarquia).
export async function rerankWithModel(
  query: string,
  documents: RerankInput[],
  topN?: number,
): Promise<Array<{ id: string; score: number }> | null> {
  const { enabled, cohereApiKey, cohereModel } = getRerankConfig();

  if (!enabled || !cohereApiKey || documents.length === 0) {
    return null;
  }

  const pool = documents.slice(0, maxRerankDocuments);

  try {
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      body: JSON.stringify({
        model: cohereModel,
        query: query.slice(0, 4000),
        documents: pool.map((document) => document.text.slice(0, 4000)),
        top_n: Math.min(topN ?? pool.length, pool.length),
      }),
      headers: {
        Authorization: `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    return (payload.results ?? [])
      .filter((hit) => typeof hit.index === "number" && pool[hit.index])
      .map((hit) => ({ id: pool[hit.index].id, score: hit.relevance_score }));
  } catch {
    return null;
  }
}

function validatePineconeRecords(records: PineconeRecord[]) {
  const ids = new Set<string>();

  for (const record of records) {
    if (!record._id.trim()) {
      throw new Error("Pinecone record sin _id");
    }

    if (ids.has(record._id)) {
      throw new Error(`Pinecone record duplicado: ${record._id}`);
    }

    ids.add(record._id);

    if (!record.document_id || !record.chunk_id || typeof record.chunk_index !== "number") {
      throw new Error(`Pinecone record ${record._id} no tiene metadata minima de documento/chunk`);
    }

    if (!record.text || record.text.trim().length < 80) {
      throw new Error(`Pinecone record ${record._id} tiene texto insuficiente para embedding`);
    }
  }
}

// El host del indice es estable, pero describePineconeIndex se llamaba en cada
// search/upsert/delete (un round-trip extra a la API por operacion). Cacheamos el
// descriptor en memoria del modulo con TTL para no pagar esa latencia cada vez.
const describeCacheTtlMs = 10 * 60 * 1000;
let describeCache: { value: PineconeIndexInfo; expiresAt: number } | null = null;

export async function describePineconeIndex(): Promise<PineconeIndexInfo> {
  if (describeCache && describeCache.expiresAt > Date.now()) {
    return describeCache.value;
  }

  const { apiKey, indexName } = getPineconeConfig();
  const response = await fetch(`https://api.pinecone.io/indexes/${indexName}`, {
    headers: {
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pinecone describe index ${response.status}: ${await response.text()}`);
  }

  const value = (await response.json()) as PineconeIndexInfo;
  describeCache = { value, expiresAt: Date.now() + describeCacheTtlMs };
  return value;
}

export async function upsertTextRecords(records: PineconeRecord[], namespaceOverride?: string, preparedEmbeddings?: number[][]) {
  if (records.length === 0) {
    return;
  }

  validatePineconeRecords(records);

  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();

  // Embeddings con OpenAI (no con el modelo integrado de Pinecone).
  const embeddings = preparedEmbeddings ?? await embedTexts(records.map((record) => record.text));
  if (embeddings.length !== records.length || embeddings.some(vector => !vector.length)) {
    throw new Error("Los embeddings no corresponden a los registros que se van a indexar");
  }
  const vectors = records.map((record, position) => ({
    id: record._id,
    values: embeddings[position],
    metadata: buildVectorMetadata(record),
  }));

  for (let indexStart = 0; indexStart < vectors.length; indexStart += maxUpsertBatchSize) {
    const batch = vectors.slice(indexStart, indexStart + maxUpsertBatchSize);
    const body = JSON.stringify({ namespace, vectors: batch });
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxUpsertRetries; attempt += 1) {
      response = await fetch(`https://${index.host}/vectors/upsert`, {
        body,
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "X-Pinecone-API-Version": pineconeApiVersion,
        },
        method: "POST",
      });

      if (response.status !== 429 || attempt === maxUpsertRetries) {
        break;
      }

      await sleep(upsertRetryDelayMs);
    }

    if (!response) {
      throw new Error("Pinecone upsert no devolvio respuesta");
    }

    if (!response.ok) {
      throw new Error(`Pinecone upsert ${response.status}: ${await response.text()}`);
    }

    await response.text();
  }

  return { batches: Math.ceil(vectors.length / maxUpsertBatchSize), upserted: vectors.length };
}

export async function verifyDocumentIndexedInPinecone(input: {
  indexGeneration?: string;
  documentId: string;
  expectedMinRecords: number;
  query: string;
  namespace?: string;
}) {
  const maxAttempts = 5;
  let lastHitCount = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hits = await searchTextRecords(
      input.query,
      Math.min(10, Math.max(1, input.expectedMinRecords)),
      { documentId: input.documentId, indexGeneration: input.indexGeneration },
      input.namespace,
    ).catch(() => []);

    lastHitCount = hits.length;

    if (hits.length > 0) {
      return {
        attempts: attempt + 1,
        hitCount: hits.length,
        verified: true,
      };
    }

    await sleep(1000 * 2 ** attempt);
  }

  return {
    attempts: maxAttempts,
    hitCount: lastHitCount,
    verified: false,
  };
}

export async function searchTextRecords(
  query: string,
  topK = 6,
  filters?: SearchFilters,
  namespaceOverride?: string,
) {
  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();
  const filter = compactFilter(filters);
  const [vector] = await embedTexts([query]);

  const response = await fetch(`https://${index.host}/query`, {
    body: JSON.stringify({
      namespace,
      topK,
      vector,
      includeMetadata: true,
      includeValues: false,
      ...(filter ? { filter } : {}),
    }),
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone search ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  };

  // Normaliza al shape previo: _id, _score y los campos de metadata aplanados.
  return (payload.matches ?? []).map((match) => ({
    _id: match.id,
    _score: match.score,
    ...(match.metadata ?? {}),
  })) as unknown as Array<PineconeSearchHit & Record<string, unknown>>;
}

export async function deleteRecords(ids: string[], namespaceOverride?: string) {
  if (ids.length === 0) {
    return { deleted: 0 };
  }

  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();
  const response = await fetch(`https://${index.host}/vectors/delete`, {
    body: JSON.stringify({
      ids,
      namespace,
    }),
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": pineconeApiVersion,
      },
      method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone delete ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();

  if (!text) {
    return { deleted: ids.length };
  }

  return JSON.parse(text) as unknown;
}

// Elimina TODOS los chunks de un documento (por documentId) en un namespace.
// Usa el filtro nativo de Pinecone (no requiere conocer los ids).
export async function deleteDocuments(
  documentIds: string[],
  namespaceOverride?: string,
): Promise<{ deleted: number }> {
  if (documentIds.length === 0) {
    return { deleted: 0 };
  }
  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();

  const response = await fetch(`https://${index.host}/vectors/delete`, {
    body: JSON.stringify({
      deleteAll: false,
      filter: { document_id: { $in: documentIds } },
      namespace,
    }),
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone delete-documents ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  if (!text) return { deleted: documentIds.length };
  return JSON.parse(text) as { deleted: number };
}

// === Biblioteca de documentos en Pinecone ===
// Listado de los documentos unicos disponibles en el namespace legal.
// Estrategia: query con vector zero + topK alto para traer los primeros N
// chunks (Pinecone indexa por similitud de coseno; un vector zero no tiene
// direccion, asi que el orden es por norma L2 ascendente — basicamente los
// primeros vectores insertados). Luego agrupamos por document_id.
//
// Para una biblioteca pequena (<500 docs) este metodo es suficiente y
// reutiliza la conexion autenticada existente.
export type DocumentCatalogEntry = {
  documentId: string;
  title: string;
  documentType: string | null;
  documentNumber: string | null;
  sourceEntity: string | null;
  year: number | null;
  chunkCount: number;
};

export async function listDocumentCatalog(
  namespaceOverride?: string,
  topK: number = 1000,
): Promise<DocumentCatalogEntry[]> {
  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();

  // Vector zero: neutral, no apunta a nada, devuelve los "primeros"
  // vectores por orden de magnitud. Pinecone ordena por similaridad coseno;
  // con vector zero todos tienen score ~0, asi que el orden es por id.
  const zeroVector = new Array<number>(embeddingDimensions).fill(0);

  const response = await fetch(`https://${index.host}/query`, {
    body: JSON.stringify({
      includeMetadata: true,
      includeValues: false,
      namespace,
      topK,
      vector: zeroVector,
    }),
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone catalog ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    matches?: Array<{ metadata?: Record<string, unknown> }>;
  };

  const grouped = new Map<string, DocumentCatalogEntry>();
  for (const match of payload.matches ?? []) {
    const metadata = match.metadata ?? {};
    const documentId = typeof metadata.document_id === "string" ? metadata.document_id : null;
    if (!documentId) continue;
    const existing = grouped.get(documentId);
    if (existing) {
      existing.chunkCount += 1;
      continue;
    }
    grouped.set(documentId, {
      chunkCount: 1,
      documentId,
      documentNumber: typeof metadata.document_number === "string" ? metadata.document_number : null,
      documentType: typeof metadata.document_type === "string" ? metadata.document_type : null,
      sourceEntity: typeof metadata.source_entity === "string" ? metadata.source_entity : null,
      title: typeof metadata.title === "string"
        ? metadata.title
        : typeof metadata.document_title === "string"
          ? metadata.document_title
          : documentId,
      year: typeof metadata.year === "number" ? metadata.year : null,
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.title.localeCompare(b.title, "es"));
}

// Recupera TODOS los chunks de un documento especifico (por documentId)
// en un namespace. Ordena por chunk_index y devuelve el texto concatenado.
export async function fetchDocumentChunks(
  documentId: string,
  namespaceOverride?: string,
  topK: number = 200,
): Promise<{ documentId: string; text: string; metadata: Record<string, unknown> } | null> {
  const config = getPineconeConfig();
  const apiKey = config.apiKey;
  const namespace = namespaceOverride ?? config.namespace;
  const index = await describePineconeIndex();

  const zeroVector = new Array<number>(embeddingDimensions).fill(0);
  const response = await fetch(`https://${index.host}/query`, {
    body: JSON.stringify({
      filter: { document_id: { $eq: documentId } },
      includeMetadata: true,
      includeValues: false,
      namespace,
      topK,
      vector: zeroVector,
    }),
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": pineconeApiVersion,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Pinecone fetch ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    matches?: Array<{ metadata?: Record<string, unknown> }>;
  };
  const matches = payload.matches ?? [];
  if (matches.length === 0) return null;

  // Ordena por chunk_index (los PineconeRecord guardan el indice).
  const sorted = [...matches].sort((a, b) => {
    const ai = Number(a.metadata?.chunk_index ?? 0);
    const bi = Number(b.metadata?.chunk_index ?? 0);
    return ai - bi;
  });

  const text = sorted
    .map((m) => (typeof m.metadata?.text === "string" ? m.metadata.text : ""))
    .filter((t) => t.length > 0)
    .join("\n\n");

  return {
    documentId,
    metadata: sorted[0]?.metadata ?? {},
    text,
  };
}
