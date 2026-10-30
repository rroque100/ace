import type { LegalSource } from "./legal-chat";
import { getSupabaseAdminClient } from "./supabase-server";
import { CORPUS_ANSWER_TYPES } from "./official-corpus";
export async function selectedPassage(
  chunkId: string,
  documentId: string,
  sha?: string,
): Promise<LegalSource[]> {
  const c = await getSupabaseAdminClient();
  const { data: d, error: de } = await c
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("es_institucional", true)
    .eq("status", "indexed")
    .single();
  if (de) throw de;
  if (
    !d ||
    d.metadata.indexedTextComplete !== true ||
    !CORPUS_ANSWER_TYPES.includes(d.document_type) ||
    (sha && sha !== d.metadata.sha256)
  )
    return [];
  const { data: x, error } = await c
    .from("document_chunks")
    .select("*")
    .eq("id", chunkId)
    .eq("document_id", documentId)
    .single();
  if (error) throw error;
  if (!x) return [];
  return [
    {
      chunkId: x.id,
      documentId: d.id,
      documentTitle: d.title,
      documentNumber: d.metadata.documentNumber ?? null,
      documentType: d.document_type,
      fileName: d.file_name,
      sourceEntity: d.source_entity,
      chunkIndex: x.chunk_index,
      pageStart: x.page_start,
      pageEnd: x.page_end,
      article: null,
      sectionTitle: x.metadata.sectionTitle ?? null,
      topic: d.metadata.topic ?? null,
      processType: d.process_type ?? null,
      status: null,
      vigencia: d.metadata.vigencia ?? null,
      year: null,
      score: 0.6,
      semanticScore: 0,
      lexicalScore: 0.6,
      rerankScore: 0,
      evidenceQuality: 0.6,
      matchType: "lexical",
      excerpt: x.content,
      citation: `${d.title} · ${x.metadata.locatorLabel ?? `página ${x.page_start ?? "sin registrar"}`}`,
      version: d.metadata.officialVersion ?? null,
      locator: x.metadata.locator,
      locatorLabel: x.metadata.locatorLabel,
      selectionOrigin: "selected",
      requestedOriginal: true,
      referenceRelation: "original",
    },
  ];
}
