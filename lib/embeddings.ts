import { embeddingDimensions, embeddingModel, embeddingProvider, embedWithGoogle, getEmbeddingClient } from "./openai-server";

// Generación de embeddings, compartida por todo lo que necesite vectores (antes
// vivía solo dentro de lib/pinecone.ts). Se extrae aparte porque pgvector
// también la necesita (lib/expedientes-archivo-vectors.ts) y no debe haber dos
// copias de la lógica de proveedor/lotes/truncado divergiendo con el tiempo.

const maxEmbeddingBatchSize = 96;

/** Calcula un embedding por texto de entrada, en el mismo orden. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

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
