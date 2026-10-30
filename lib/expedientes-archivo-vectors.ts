import { embedTexts } from "./embeddings";
import { supabaseUserRest } from "./supabase-server";

// Búsqueda semántica NATIVA en Postgres (pgvector) para expedientes-archivo,
// ver docs/supabase/expedientes-archivo-pgvector.sql. Reemplaza a Pinecone
// para este módulo — corpus legal, EETT/TDR y respuesta-antecedentes siguen
// en Pinecone, esta migración está acotada a expedientes-archivo a propósito.

export type VectorChunkHit = {
  chunkId: string;
  documentoId: string;
  chunkIndex: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  metadata: Record<string, unknown>;
  score: number;
};

type BuscarVecinosRow = {
  chunk_id: string;
  documento_id: string;
  chunk_index: number;
  content: string;
  page_start: number | null;
  page_end: number | null;
  metadata: Record<string, unknown> | null;
  score: number;
};

/**
 * La función/columna de la migración aún no se aplicó en este proyecto (ver
 * docs/supabase/expedientes-archivo-pgvector.sql). Mismo patrón que
 * necesidad_items_replace y merge_document_metadata: el llamador cae al
 * camino anterior (Pinecone) en vez de romper la búsqueda.
 */
function esMigracionPendiente(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /PGRST202|Could not find the function.*expedientes_buscar_vecinos|column .*embedding.* does not exist|PGRST204.*embedding/i.test(
    msg,
  );
}

/**
 * Busca los chunks de expedientes-archivo más parecidos a `query` por
 * embedding, vía RPC `expedientes_buscar_vecinos` (security invoker: queda
 * scopeado por la RLS de expedientes_archivo_chunks — admin todo, jefe su
 * oficina, el resto solo lo suyo — DENTRO de la consulta).
 *
 * Devuelve `null` si la migración de pgvector todavía no se aplicó, para que
 * el llamador (searchExpedientes) caiga a Pinecone sin que la búsqueda se
 * rompa. Cualquier otro error (fallo real de red/BD) se propaga.
 */
export async function buscarVecinosPgvector(
  accessToken: string,
  query: string,
  topK: number,
  filters: { documentId?: string; year?: number },
): Promise<VectorChunkHit[] | null> {
  // La existencia del RPC no demuestra que se hayan migrado los datos.
  if (process.env.EXPEDIENTES_VECTOR_READ !== "pgvector") return null;
  try {
    const pending = await supabaseUserRest<Array<{ id: string }>>(accessToken,
      "expedientes_archivo_chunks?select=id&embedding=is.null&limit=1");
    if (pending.length) return null;
    const [queryEmbedding] = await embedTexts([query]);
    if (!queryEmbedding) return null;

    const rows = await supabaseUserRest<BuscarVecinosRow[]>(accessToken, "rpc/expedientes_buscar_vecinos", {
      method: "POST",
      body: JSON.stringify({
        p_query_embedding: queryEmbedding,
        p_top_k: topK,
        p_document_id: filters.documentId ?? null,
        p_year: filters.year ?? null,
      }),
    });

    return rows.map((row) => ({
      chunkId: row.chunk_id,
      documentoId: row.documento_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      metadata: row.metadata ?? {},
      score: row.score,
    }));
  } catch (error) {
    if (esMigracionPendiente(error)) return null;
    throw error;
  }
}
