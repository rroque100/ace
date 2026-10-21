import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { supabaseRest } from "./supabase-server";
import {
  type PineconeRecord,
  deleteRecords,
  upsertTextRecords,
  verifyDocumentIndexedInPinecone,
} from "./pinecone";
import { chunkPages, extractPdfText } from "./pdf-processing";
import {
  type ArchivoDocKind,
  type ArchivoDocumento,
  archivoDocKindLabel,
  extractFecha,
  extractResolutionNumber,
  getArchivoNamespace,
  normalizeArchivoDocKind,
} from "./archivo";

const chunkInsertBatchSize = 100;
const minExtractedTextLength = 120;
const analysisTextLimit = 14000;

type ArchivoChunkInsert = {
  documento_id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};

type ArchivoInsights = {
  asunto: string | null;
  docKind: ArchivoDocKind | null;
  summary: string | null;
};

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return {};
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Extrae asunto/sumilla, tipo de acto y un resumen breve con la IA. Devuelve nulls
// si falla (los datos del usuario y los extractores deterministas siguen mandando).
async function analyzeArchivoWithAi(text: string): Promise<ArchivoInsights> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Analiza este DOCUMENTO ADMINISTRATIVO municipal (resolucion, acuerdo, ordenanza, decreto, oficio o informe).

Devuelve SOLO JSON valido, sin markdown, con estas claves:
{
  "asunto": "asunto o sumilla en una linea (lo que resuelve/dispone)",
  "docKind": "resolucion_alcaldia|resolucion_gerencia|acuerdo_concejo|ordenanza|decreto_alcaldia|oficio|informe|otros",
  "summary": "resumen ejecutivo de 3 a 5 lineas"
}

Texto:
${text.slice(0, analysisTextLimit)}`,
          role: "user",
        },
      ],
      max_output_tokens: 700,
      model: legalAnswerModel,
      temperature: 0,
    });
    const parsed = parseJsonObject(response.output_text);
    const docKindRaw = typeof parsed.docKind === "string" ? parsed.docKind : null;
    return {
      asunto: typeof parsed.asunto === "string" && parsed.asunto.trim() ? parsed.asunto.trim() : null,
      docKind: docKindRaw ? normalizeArchivoDocKind(docKindRaw) : null,
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
    };
  } catch {
    return { asunto: null, docKind: null, summary: null };
  }
}

function buildArchivoEmbeddingText(input: {
  title: string;
  docKindLabel: string;
  documentNumber: string | null;
  fecha: string | null;
  asunto: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}) {
  const header = [
    `Documento: ${input.title}`,
    `Tipo: ${input.docKindLabel}`,
    input.documentNumber ? `Numero: ${input.documentNumber}` : null,
    input.fecha ? `Fecha: ${input.fecha}` : null,
    input.asunto ? `Asunto: ${input.asunto}` : null,
    input.pageStart
      ? input.pageEnd && input.pageEnd !== input.pageStart
        ? `Paginas: ${input.pageStart}-${input.pageEnd}`
        : `Pagina: ${input.pageStart}`
      : null,
  ].filter(Boolean);

  return `${header.join("\n")}\n\nTexto del documento:\n${input.content}`;
}

async function insertChunksInBatches(rows: ArchivoChunkInsert[]) {
  const inserted: Array<ArchivoChunkInsert & { id: string }> = [];
  for (let index = 0; index < rows.length; index += chunkInsertBatchSize) {
    const batch = rows.slice(index, index + chunkInsertBatchSize);
    const result = await supabaseRest<Array<ArchivoChunkInsert & { id: string }>>("archivo_chunks", {
      body: JSON.stringify(batch),
      method: "POST",
    });
    inserted.push(...result);
  }
  return inserted;
}

// Procesa un documento del archivo: extrae texto (con OCR opcional via extractPdfText),
// detecta numero/fecha/asunto, fragmenta por paginas, indexa en el namespace AISLADO
// del archivo en Pinecone y persiste chunks + metadata. Estado: processing -> indexed/error.
export async function processArchivoDocument(document: ArchivoDocumento, file: File) {
  const namespace = getArchivoNamespace();
  let insertedVectorIds: string[] = [];

  await supabaseRest(`archivo_documentos?id=eq.${document.id}`, {
    body: JSON.stringify({ error_message: null, status: "processing" }),
    method: "PATCH",
  });

  try {
    const extracted = await extractPdfText(file);
    const text = extracted.text;

    if (text.length < minExtractedTextLength) {
      throw new Error(
        "No se pudo extraer texto suficiente del PDF. El archivo parece escaneado o no legible.",
      );
    }

    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const insights = await analyzeArchivoWithAi(text);

    // El dato del usuario manda; si no lo dio, se usa lo detectado/IA.
    const documentNumber =
      (typeof document.document_number === "string" && document.document_number.trim()
        ? document.document_number.trim()
        : null) ?? extractResolutionNumber(document.title, text);
    const fecha =
      (typeof document.fecha === "string" && document.fecha.trim() ? document.fecha.trim() : null) ??
      extractFecha(text);
    const asunto =
      (typeof document.asunto === "string" && document.asunto.trim() ? document.asunto.trim() : null) ??
      insights.asunto;
    const docKind: ArchivoDocKind =
      document.doc_kind && document.doc_kind !== "otros"
        ? document.doc_kind
        : insights.docKind ?? document.doc_kind;
    const docKindLabel = archivoDocKindLabel(docKind);
    const year = fecha ? Number.parseInt(fecha.slice(0, 4), 10) : undefined;

    const chunkRows: ArchivoChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      documento_id: document.id,
      metadata: {
        documentNumber,
        docKind,
        fecha,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      },
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
      pinecone_vector_id: `archivo::${document.id}::${chunk.index}`,
    }));

    const insertedChunks = await insertChunksInBatches(chunkRows);

    const records: PineconeRecord[] = insertedChunks.map((chunk) => ({
      _id: chunk.pinecone_vector_id,
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      document_id: document.id,
      document_number: documentNumber ?? undefined,
      document_type: docKind,
      page_end: chunk.page_end ?? undefined,
      page_start: chunk.page_start ?? undefined,
      source_role: "archivo",
      status: "indexed",
      text: buildArchivoEmbeddingText({
        asunto,
        content: chunk.content,
        docKindLabel,
        documentNumber,
        fecha,
        pageEnd: chunk.page_end,
        pageStart: chunk.page_start,
        title: document.title,
      }),
      title: document.title,
      topic: asunto ?? undefined,
      year: Number.isFinite(year) ? year : undefined,
    }));
    insertedVectorIds = records.map((record) => record._id);

    const upsert = await upsertTextRecords(records, namespace);
    const verification = await verifyDocumentIndexedInPinecone({
      documentId: document.id,
      expectedMinRecords: records.length,
      namespace,
      query: [document.title, documentNumber, docKindLabel, asunto].filter(Boolean).join(" "),
    });

    await supabaseRest(`archivo_documentos?id=eq.${document.id}`, {
      body: JSON.stringify({
        asunto,
        body_text: text.slice(0, 200000),
        doc_kind: docKind,
        document_number: documentNumber,
        fecha,
        metadata: {
          ...document.metadata,
          chunkCount: chunks.length,
          extractionMethod: extracted.extractionMethod,
          ocrPartial: extracted.ocrPartial,
          pageCount: extracted.pageCount,
          pinecone: {
            namespace,
            recordCount: records.length,
            upserted: upsert?.upserted ?? records.length,
            verification,
          },
          summary: insights.summary,
          textLength: text.length,
        },
        status: "indexed",
      }),
      method: "PATCH",
    });

    return { chunkCount: chunks.length, pageCount: extracted.pageCount, textLength: text.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error procesando documento";
    await deleteRecords(insertedVectorIds, namespace).catch(() => undefined);
    await supabaseRest(`archivo_chunks?documento_id=eq.${document.id}`, { method: "DELETE" }).catch(
      () => undefined,
    );
    await supabaseRest(`archivo_documentos?id=eq.${document.id}`, {
      body: JSON.stringify({ error_message: errorMessage, status: "error" }),
      method: "PATCH",
    });
    throw error;
  }
}
