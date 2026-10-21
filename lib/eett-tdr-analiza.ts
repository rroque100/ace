// Lógica pura del modal «Analiza» para EETT/TDR: cómo se etiqueta el estado de
// indexación, cómo se valida que un documento pertenece a la necesidad, y cómo
// se arman las queries PostgREST y el filtro de recuperación. Sin red ni BD:
// vive aquí para que las rutas y el modal compartan exactamente las mismas
// reglas y se pueda testear sin mocks pesados.

export type EstadoIndexacion = {
  label: string;
  tone: "ok" | "error" | "info" | "pending" | "muted";
  razon?: string;
};

export function esDocxEett(fileName: string): boolean {
  return /\.docx$/i.test(fileName);
}

// El indexado RAG solo aplica a PDF (`eett-tdr/route.ts:170-175`). Un .docx se
// acepta como adjunto y se lee para el editor, pero nunca llega a Pinecone:
// su estado real es "no indexado", y conviene mostrarlo así por encima del
// `status` que traiga la fila.
export function estadoIndexacion(status: string, esDocx: boolean): EstadoIndexacion {
  if (esDocx) {
    return {
      label: "No indexado",
      tone: "muted",
      razon: "Los .docx no entran en el RAG; solo se indexan los PDF.",
    };
  }
  switch (status) {
    case "processing":
      return { label: "Procesando", tone: "info" };
    case "indexed":
      return { label: "Indexado", tone: "ok" };
    case "error":
      return { label: "Error", tone: "error" };
    case "uploaded":
    default:
      return { label: "Subido", tone: "pending" };
  }
}

export function validarPertenenciaEett(
  doc: { metadata?: Record<string, unknown> | null },
  necesidadId: string,
): boolean {
  const md = doc.metadata;
  if (!md) return false;
  return md.necesidadId === necesidadId && md.kind === "eett_tdr";
}

export function queryChunks(
  docId: string,
  opts: { q?: string; page: number; limit: number },
): string {
  const offset = Math.max(0, (opts.page - 1) * opts.limit);
  const base = `document_chunks?document_id=eq.${docId}&select=id,chunk_index,page_start,page_end,content,token_count,metadata&order=chunk_index.asc&limit=${opts.limit}&offset=${offset}`;
  const q = opts.q?.trim();
  if (!q) return base;
  return `${base}&content=ilike.*${encodeURIComponent(q)}*`;
}

export function queryChunksTotal(docId: string): string {
  return `document_chunks?document_id=eq.${docId}&select=id&limit=0`;
}

// Filtro de Pinecone: ancla la consulta de prueba al documento, no al corpus.
// `compactFilter` (`lib/pinecone.ts:114`) lo traduce a `{ document_id: { $eq } }`.
export function filtroConsultaDoc(docId: string): { documentId: string } {
  return { documentId: docId };
}

export type MetadatosRag = {
  extractionMethod?: string;
  ocrParcial: boolean;
  indexedTextComplete: boolean;
  pageCount?: number;
  chunkCount?: number;
  recordCount?: number;
  namespace?: string;
  contentHash?: string;
  pipelineVersion?: string;
};

// Aplana `metadata.pinecone` y fija defaults: si el documento no dice nada sobre
// `indexedTextComplete`, asumimos que SÍ está completo (el caso normal). Lo mismo
// con `ocrParcial`: ausente => false.
export function normalizarMetadatosRag(
  metadata: Record<string, unknown> | null | undefined,
): MetadatosRag {
  const md = metadata ?? {};
  const pine = (md.pinecone ?? {}) as Record<string, unknown>;
  return {
    extractionMethod: md.extractionMethod as string | undefined,
    ocrParcial: Boolean(md.ocrPartial),
    indexedTextComplete:
      typeof md.indexedTextComplete === "boolean" ? md.indexedTextComplete : true,
    pageCount: md.pageCount as number | undefined,
    chunkCount: md.chunkCount as number | undefined,
    recordCount: pine.recordCount as number | undefined,
    namespace: pine.namespace as string | undefined,
    contentHash: md.contentHash as string | undefined,
    pipelineVersion: md.indexingPipelineVersion as string | undefined,
  };
}
