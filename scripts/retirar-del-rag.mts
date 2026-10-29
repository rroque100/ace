// Retira documentos del RAG sin borrarlos: quita sus vectores de Pinecone y sus fragmentos de la base, y deja
// la fila del documento y su PDF en Storage, marcada como retirada y fuera del corpus (status `error`, que el
// buscador y el chat no leen: solo usan `status = indexed`). Es lo contrario de DELETE /api/documents/[id], que
// borra también el PDF y no se puede deshacer.
//
// Para qué sirve: un PDF cuyo texto salió recortado (p. ej. un decreto de 3 páginas que debía tener 18) no
// es solo inútil: sus fragmentos son artículos de verdad a los que les falta lo que modifican o derogan, y el
// chat los cita con la misma seguridad que a una norma completa.
//
// Uso (por defecto SIMULA y no escribe nada):
//   npx tsx --env-file=.env.local scripts/retirar-del-rag.mts --doc <id> [--doc <id>...]
//   ... --aplicar --motivo "PDF recortado: 3 de 18 páginas" [--respaldo <carpeta>]
//
// Solo actúa sobre los id que se le dan (nunca por patrón de título). Antes de borrar guarda en --respaldo (por
// defecto, la carpeta temporal) la fila del documento y sus fragmentos. Para revertir: reindexar el documento
// (reindexar-importados-en-error.mts ignora los retirados a propósito; usa processPdfForSearch o la API de
// reindexado) y quitar `metadata.retiredFromRag`.

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabaseRest } from "@/lib/supabase-server";
import { deleteRecords } from "@/lib/pinecone";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const ids = args.flatMap((arg, i) => (arg === "--doc" && args[i + 1] ? [args[i + 1]] : []));
const motive = args.includes("--motivo") ? args[args.indexOf("--motivo") + 1] : "";
const backupDir = args.includes("--respaldo") ? args[args.indexOf("--respaldo") + 1] : join(tmpdir(), "ace-respaldo-retiro");

if (!ids.length) { console.error("Uso: retirar-del-rag.mts --doc <id> [--doc <id>...] [--aplicar --motivo \"…\"]"); process.exit(1); }
if (apply && !motive.trim()) { console.error("Con --aplicar hace falta --motivo: queda escrito en el documento."); process.exit(1); }

type Row = { id: string; title: string; status: string; metadata: Record<string, unknown> | null; file_size: number | null };
type Chunk = { id: string; pinecone_vector_id: string | null; page_start: number | null; page_end: number | null };

let failed = 0;
for (const id of ids) {
  const [doc] = await supabaseRest<Row[]>(`documents?id=eq.${id}&select=*`);
  if (!doc) { console.error(`${id}: no existe.`); failed += 1; continue; }
  const chunks = await supabaseRest<Chunk[]>(`document_chunks?document_id=eq.${id}&select=*&order=chunk_index.asc`);
  const vectorIds = chunks.map((chunk) => chunk.pinecone_vector_id).filter((value): value is string => Boolean(value));
  const lastPage = Math.max(0, ...chunks.map((chunk) => chunk.page_end ?? 0));
  console.log(`${apply ? "RETIRANDO" : "SIMULACIÓN"} · ${doc.title} (${doc.status}) · ${chunks.length} fragmentos · ${vectorIds.length} vectores · hasta la página ${lastPage}`);
  if (doc.metadata?.retiredFromRag) { console.log("  ya estaba retirado: no se toca."); continue; }
  if (!apply) continue;

  // 1. Respaldo de lo que se va a borrar.
  const articulos = await supabaseRest<unknown[]>(`norma_articulos?document_id=eq.${id}&select=*`);
  mkdirSync(backupDir, { recursive: true });
  const file = join(backupDir, `retiro-${id}.json`);
  writeFileSync(file, JSON.stringify({ guardadoEn: new Date().toISOString(), motivo: motive, documento: doc, fragmentos: chunks, normaArticulos: articulos }, null, 2));
  console.log(`  respaldo: ${file}`);

  // 2. Fuera de la búsqueda: primero los vectores (lo que el chat consulta) y después las filas derivadas.
  await deleteRecords(vectorIds);
  await supabaseRest(`norma_concordancias?source_document_id=eq.${id}`, { method: "DELETE" });
  await supabaseRest(`norma_articulos?document_id=eq.${id}`, { method: "DELETE" });
  await supabaseRest(`document_summaries?document_id=eq.${id}`, { method: "DELETE" });
  await supabaseRest(`document_chunks?document_id=eq.${id}`, { method: "DELETE" });

  // 3. El documento queda, marcado, fuera del corpus.
  await supabaseRest(`documents?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "error",
      error_message: `Retirado del RAG: ${motive}`,
      metadata: { ...(doc.metadata ?? {}), retiredFromRag: { at: new Date().toISOString(), reason: motive, chunks: chunks.length, vectors: vectorIds.length } },
    }),
  });

  // 4. Comprobación: ya no quedan fragmentos.
  const left = await supabaseRest<unknown[]>(`document_chunks?document_id=eq.${id}&select=id`);
  console.log(`  retirado: ${vectorIds.length} vectores y ${chunks.length} fragmentos borrados; quedan ${left.length} fragmentos.`);
  if (left.length) failed += 1;
}
if (!apply) console.log("\nSimulación terminada. Repite con --aplicar --motivo \"…\" para retirar.");
process.exit(failed ? 1 : 0);
