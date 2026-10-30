import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  getSupabaseAdminClient,
  getSupabaseServerConfig,
  type DocumentRecord,
} from "./supabase-server";
import {
  downloadOfficialPdf,
  validateOfficialUrl,
} from "./official-import/download";
import { uploadLargeOfficialPdf } from "./official-import/upload";
import { assertCompleteOfficialExtraction } from "./official-import/extraction";
import { officialPage, publishDocumentEvent } from "./library-updates";
import { officialSourceSchema } from "./library-updates";
export const candidateApprovalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(5).max(400),
  documentType: officialSourceSchema.shape.documentType,
  sourceEntity: z.string().trim().min(2).max(200),
  publicationUrl: officialSourceSchema.shape.url,
  number: z.string().trim().max(100).default(""),
  version: z.string().trim().min(3).max(200),
  relatedDocumentId: z.string().uuid().optional(),
  annexesAccounted: z.literal(true),
  evidence: z.string().trim().min(20).max(3000),
});
export async function acceptOfficialCandidate(
  input: z.infer<typeof candidateApprovalSchema>,
  actorId: string,
) {
  const c = await getSupabaseAdminClient();
  const { data: candidate, error } = await c
    .from("legal_update_candidates")
    .select("*")
    .eq("id", input.id)
    .single();
  if (error || !candidate) throw Error("Candidato no disponible.");
  if (candidate.status === "processing")
    throw Error(
      "Esta incorporación está en curso; revisa su ejecución antes de reintentar.",
    );
  if (candidate.status === "accepted") {
    const result = await publishDocumentEvent(
      candidate.document_id,
      input.relatedDocumentId ? "version" : "publication",
      "Publicación incorporada con extracción completa. La aplicación y vigencia requieren revisión.",
    );
    return { documentId: candidate.document_id, reused: true, ...result };
  }
  const { data: lock, error: lockError } = await c
    .from("legal_update_candidates")
    .update({
      status: "processing",
      error: null,
      review: { ...input, actorId, reviewedAt: new Date().toISOString() },
    })
    .eq("id", input.id)
    .eq("status", candidate.status)
    .select("id")
    .single();
  if (lockError || !lock)
    throw Error("Otra incorporación cambió este candidato.");
  let documentId: string | undefined;
  try {
    validateOfficialUrl(candidate.file_url);
    const html = await officialPage(input.publicationUrl);
    const filePath = new URL(candidate.file_url).pathname;
    if (
      !html.includes(filePath) &&
      !html.includes(filePath.replaceAll("/", "\\/"))
    )
      throw Error(
        "La publicación oficial indicada no enlaza este archivo exacto.",
      );
    if (input.relatedDocumentId) {
      const { data: related, error: re } = await c
        .from("documents")
        .select("id")
        .eq("id", input.relatedDocumentId)
        .eq("es_institucional", true)
        .single();
      if (re || !related)
        throw Error("La versión relacionada no está disponible.");
    }
    const bytes = await downloadOfficialPdf(candidate.file_url);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const { processPdfForSearch, extractPdfText } =
      await import("./pdf-processing");
    const pdfFile = new File([Uint8Array.from(bytes)], "original.pdf", {
      type: "application/pdf",
    });
    const text = await extractPdfText(pdfFile);
    assertCompleteOfficialExtraction(text);
    const { data: existing, error: ee } = await c
      .from("documents")
      .select("*")
      .eq("es_institucional", true)
      .contains("metadata", { sha256: hash })
      .limit(2);
    if (ee) throw ee;
    if ((existing?.length ?? 0) > 1)
      throw Error(
        "Hay varias identidades para el mismo original; requiere revisión.",
      );
    let doc = existing?.[0] as DocumentRecord | undefined;
    if (doc && doc.document_type !== input.documentType)
      throw Error(
        "El mismo original tiene otra clasificación. Revisa su identidad antes de incorporarlo.",
      );
    if (!doc) {
      const { storageBucket, supabaseUrl, serviceRoleKey } =
        getSupabaseServerConfig();
      const storagePath = `official/controlled/${randomUUID()}.pdf`;
      if (bytes.length > 6 * 1024 * 1024)
        await uploadLargeOfficialPdf({
          supabaseUrl,
          serviceRoleKey,
          bucket: storageBucket,
          objectPath: storagePath,
          bytes,
        });
      else {
        const { error: se } = await c.storage
          .from(storageBucket)
          .upload(storagePath, bytes, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (se) throw se;
      }
      const { data: created, error: ce } = await c
        .from("documents")
        .insert({
          title: input.title,
          file_name: decodeURIComponent(
            new URL(candidate.file_url).pathname.split("/").at(-1) ??
              "original.pdf",
          ),
          file_size: bytes.length,
          mime_type: "application/pdf",
          storage_bucket: storageBucket,
          storage_path: storagePath,
          document_type: input.documentType,
          source_entity: input.sourceEntity,
          status: "uploaded",
          es_institucional: true,
          metadata: {
            sourceUrl: candidate.file_url,
            officialPublicationUrl: input.publicationUrl,
            sha256: hash,
            officialVersion: input.version,
            documentNumber: input.number || null,
            number: input.number || null,
            relatedDocumentId: input.relatedDocumentId ?? null,
            relationshipReviewStatus: input.relatedDocumentId
              ? "detected"
              : null,
            regime: "no_determinado",
            legalReviewStatus: "pendiente",
            vigencia: "desconocida",
            controlledCandidateId: input.id,
            publicationDate: candidate.publication_date ?? null,
            publicationDateSource:
              candidate.publication_url ?? input.publicationUrl,
            publicationDateCheckedAt: new Date().toISOString(),
            importedAt: new Date().toISOString(),
            annexReview: {
              status: "accounted_by_reviewer",
              evidence: input.evidence,
              actorId,
              reviewedAt: new Date().toISOString(),
            },
            indexedTextComplete: false,
          },
        })
        .select("*")
        .single();
      if (ce) throw ce;
      doc = created as DocumentRecord;
    }
    documentId = doc.id;
    if (doc.status !== "indexed" || doc.metadata.indexedTextComplete !== true)
      await processPdfForSearch(doc, pdfFile);
    const { data: ready, error: ve } = await c
      .from("documents")
      .select("status,metadata")
      .eq("id", doc.id)
      .single();
    if (
      ve ||
      ready?.status !== "indexed" ||
      ready.metadata.indexedTextComplete !== true
    )
      throw Error("Extracción o indexación todavía incompleta.");
    const { error: ae } = await c
      .from("legal_update_candidates")
      .update({ status: "accepted", document_id: doc.id, error: null })
      .eq("id", input.id);
    if (ae) throw ae;
    const notices = await publishDocumentEvent(
      doc.id,
      input.relatedDocumentId ? "version" : "publication",
      "Original oficial incorporado. Extracción completa; relación con versiones y aplicabilidad jurídica sujetas a revisión.",
    );
    return {
      documentId: doc.id,
      reused: Boolean(existing?.length),
      ...notices,
    };
  } catch (e) {
    const { error: saveError } = await c
      .from("legal_update_candidates")
      .update({
        status: "failed",
        document_id: documentId ?? candidate.document_id,
        error:
          e instanceof Error
            ? e.message
            : "No se pudo completar la incorporación.",
      })
      .eq("id", input.id);
    if (saveError) throw saveError;
    throw e;
  }
}
