import { classifyPdfError } from "./pdf-read-error";
import { ArchivoProcessingBusyError, claimArchivoProcessing } from "./archivo-processing-lease";
import { createHash, randomUUID } from "node:crypto";
import { normalizeEntity } from "./entity-utils";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { estimateCostUsd, roundCostUsd } from "./openai-cost";
import { embedTexts } from "./embeddings";
import { supabaseRest, writeAuditLog } from "./supabase-server";
import {
  type PineconeRecord,
  deleteRecords,
  upsertTextRecords,
  verifyDocumentIndexedInPinecone,
} from "./pinecone";
import { type ExtractedPdfText, chunkPages, extractPdfText } from "./pdf-processing";
import {
  type ExpedienteArchivo,
  extractAsunto,
  extractExpedienteNumber,
  extractFecha,
  extractSerieDocumental,
  getExpedientesNamespace,
} from "./expedientes-archivo";

const minExtractedTextLength = 120;
const analysisTextLimit = 14000;

// Uso de tokens agregado de un expediente (OCR + análisis semántico). Los
// embeddings (text-embedding-3-small) se omiten: su coste es despreciable.
type ExpedienteTokenUsage = {
  ocr: { model: string; inputTokens: number; outputTokens: number; fromCache: boolean } | null;
  analysis: { model: string; inputTokens: number; outputTokens: number } | null;
  totalTokens: number;
  estimatedCostUsd: number;
};

// Extrae el texto del PDF con CACHE por hash del contenido. Evita re-OCR (el paso
// caro: gpt-4o visión) cuando el mismo PDF ya se procesó (autocompletar /extract,
// indexado, reindex, drainer). Solo cachea resultados de OCR (el texto nativo es
// barato de re-extraer). Si la cache falla, degrada a extracción directa.
async function extractPdfTextCached(
  file: File,
  // `skipCache`: la visión del OCR no es 100% determinista — la misma imagen
  // puede leerse bien una vez y mal otra (verificado: un reintento manual dio
  // texto limpio donde una corrida anterior había devuelto solo fragmentos
  // sueltos). Ese resultado malo, si superaba el umbral de caracteres, quedaba
  // cacheado PARA SIEMPRE y ningún reintento manual lo podía superar. El botón
  // "Volver a analizar" pasa `skipCache: true` para forzar una lectura fresca.
  options: { forceOcr?: boolean; skipCache?: boolean; ocrMaxPages?: number } = {},
): Promise<ExtractedPdfText> {
  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()));
  const hash = createHash("sha256").update(bytes).digest("hex");

  if (!options.skipCache) {
    const cached = await supabaseRest<
      Array<{ extracted: ExtractedPdfText; input_tokens: number; output_tokens: number; model: string | null }>
    >(
      `expedientes_ocr_cache?file_hash=eq.${hash}&select=extracted,input_tokens,output_tokens,model&limit=1`,
    ).catch(() => []);

    const hit = cached[0];
    if (hit?.extracted && (hit.extracted.text?.length ?? 0) >= minExtractedTextLength) {
      return {
        ...hit.extracted,
        usage: {
          fromCache: true,
          inputTokens: hit.input_tokens,
          model: hit.model ?? hit.extracted.usage?.model ?? "",
          outputTokens: hit.output_tokens,
        },
      };
    }
  }

  const extracted = await extractPdfText(file, options);

  if (!options.ocrMaxPages && extracted.extractionMethod === "openai-ocr" && extracted.text.length >= minExtractedTextLength) {
    await supabaseRest("expedientes_ocr_cache", {
      body: JSON.stringify({
        extracted,
        extraction_method: extracted.extractionMethod,
        file_hash: hash,
        input_tokens: extracted.usage?.inputTokens ?? 0,
        model: extracted.usage?.model ?? null,
        output_tokens: extracted.usage?.outputTokens ?? 0,
        page_count: extracted.pageCount,
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      method: "POST",
    }).catch(() => undefined);
  }

  return extracted;
}

type ExpedienteChunkInsert = {
  documento_id: string;
  expediente_id: string | null;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};

type ExpedienteInsights = {
  asunto: string | null;
  materia: string | null;
  resumen: string | null;
  tipoDocumento: string | null;
  serieDocumental: string | null;
  oficina: string | null;
  personaNombre: string | null;
  personaTipo: "natural" | "juridica" | null;
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

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Extrae con la IA los campos semánticos del expediente y los asigna a los campos
// del formulario (asunto, materia, resumen, tipo de documento, oficina y persona
// interesada). Devuelve nulls si falla (los datos del usuario y los extractores
// deterministas mandan).
type AnalysisUsage = { model: string; inputTokens: number; outputTokens: number };
type AnalysisResult = { insights: ExpedienteInsights; usage: AnalysisUsage; warning?: string };

const emptyInsights: ExpedienteInsights = {
  asunto: null,
  materia: null,
  resumen: null,
  tipoDocumento: null,
  serieDocumental: null,
  oficina: null,
  personaNombre: null,
  personaTipo: null,
};

async function analyzeExpedienteWithAi(text: string): Promise<AnalysisResult> {
  const usage: AnalysisUsage = { inputTokens: 0, model: legalAnswerModel, outputTokens: 0 };
  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      input: [
        {
          content: `Analiza este EXPEDIENTE / DOCUMENTO administrativo terminado de una entidad pública.

Devuelve SOLO JSON válido, sin markdown, con estas claves (usa null si no aparece en el texto, NO inventes):
{
  "asunto": "asunto o sumilla en una línea (lo que trata/resuelve)",
  "materia": "materia o tema general (ej: contratación, personal, presupuesto, tránsito)",
  "resumen": "resumen ejecutivo de 3 a 5 líneas de lo que contiene el expediente",
  "tipoDocumento": "EXACTAMENTE uno de: Resolución, Oficio, Decreto, Ordenanza, Informe, Memorando, Carta, Otro",
  "serieDocumental": "denominación oficial COMPLETA del documento tal como aparece LITERAL en su encabezado, con el tipo y el número juntos (ej: 'RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A', 'OFICIO MÚLTIPLE N° 012-2024-MDCH-A', 'ORDENANZA MUNICIPAL N° 005-2024-MDCH'). Cópiala EXACTA del texto respetando el tipo completo, 'N°' y el número íntegro; NO la inventes ni abrevies. null si no aparece.",
  "oficina": "oficina, gerencia o área de la entidad que emite el documento, o null",
  "personaNombre": "nombre completo de la persona natural o razón social de la empresa ADMINISTRADA/INTERESADA (el ciudadano o empresa del trámite, NUNCA la entidad pública ni un funcionario que firma), o null",
  "personaTipo": "natural si personaNombre es una persona; juridica si es empresa/organización; null si no hay persona interesada"
}

Texto:
${text.slice(0, analysisTextLimit)}`,
          role: "user",
        },
      ],
      max_output_tokens: 700,
      model: legalAnswerModel,
      temperature: 0,
    }, { timeout: 45_000, maxRetries: 0 });
    usage.inputTokens = response.usage?.input_tokens ?? 0;
    usage.outputTokens = response.usage?.output_tokens ?? 0;
    const parsed = parseJsonObject(response.output_text);
    if (Object.keys(parsed).length === 0) {
      throw new Error("La IA no devolvió JSON válido");
    }
    const personaTipo =
      parsed.personaTipo === "natural" || parsed.personaTipo === "juridica"
        ? parsed.personaTipo
        : null;
    return {
      insights: {
        asunto: asText(parsed.asunto),
        materia: asText(parsed.materia),
        resumen: asText(parsed.resumen),
        tipoDocumento: asText(parsed.tipoDocumento),
        serieDocumental: asText(parsed.serieDocumental),
        oficina: asText(parsed.oficina),
        personaNombre: asText(parsed.personaNombre),
        personaTipo,
      },
      usage,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] analyzeExpedienteWithAi fallo: ${message}`);
    return {
      insights: { ...emptyInsights },
      warning: "La IA no pudo analizar el documento. Se muestran solo los datos básicos detectados; puedes reintentar.",
      usage,
    };
  }
}

function buildExpedienteEmbeddingText(input: {
  title: string;
  sgdExpediente: string | null;
  serieDocumento: string | null;
  tipoDocumento: string | null;
  oficina: string | null;
  asunto: string | null;
  materia: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}) {
  const header = [
    `Expediente: ${input.title}`,
    input.sgdExpediente ? `Nº SGD: ${input.sgdExpediente}` : null,
    input.serieDocumento ? `Serie documento: ${input.serieDocumento}` : null,
    input.tipoDocumento ? `Tipo: ${input.tipoDocumento}` : null,
    input.oficina ? `Oficina: ${input.oficina}` : null,
    input.materia ? `Materia: ${input.materia}` : null,
    input.asunto ? `Asunto: ${input.asunto}` : null,
    input.pageStart
      ? input.pageEnd && input.pageEnd !== input.pageStart
        ? `Páginas: ${input.pageStart}-${input.pageEnd}`
        : `Página: ${input.pageStart}`
      : null,
  ].filter(Boolean);

  return `${header.join("\n")}\n\nTexto del expediente:\n${input.content}`;
}

// Procesa un expediente archivado: extrae texto (OCR vía extractPdfText), detecta
// número/fecha/asunto, fragmenta por páginas, indexa en el namespace AISLADO de
// expedientes en Pinecone y persiste chunks + metadata. Estado: processing -> indexed/error.
export async function processExpedienteDocument(expediente: ExpedienteArchivo, file: File, prepared?: ExtractedPdfText) {
  // El worker por bloques ya tiene su reserva. Los otros caminos (subida,
  // reindexación, recuperación y reemplazo) compiten por el mismo CAS.
  if (!prepared) {
    const previousStatus = expediente.status;
    const claimed = await claimArchivoProcessing(expediente);
    // El reemplazo trae una ruta nueva todavía no publicada: conservarla.
    expediente = { ...expediente, updated_at: claimed.updated_at, status: "processing" };
    // Conserva un índice publicado si falla el intento de reemplazarlo.
    if (previousStatus === "indexed") expediente = { ...expediente, status: "indexed" };
  }
  const namespace = getExpedientesNamespace();
  let insertedVectorIds: string[] = [];
  let published = false;
  let publicationAttempted = false;
  const generation = randomUUID();

  try {
    // forceOcr: los expedientes archivados suelen ser escaneados sin capa de texto;
    // el OCR es el camino normal aquí (no depende del flag global del corpus legal).
    // extractPdfTextCached reusa el OCR si este PDF ya se procesó (autocompletar,
    // indexado previo, reindex) en vez de volver a gastar gpt-4o.
    const extracted = prepared ?? await extractPdfTextCached(file, { forceOcr: true });
    const text = extracted.text;

    if (text.length < minExtractedTextLength) {
      throw new Error(
        "No se pudo extraer texto suficiente del PDF ni con OCR. El expediente parece ilegible, está en blanco o es de muy baja calidad de escaneo.",
      );
    }

    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new Error("El PDF no contiene suficiente texto para indexar");
    }

    const { insights, usage: analysisUsage } = await analyzeExpedienteWithAi(text);

    // Consumo de IA del expediente: OCR (reutilizado de cache o recién gastado) +
    // análisis semántico. Sirve para estimar el coste por subida.
    const tokenUsage: ExpedienteTokenUsage = (() => {
      const ocr = extracted.usage
        ? {
            fromCache: extracted.usage.fromCache ?? false,
            inputTokens: extracted.usage.inputTokens,
            model: extracted.usage.model,
            outputTokens: extracted.usage.outputTokens,
          }
        : null;
      const analysis = {
        inputTokens: analysisUsage.inputTokens,
        model: analysisUsage.model,
        outputTokens: analysisUsage.outputTokens,
      };
      const totalTokens =
        (ocr ? ocr.inputTokens + ocr.outputTokens : 0) + analysis.inputTokens + analysis.outputTokens;
      const estimatedCostUsd =
        (ocr ? estimateCostUsd(ocr.model, ocr.inputTokens, ocr.outputTokens) : 0) +
        estimateCostUsd(analysis.model, analysis.inputTokens, analysis.outputTokens);
      return { analysis, estimatedCostUsd: roundCostUsd(estimatedCostUsd), ocr, totalTokens };
    })();

    // El dato del usuario manda; si no lo dio, se usa lo detectado (regex de
    // la cabecera) o la IA. sgd_expediente es MANUAL (N° del sistema
    // documental externo): nunca se autocompleta, solo se persiste lo que el
    // usuario haya escrito.
    const sgdExpediente = asText(expediente.sgd_expediente);
    // Serie documental = denominación oficial literal del documento (ej.
    // "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A"). Prioridad: lo que puso el
    // usuario > la cabecera detectada por regex (fiable, mismo criterio que
    // extractExpedienteInventory) > lo que la IA leyó LITERAL > fallback
    // compuesto tipo + número detectado por regex.
    const serieDetectada = extractSerieDocumental(text);
    const tipoDocumento =
      asText(expediente.tipo_documento) ?? serieDetectada?.tipoDocumento ?? insights.tipoDocumento;
    const numeroDetectado = extractExpedienteNumber(expediente.title, text);
    const serieDocumento =
      asText(expediente.serie_documento) ??
      serieDetectada?.serie ??
      insights.serieDocumental ??
      (numeroDetectado ? [tipoDocumento, numeroDetectado].filter(Boolean).join(" ") : null);
    const oficina = asText(expediente.oficina) ?? insights.oficina;
    const fecha = extractFecha(text);
    const asunto = asText(expediente.asunto) ?? insights.asunto;
    const materia = asText(expediente.materia) ?? insights.materia;
    const resumen = asText(expediente.resumen) ?? insights.resumen;
    const anio =
      expediente.anio ??
      serieDetectada?.anio ??
      (fecha ? Number.parseInt(fecha.slice(0, 4), 10) : undefined);

    const chunkRows: ExpedienteChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      documento_id: expediente.id,
      expediente_id: expediente.expediente_id,
      metadata: {
        serieDocumento,
        anio: Number.isFinite(anio) ? anio : null,
        materia,
        tipoDocumento,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      },
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
      pinecone_vector_id: `expediente::${expediente.id}::${generation}::${chunk.index}`,
    }));

    const insertedChunks = chunkRows.map((chunk) => ({ ...chunk, id: randomUUID() }));

    const records: PineconeRecord[] = insertedChunks.map((chunk) => ({
      _id: chunk.pinecone_vector_id,
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      document_id: expediente.id,
      index_generation: generation,
      document_number: serieDocumento ?? undefined,
      document_type: "expediente",
      page_end: chunk.page_end ?? undefined,
      page_start: chunk.page_start ?? undefined,
      source_entity: normalizeEntity(oficina) || undefined,
      source_role: "expediente-archivo",
      status: "indexed",
      text: buildExpedienteEmbeddingText({
        asunto,
        content: chunk.content,
        materia,
        oficina,
        pageEnd: chunk.page_end,
        pageStart: chunk.page_start,
        serieDocumento,
        sgdExpediente,
        tipoDocumento,
        title: expediente.title,
      }),
      title: expediente.title,
      topic: asunto ?? materia ?? undefined,
      year: Number.isFinite(anio) ? (anio as number) : undefined,
    }));
    insertedVectorIds = records.map((record) => record._id);

    // Embeddings para pgvector (ver docs/supabase/expedientes-archivo-
    // pgvector.sql), del MISMO texto enriquecido que se manda a Pinecone
    // (records[].text: incluye asunto/materia/serie, no solo el chunk pelado),
    // para que la calidad de la búsqueda no cambie al pasar de un índice a
    // otro. Pinecone sigue escribiéndose en paralelo mientras se confirma que
    // esta migración funciona bien en producción — ver la nota en el .sql.
    const chunkEmbeddings = await embedTexts(records.map((record) => record.text));
    const insertedChunksConEmbedding = insertedChunks.map((chunk, index) => ({
      ...chunk,
      embedding: chunkEmbeddings[index] ?? null,
    }));

    const upsert = await upsertTextRecords(records, namespace, chunkEmbeddings);
    const verification = await verifyDocumentIndexedInPinecone({
      documentId: expediente.id,
      indexGeneration: generation,
      expectedMinRecords: records.length,
      namespace,
      query: [expediente.title, serieDocumento, sgdExpediente, asunto, materia]
        .filter(Boolean)
        .join(" "),
    });

    if (!verification.verified) throw new Error("No se pudo verificar el índice nuevo. Se conserva la versión anterior.");
    const patch = {
        file_name: expediente.file_name, file_size: expediente.file_size,
        mime_type: expediente.mime_type, storage_bucket: expediente.storage_bucket, storage_path: expediente.storage_path,
        anio: Number.isFinite(anio) ? anio : null,
        asunto,
        body_text: text.slice(0, 200000),
        // Folios = nº de páginas del PDF. Backfill si el usuario no lo puso a mano
        // (cubre subidas sin auto-análisis); no pisa un valor existente.
        folio:
          asText(expediente.folio) ??
          (extracted.pageCount > 0 ? String(extracted.pageCount) : null),
        materia,
        tipo_documento: tipoDocumento,
        oficina,
        metadata: {
          ...expediente.metadata,
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
          textLength: text.length,
          tokenUsage,
        },
        serie_documento: serieDocumento,
        resumen,
        status: "indexed",
      };
    publicationAttempted = true;
    const result = await supabaseRest<{ oldVectorIds: string[] }>("rpc/archivo_publicar_indice", {
      method: "POST",
      body: JSON.stringify({
        p_id: expediente.id,
        p_base: expediente.updated_at,
        p_chunks: insertedChunksConEmbedding,
        p_patch: patch,
      }),
    });
    published = true;
    await deleteRecords(result.oldVectorIds, namespace).catch((error) => console.error("[archivo] limpieza de índice anterior", error));

    // Registro de consumo de IA (para agregar gasto por periodo si se necesita).
    await writeAuditLog({
      action: "expedientes.tokens",
      actorReference: expediente.uploaded_by ?? "system",
      details: { ...tokenUsage, expedienteId: expediente.id, pageCount: extracted.pageCount },
      entityId: expediente.id,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    }).catch(() => undefined);

    return {
      chunkCount: chunks.length,
      pageCount: extracted.pageCount,
      textLength: text.length,
      tokenUsage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error procesando expediente";
    // Un fallo de red al publicar puede ocurrir después del commit. No borrar a ciegas.
    if (!published && !publicationAttempted) await deleteRecords(insertedVectorIds, namespace).catch(() => undefined);
    if (!published) await reportArchivoProcessingFailure(expediente, errorMessage);
    throw error;
  }
}

// Extrae informacion del PDF para autocompletar el formulario de registro
// del archivo fisico. No guarda nada ni indexa; solo devuelve los datos
// detectados (numero/fecha/asunto/materia/remitente/destinatario/resumen/folios).
export type ExpedienteInventory = {
  warnings?: string[];
  ocrPartial?: boolean;
  analysisPartial?: boolean;
  numeroExpediente: string | null;
  serieDocumental: string | null;
  fecha: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  tipoDocumento: string | null;
  oficina: string | null;
  personaNombre: string | null;
  personaTipo: "natural" | "juridica" | null;
  resumen: string | null;
  nroFolios: number | null;
  extractionMethod: "ai" | "deterministic" | "hybrid" | "none";
};

export async function extractExpedienteInventory(
  file: File,
  titleHint: string = "",
  options: { skipCache?: boolean } = {},
): Promise<ExpedienteInventory> {
  const inventory: ExpedienteInventory = {
    numeroExpediente: null,
    serieDocumental: null,
    fecha: null,
    anio: null,
    asunto: null,
    materia: null,
    tipoDocumento: null,
    oficina: null,
    personaNombre: null,
    personaTipo: null,
    resumen: null,
    nroFolios: null,
    extractionMethod: "none",
  };

  let extracted;
  try {
    // forceOcr: ver nota en processExpedienteDocument (expedientes escaneados).
    // Reutiliza una lectura previa si existe. Para identificar el documento basta
    // una lectura inicial acotada; no se almacena en la caché usada por el índice.
    extracted = await extractPdfTextCached(file, { forceOcr: true, skipCache: options.skipCache, ocrMaxPages: 3 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[expedientes] extractPdfText fallo: ${message}`);
    throw classifyPdfError(err);
  }

  const text = extracted.text ?? "";
  inventory.ocrPartial = extracted.ocrPartial;
  inventory.analysisPartial = text.length > analysisTextLimit;
  inventory.warnings = [];
  if (extracted.ocrPartial) inventory.warnings.push(`Lectura parcial: se procesaron ${extracted.pages.length} de ${extracted.pageCount} páginas.`);
  if (inventory.analysisPartial) inventory.warnings.push(`El análisis usa los primeros ${analysisTextLimit} caracteres del texto.`);

  // Folios = nº de páginas del PDF subido (no el "nº de folios" que pudiera
  // mencionar el texto). Se conoce del parseo del PDF aunque el OCR falle.
  if (extracted.pageCount > 0) {
    inventory.nroFolios = extracted.pageCount;
  }

  // Diagnóstico: antes solo se avisaba cuando el texto era CASI nulo (<50
  // chars); un caso intermedio (OCR "exitoso" pero con texto insuficiente o
  // basura — p. ej. una capa de OCR de baja calidad ya embebida por el propio
  // escáner) quedaba invisible: la IA corría, no encontraba nada útil y el
  // usuario solo veía "sin datos" sin ninguna pista de por qué.
  console.info(
    `[expedientes] extractExpedienteInventory: método=${extracted.extractionMethod}, texto=${text.length} chars, folios=${extracted.pageCount}, lecturaParcial=${extracted.ocrPartial}`,
  );

  if (text.length < 50) {
    console.warn(
      `[expedientes] PDF con poco texto (${text.length} chars). Probable escaneado sin OCR.`,
    );
    return inventory;
  }

  // Extractores deterministas
  const numero = extractExpedienteNumber(titleHint, text);
  if (numero) {
    inventory.numeroExpediente = numero;
    inventory.extractionMethod = "deterministic";
  }
  const fecha = extractFecha(text);
  if (fecha) {
    inventory.fecha = fecha;
    const yearMatch = fecha.match(/^(\d{4})-/);
    if (yearMatch) {
      inventory.anio = Number.parseInt(yearMatch[1], 10);
    }
    inventory.extractionMethod = "deterministic";
  }
  // Serie documental: la denominación oficial de la cabecera ("RESOLUCIÓN N°
  // 004-2024-...", "INFORME N° 1555-2026-...") sigue un patrón fijo del
  // formato municipal, así que se detecta con regex ANTES de preguntarle a la
  // IA — más fiable que el modelo (nunca falla por límite de tokens ni
  // alucina el número) y de paso da gratis el tipo de documento y el año
  // (el número de la cabecera trae su propio año: "004-2024").
  const serieDetectada = extractSerieDocumental(text);
  if (serieDetectada) {
    inventory.serieDocumental = serieDetectada.serie;
    inventory.tipoDocumento = serieDetectada.tipoDocumento;
    if (serieDetectada.anio) inventory.anio = serieDetectada.anio;
    inventory.extractionMethod = "deterministic";
  }
  // Asunto: el rótulo "ASUNTO :" de la cabecera es tan fijo como el de la
  // serie documental — se detecta con regex por el mismo motivo (más fiable
  // que la IA, nunca alucina) antes de dejárselo al modelo.
  const asuntoDetectado = extractAsunto(text);
  if (asuntoDetectado) {
    inventory.asunto = asuntoDetectado;
    inventory.extractionMethod = "deterministic";
  }

  // IA para campos semanticos
  const { insights, warning } = await analyzeExpedienteWithAi(text);
  if (warning) inventory.warnings.push(warning);
  if (!inventory.asunto && insights.asunto) inventory.asunto = insights.asunto;
  if (insights.materia) inventory.materia = insights.materia;
  if (!inventory.tipoDocumento && insights.tipoDocumento) inventory.tipoDocumento = insights.tipoDocumento;
  if (!inventory.serieDocumental && insights.serieDocumental) inventory.serieDocumental = insights.serieDocumental;
  if (insights.oficina) inventory.oficina = insights.oficina;
  if (insights.personaNombre) inventory.personaNombre = insights.personaNombre;
  if (insights.personaTipo) inventory.personaTipo = insights.personaTipo;
  if (insights.resumen) inventory.resumen = insights.resumen;

  if (insights.asunto || insights.materia || insights.resumen) {
    inventory.extractionMethod = inventory.extractionMethod === "deterministic" ? "hybrid" : "ai";
  }

  return inventory;
}

export async function reportArchivoProcessingFailure(expediente: ExpedienteArchivo, error: unknown) {
  if (error instanceof ArchivoProcessingBusyError) return;
  const message = error instanceof Error ? error.message : String(error);
  // CAS: un trabajo viejo no puede marcar como fallido un índice recién publicado.
  await supabaseRest(`expedientes_archivo?id=eq.${expediente.id}&updated_at=eq.${encodeURIComponent(expediente.updated_at)}`, {
    method: "PATCH", body: JSON.stringify({ error_message: message, status: expediente.status === "indexed" ? "indexed" : "error" }),
  });
}
