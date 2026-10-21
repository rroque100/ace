/**
 * Reindexa el corpus vectorial con los embeddings de Google (Gemini).
 *
 * POR QUE HACE FALTA. Los vectores actuales se escribieron con OpenAI
 * (text-embedding-3-small, 1536 dim). `gemini-embedding-001` tambien puede dar
 * 1536, asi que el indice sirve sin recrearlo — pero coincidir en el NUMERO de
 * dimensiones no significa compartir el ESPACIO. Preguntar con Gemini contra
 * vectores de OpenAI devuelve parecidos sin sentido, y lo peor es que devuelve
 * algo: seria cambiar un fallo ruidoso (429) por uno silencioso.
 *
 * COMO LO HACE, Y POR QUE ASI:
 *
 *   1. Escribe en namespaces NUEVOS (`<actual>-gemini`). Los vectores de OpenAI
 *      quedan intactos, asi que volver atras es cambiar una variable de entorno
 *      y no reindexar de nuevo.
 *   2. COPIA el metadato que ya tiene cada vector en Pinecone en vez de
 *      reconstruirlo. El indexado real lo enriquece (jerarquia, vigencia, topic,
 *      year...) en lib/pdf-processing.ts; rehacerlo aqui a mano se prestaria a
 *      divergencias silenciosas en los filtros de busqueda.
 *   3. El texto se lee de Postgres, porque el vector no lo guarda (el metadato
 *      solo lleva campos de filtro).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/reindexar-embeddings-google.mts
 *   npx tsx --env-file=.env.local scripts/reindexar-embeddings-google.mts --aplicar
 *
 * Despues de aplicar, en .env.local:
 *   EMBEDDING_PROVIDER=google
 *   PINECONE_NAMESPACE=legal-documents-gemini
 *   PINECONE_ARCHIVO_NAMESPACE=expedientes-archivo-gemini
 */
import { embeddingDimensions, embedWithGoogle, googleEmbeddingModel } from "@/lib/openai-server";
import { supabaseRest } from "@/lib/supabase-server";

const APLICAR = process.argv.includes("--aplicar");
const SUFIJO = "-gemini";

/** De que tabla sale el texto de cada namespace. */
const ORIGEN: Record<string, { tabla: string; columna: string } | null> = {
  "expedientes-archivo": { columna: "content", tabla: "expedientes_archivo_chunks" },
  "legal-documents": { columna: "content", tabla: "document_chunks" },
  // Los antecedentes de respuesta se generan al vuelo desde el expediente; no hay
  // tabla de fragmentos que releer. Se reportan y se dejan fuera a proposito.
  "respuesta-antecedentes": null,
};

const key = process.env.PINECONE_API_KEY;
if (!key) throw new Error("Falta PINECONE_API_KEY");
const indexName = process.env.PINECONE_INDEX_NAME;
if (!indexName) throw new Error("Falta PINECONE_INDEX_NAME");

const info = await fetch(`https://api.pinecone.io/indexes/${indexName}`, {
  headers: { "Api-Key": key },
}).then((r) => r.json());
const host: string = info.host;

const api = async (ruta: string, init?: RequestInit) => {
  const r = await fetch(`https://${host}${ruta}`, {
    ...init,
    headers: { "Api-Key": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${ruta} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

/** Todos los ids de un namespace, paginando. */
async function idsDe(namespace: string): Promise<string[]> {
  const ids: string[] = [];
  let token: string | undefined;
  do {
    const q = new URLSearchParams({ limit: "100", namespace });
    if (token) q.set("paginationToken", token);
    const j = await api(`/vectors/list?${q}`);
    for (const v of j.vectors ?? []) ids.push(v.id);
    token = j.pagination?.next;
  } while (token);
  return ids;
}

console.log(`indice ${indexName} · modelo ${googleEmbeddingModel} · ${embeddingDimensions} dimensiones`);
console.log(APLICAR ? "MODO REAL: se escribira en Pinecone\n" : "SIMULACION: no se escribe nada (anade --aplicar)\n");

const stats = await api("/describe_index_stats", { body: "{}", method: "POST" });
let totalPrevisto = 0;
let totalEscrito = 0;

for (const [namespace, datos] of Object.entries(stats.namespaces ?? {})) {
  const cuenta = (datos as { vectorCount: number }).vectorCount;
  if (namespace.endsWith(SUFIJO)) {
    console.log(`  ${namespace.padEnd(30)} ${String(cuenta).padStart(5)} · ya es destino, se omite`);
    continue;
  }
  const origen = ORIGEN[namespace];
  if (!origen) {
    console.log(`  ${namespace.padEnd(30)} ${String(cuenta).padStart(5)} · SIN ORIGEN DE TEXTO, se omite`);
    continue;
  }

  const ids = await idsDe(namespace);
  let conTexto = 0;
  let sinTexto = 0;

  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const traidos = await api(`/vectors/fetch?${new URLSearchParams({ namespace })}&${lote.map((id) => `ids=${encodeURIComponent(id)}`).join("&")}`);
    const vectores = Object.values(traidos.vectors ?? {}) as { id: string; metadata: Record<string, unknown> }[];

    // El texto se busca por chunk_id, que es lo que el metadato guarda.
    const chunkIds = vectores.map((v) => String(v.metadata?.chunk_id ?? "")).filter(Boolean);
    const filas = chunkIds.length
      ? await supabaseRest<{ id: string; content: string }[]>(
          `${origen.tabla}?id=in.(${chunkIds.join(",")})&select=id,${origen.columna}`,
        )
      : [];
    const texto = new Map(filas.map((f) => [f.id, f.content]));

    const listos = vectores
      .map((v) => ({ contenido: texto.get(String(v.metadata?.chunk_id ?? "")) ?? "", v }))
      .filter((x) => {
        if (x.contenido.trim()) return true;
        sinTexto += 1;
        return false;
      });
    conTexto += listos.length;

    if (!APLICAR) continue;

    const vect = await embedWithGoogle(listos.map((x) => x.contenido.slice(0, 8000)), embeddingDimensions);
    await api("/vectors/upsert", {
      body: JSON.stringify({
        namespace: namespace + SUFIJO,
        vectors: listos.map((x, k) => ({ id: x.v.id, metadata: x.v.metadata, values: vect[k] })),
      }),
      method: "POST",
    });
    totalEscrito += listos.length;
    process.stdout.write(`\r  ${namespace}: ${totalEscrito} escritos…`);
  }

  totalPrevisto += conTexto;
  const aviso = sinTexto > 0 ? `  ·  ${sinTexto} SIN texto en ${origen.tabla} (se omiten)` : "";
  console.log(`\r  ${namespace.padEnd(30)} ${String(cuenta).padStart(5)} en Pinecone · ${conTexto} reindexables -> ${namespace}${SUFIJO}${aviso}`);
}

console.log(`\n  total ${APLICAR ? "escrito" : "previsto"}: ${APLICAR ? totalEscrito : totalPrevisto} vectores`);
if (!APLICAR) {
  console.log("\n  Nada se ha modificado. Para ejecutarlo de verdad:");
  console.log("    npx tsx --env-file=.env.local scripts/reindexar-embeddings-google.mts --aplicar");
}
