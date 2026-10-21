import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { type SearchFilters, searchTextRecords } from "./pinecone";
import { supabaseRest } from "./supabase-server";
import { archivoDocKindLabel, getArchivoNamespace } from "./archivo";
import { type ArchivoChatInput, type ArchivoSearchInput } from "./archivo-schema";

export type ArchivoSearchResult = {
  documentId: string;
  documentNumber: string | null;
  title: string;
  asunto: string | null;
  fecha: string | null;
  docKind: string;
  docKindLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
  score: number;
  storagePath: string | null;
  storageBucket: string | null;
  citation: string;
};

type ChunkRow = { id: string; content: string };
type DocRow = {
  id: string;
  title: string;
  asunto: string | null;
  fecha: string | null;
  document_number: string | null;
  doc_kind: string;
  storage_path: string | null;
  storage_bucket: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function searchArchivo(input: ArchivoSearchInput): Promise<ArchivoSearchResult[]> {
  const namespace = getArchivoNamespace();
  const filters: SearchFilters | undefined = input.docKind
    ? { documentType: input.docKind }
    : undefined;
  const topK = input.topK ?? 8;

  const hits = await searchTextRecords(input.query, topK, filters, namespace);
  if (hits.length === 0) {
    return [];
  }

  const chunkIds = Array.from(
    new Set(hits.map((hit) => asString((hit as Record<string, unknown>).chunk_id)).filter(Boolean)),
  ) as string[];
  const documentIds = Array.from(
    new Set(hits.map((hit) => asString((hit as Record<string, unknown>).document_id)).filter(Boolean)),
  ) as string[];

  const [chunkRows, docRows] = await Promise.all([
    chunkIds.length > 0
      ? supabaseRest<ChunkRow[]>(
          `archivo_chunks?id=in.(${chunkIds.map((id) => `"${id}"`).join(",")})&select=id,content`,
        ).catch(() => [])
      : Promise.resolve([]),
    documentIds.length > 0
      ? supabaseRest<DocRow[]>(
          `archivo_documentos?id=in.(${documentIds.map((id) => `"${id}"`).join(",")})&select=id,title,asunto,fecha,document_number,doc_kind,storage_path,storage_bucket`,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const contentById = new Map(chunkRows.map((row) => [row.id, row.content]));
  const docById = new Map(docRows.map((row) => [row.id, row]));

  const results: ArchivoSearchResult[] = [];
  for (const hit of hits) {
    const record = hit as Record<string, unknown>;
    const documentId = asString(record.document_id);
    if (!documentId) {
      continue;
    }
    // Post-filtro por numero de documento (no es filtro nativo de Pinecone).
    const hitNumber = asString(record.document_number);
    if (input.documentNumber && hitNumber && !hitNumber.includes(input.documentNumber)) {
      continue;
    }

    const doc = docById.get(documentId);
    const chunkId = asString(record.chunk_id);
    const content = chunkId ? contentById.get(chunkId) ?? "" : "";
    const pageStart = asNumber(record.page_start);
    const pageEnd = asNumber(record.page_end);
    const docKind = asString(record.document_type) ?? doc?.doc_kind ?? "otros";
    const number = hitNumber ?? doc?.document_number ?? null;

    results.push({
      asunto: doc?.asunto ?? asString(record.topic),
      citation: `${archivoDocKindLabel(docKind)}${number ? ` N° ${number}` : ""}${
        pageStart ? `, pág. ${pageStart}` : ""
      }`,
      docKind,
      docKindLabel: archivoDocKindLabel(docKind),
      documentId,
      documentNumber: number,
      excerpt: content.slice(0, 700),
      fecha: doc?.fecha ?? null,
      pageEnd,
      pageStart,
      score: asNumber(record._score) ?? 0,
      storageBucket: doc?.storage_bucket ?? null,
      storagePath: doc?.storage_path ?? null,
      title: doc?.title ?? asString(record.title) ?? "Documento",
    });
  }

  return results;
}

export type ArchivoAnswer = {
  answer: string;
  sufficient: boolean;
  sources: ArchivoSearchResult[];
};

function buildContext(sources: ArchivoSearchResult[]) {
  return sources
    .map((source, index) => {
      const head = [
        `[D${index + 1}] ${source.docKindLabel}${source.documentNumber ? ` N° ${source.documentNumber}` : ""}`,
        source.fecha ? `Fecha: ${source.fecha}` : null,
        source.asunto ? `Asunto: ${source.asunto}` : null,
        source.pageStart ? `Pág. ${source.pageStart}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${head}\n${source.excerpt}`;
    })
    .join("\n\n---\n\n");
}

// Responde preguntas en lenguaje natural fundamentando en los documentos del
// archivo. Si no hay fuentes, lo dice; no inventa. Cita con [D#].
export async function answerArchivoQuestion(input: ArchivoChatInput): Promise<ArchivoAnswer> {
  const sources = await searchArchivo({ query: input.query, docKind: input.docKind, topK: 8 });

  if (sources.length === 0) {
    return {
      answer: "No encontré información sobre esto en los documentos del archivo.",
      sources: [],
      sufficient: false,
    };
  }

  const openai = getOpenAIClient();
  const context = buildContext(sources);

  const response = await openai.responses.create({
    input: [
      {
        content: `Eres un asistente del archivo documental de una municipalidad. Responde la consulta del usuario USANDO SOLO la información de los documentos proporcionados (resoluciones, acuerdos, ordenanzas, oficios, informes).

Reglas:
- Usa únicamente lo que consta en los fragmentos. No inventes datos, fechas ni números.
- Cita la fuente con [D#] al final de cada afirmación sustantiva.
- Si la respuesta no está en los documentos, dilo claramente.
- Sé claro y conciso; menciona el número y la fecha del documento cuando sea relevante.

Documentos disponibles:
${context}

Consulta del usuario:
${input.query}`,
        role: "user",
      },
    ],
    max_output_tokens: 900,
    model: legalAnswerModel,
    temperature: 0.2,
  });

  return {
    answer: response.output_text.trim() || "No pude generar una respuesta a partir de los documentos.",
    sources,
    sufficient: true,
  };
}
