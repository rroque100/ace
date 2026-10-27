import { createHash } from "node:crypto";
import { extractSourceBlocks, splitSourceBlocks } from "./source-blocks";
import { getSupabaseAdminClient, type DocumentRecord } from "./supabase-server";
import {
  upsertTextRecords,
  verifyDocumentIndexedInPinecone,
  deleteDocuments,
} from "./pinecone";
import { corpusSourceKind } from "./official-corpus";

/** Original bytes are immutable; non-PDF locations never masquerade as physical pages. */
export async function indexSourceDocument(
  document: DocumentRecord,
  bytes: Uint8Array,
  options?: { force?: boolean },
) {
  if (
    !options?.force &&
    document.status === "indexed" &&
    document.metadata.indexedTextComplete === true
  )
    return { reused: true };
  const c = await getSupabaseAdminClient();
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (document.metadata.sha256 && document.metadata.sha256 !== hash)
    throw Error("El archivo no coincide con la huella registrada.");
  const blocks = await extractSourceBlocks(bytes, document.mime_type);
  const pieces = splitSourceBlocks(blocks);
  if (document.status === "processing")
    throw Error("Este documento ya tiene una indexación en curso.");
  await c
    .from("documents")
    .update({ status: "processing", error_message: null })
    .eq("id", document.id)
    .eq("status", document.status)
    .select("id")
    .single()
    .throwOnError();
  try {
    await c
      .from("document_chunks")
      .delete()
      .eq("document_id", document.id)
      .throwOnError();
    const rows = pieces.map((piece, i) => ({
      document_id: document.id,
      chunk_index: i,
      content: piece.content,
      page_start: null,
      page_end: null,
      pinecone_vector_id: `${document.id}::${i}`,
      metadata: {
        locator: piece.locator,
        locatorLabel: piece.locatorLabel,
        sectionTitle: piece.sectionTitle,
        sourceFormat: document.mime_type,
        sourceSha256: hash,
        sourceRole: corpusSourceKind(document.document_type),
      },
    }));
    const chunks: Array<{
      id: string;
      chunk_index: number;
      pinecone_vector_id: string;
    }> = [];
    for (let i = 0; i < rows.length; i += 100) {
      const { data, error } = await c
        .from("document_chunks")
        .insert(rows.slice(i, i + 100))
        .select("id,chunk_index,pinecone_vector_id");
      if (error) throw error;
      chunks.push(...data);
    }
    await upsertTextRecords(
      chunks.map((chunk) => ({
        _id: chunk.pinecone_vector_id,
        chunk_id: chunk.id,
        document_id: document.id,
        chunk_index: chunk.chunk_index,
        document_type: document.document_type,
        title: document.title,
        source_entity: document.source_entity ?? undefined,
        source_role: corpusSourceKind(document.document_type),
        section_title: pieces[chunk.chunk_index].locatorLabel,
        text: `${document.title}\n${pieces[chunk.chunk_index].locatorLabel}\n${pieces[chunk.chunk_index].content}`,
        document_number:
          typeof document.metadata.documentNumber === "string"
            ? document.metadata.documentNumber
            : undefined,
        year:
          typeof document.metadata.year === "number"
            ? document.metadata.year
            : undefined,
      })),
    );
    const verification = await verifyDocumentIndexedInPinecone({
      documentId: document.id,
      expectedMinRecords: chunks.length,
      query: document.title,
    });
    if (!verification.verified)
      throw Error("No se pudo verificar la recuperación en Pinecone.");
    const { error } = await c
      .from("documents")
      .update({
        status: "indexed",
        error_message: null,
        metadata: {
          ...document.metadata,
          sha256: hash,
          sourceFormat: document.mime_type,
          indexedTextComplete: true,
          chunkCount: chunks.length,
          blockCount: blocks.length,
          pageCount: null,
          extractionMethod: "source-blocks-v2",
          indexingPipelineVersion: "source-blocks-v2",
          indexingPendingReason: null,
          pinecone: { verification },
          sourceLocatorKind: "block",
        },
      })
      .eq("id", document.id);
    if (error) throw error;
    return {
      blocks: blocks.length,
      chunks: chunks.length,
      textLength: blocks.reduce((sum, b) => sum + b.content.length, 0),
      verification,
    };
  } catch (error) {
    await deleteDocuments([document.id]).catch(() => undefined);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo completar la indexación.";
    await c
      .from("documents")
      .update({
        status: "error",
        error_message: message,
        metadata: {
          ...document.metadata,
          indexedTextComplete: false,
          indexingPendingReason: message,
        },
      })
      .eq("id", document.id)
      .throwOnError();
    throw error;
  }
}
