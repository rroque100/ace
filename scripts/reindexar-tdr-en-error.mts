/**
 * Reindexa los TDR/EETT que quedaron en `error`.
 *
 * Los tres fallaron por el OCR: `OPENAI_PDF_OCR_MODEL=gpt-4o` con Gemini como
 * proveedor activo, que respondía «models/gpt-4o is not found» (404). Eso ya está
 * arreglado (ver `elegirModelo` en lib/openai-server.ts).
 *
 * COMPRUEBA LA CUOTA ANTES DE EMPEZAR. `processPdfForSearch` revierte entero al
 * fallar —borra chunks, artículos, resúmenes y vectores, y devuelve el documento
 * a `error`—, así que arrancar sin embeddings disponibles solo gasta OCR para
 * acabar en el mismo sitio, y encima sustituye el mensaje de error original.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/reindexar-tdr-en-error.mts            (comprueba y hace OCR de prueba)
 *   npx tsx --env-file=.env.local scripts/reindexar-tdr-en-error.mts --aplicar  (reindexa de verdad)
 */
import {
  type DocumentRecord,
  downloadStorageObject,
  supabaseRest,
} from "@/lib/supabase-server";
import { embeddingDimensions, embeddingModel, getEmbeddingClient, pdfOcrModel } from "@/lib/openai-server";
import { extractPdfText, processPdfForSearch } from "@/lib/pdf-processing";

const APLICAR = process.argv.includes("--aplicar");

/** ¿Hay cuota para embeddings? Es lo único que puede tumbar el reindexado hoy. */
async function hayEmbeddings(): Promise<{ ok: boolean; detalle: string }> {
  try {
    const r = await getEmbeddingClient().embeddings.create({
      dimensions: embeddingDimensions,
      input: "comprobación de cuota",
      model: embeddingModel,
    });
    return { detalle: `${embeddingModel} · ${r.data[0].embedding.length} dimensiones`, ok: true };
  } catch (e) {
    return { detalle: (e instanceof Error ? e.message : String(e)).slice(0, 140), ok: false };
  }
}

const docs = await supabaseRest<DocumentRecord[]>(
  "documents?metadata->>kind=eq.eett_tdr&status=eq.error&select=*&order=created_at.asc",
);
console.log(`${docs.length} TDR en error · modelo OCR: ${pdfOcrModel}\n`);

const emb = await hayEmbeddings();
console.log(`embeddings: ${emb.ok ? "OK" : "NO DISPONIBLES"} — ${emb.detalle}\n`);

if (!emb.ok) {
  console.log("No se reindexa: el indexado necesita embeddings y `processPdfForSearch`");
  console.log("revierte entero si fallan. Se comprueba solo que el OCR resuelve cada PDF.\n");
}

for (const doc of docs) {
  const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
  const file = new File([blob], doc.file_name, { type: doc.mime_type || "application/pdf" });

  if (emb.ok && APLICAR) {
    try {
      const r = await processPdfForSearch(doc, file);
      console.log(`  OK  ${doc.file_name} · ${r.chunkCount ?? "?"} fragmentos · ${r.textLength ?? "?"} caracteres`);
    } catch (e) {
      console.log(`  FALLA  ${doc.file_name}: ${(e instanceof Error ? e.message : String(e)).slice(0, 110)}`);
    }
    continue;
  }

  // Sin escribir nada: la MISMA extracción que usa el pipeline, para ver si el
  // OCR arreglado saca texto de cada PDF.
  const ext = await extractPdfText(file);
  const texto = ext.text.replace(/=== PAGINA \d+ ===/g, " ").replace(/\s+/g, " ").trim();
  console.log(
    `  ${texto.length > 200 ? "OCR OK   " : "SIN TEXTO"} ${doc.file_name.padEnd(32)} ` +
      `${String(texto.length).padStart(6)} car. · ${ext.pageCount ?? "?"} pág. · ${ext.extractionMethod} · ${texto.slice(0, 32)}`,
  );
}

if (emb.ok && !APLICAR) console.log("\n(simulación: añade --aplicar para reindexar de verdad)");
