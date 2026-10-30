import { createHash } from "node:crypto";
import { ARCHIVO_LEASE_MS } from "./archivo-processing-policy";
import type { ExpedienteArchivo } from "./expedientes-archivo";
import { downloadStorageObject, supabaseRest } from "./supabase-server";
import { extractPdfOcrBlock, type ExtractedPdfText } from "./pdf-processing";
import { processExpedienteDocument } from "./expedientes-archivo-processing";

/** CAS lease + persistent block cache: retrying never discards completed OCR. */
export async function advanceRagDocument(row: ExpedienteArchivo) {
  if (row.status === "indexed" && !row.metadata?.ocrPartial) return;
  if (row.status === "processing" && Date.now() - Date.parse(row.updated_at ?? "") < ARCHIVO_LEASE_MS) return;
  const [claimed] = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?id=eq.${row.id}&updated_at=eq.${encodeURIComponent(row.updated_at ?? "")}&select=*`, {
    method: "PATCH", body: JSON.stringify({ status: "processing", error_message: null, updated_at: new Date().toISOString() }),
  });
  if (!claimed) return;
  const cas = `expedientes_archivo?id=eq.${claimed.id}&updated_at=eq.${encodeURIComponent(claimed.updated_at ?? "")}`;
  try {
    const blob = await downloadStorageObject(claimed.storage_bucket, claimed.storage_path);
    const file = new File([blob], claimed.file_name, { type: "application/pdf" });
    const hash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
    const blocks: ExtractedPdfText[] = [];
    let missing = false;
    for (let start = 1; ; start += 3) {
      const key = createHash("sha256").update(`rag-block-v1:${hash}:${start}`).digest("hex");
      const [cached] = await supabaseRest<Array<{ extracted: ExtractedPdfText }>>(`expedientes_ocr_cache?file_hash=eq.${key}&select=extracted&limit=1`);
      let block = cached?.extracted;
      if (!block) {
        if (missing) break; // Only one new block per invocation.
        block = await extractPdfOcrBlock(file, start);
        if (!block.pages.length) throw new Error("No se pudieron leer las páginas del PDF");
        await supabaseRest("expedientes_ocr_cache", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ file_hash: key, extracted: block, extraction_method: block.extractionMethod, page_count: block.pageCount, input_tokens: block.usage?.inputTokens ?? 0, output_tokens: block.usage?.outputTokens ?? 0, model: block.usage?.model }) });
        missing = true;
      }
      blocks.push(block);
      if (start + block.pages.length - 1 >= block.pageCount) break;
    }
    const pages = blocks.flatMap(b => b.pages);
    const total = blocks[0].pageCount;
    // Final indexing is a separate invocation after the final block is saved.
    if (!missing && pages.length === total) {
      await processExpedienteDocument(claimed, file, { extractionMethod: "openai-ocr", ocrPartial: false, pageCount: total, pages, text: pages.map(p => `=== PAGINA ${p.pageNumber} ===\n${p.text}`).join("\n\n"), usage: { model: blocks[0].usage?.model ?? "", inputTokens: blocks.reduce((n,b) => n + (b.usage?.inputTokens ?? 0), 0), outputTokens: blocks.reduce((n,b) => n + (b.usage?.outputTokens ?? 0), 0), fromCache: true } });
    } else {
      await supabaseRest(cas, { method: "PATCH", body: JSON.stringify({ status: "uploaded", metadata: { ...claimed.metadata, ragPagesDone: pages.length, pageCount: total, ocrPartial: true } }) });
    }
  } catch (error) {
    await supabaseRest(cas, { method: "PATCH", body: JSON.stringify({ status: "error", error_message: error instanceof Error ? error.message : "No se pudo procesar el documento" }) });
    throw error;
  }
}
