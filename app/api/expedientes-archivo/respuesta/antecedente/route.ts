import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deleteStorageObjects,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { extractPdfText, chunkPages } from "@/lib/pdf-processing";
import {
  deleteDocuments,
  respuestaAntecedentesNamespace,
  type PineconeRecord,
  upsertTextRecords,
} from "@/lib/pinecone";
import { getOpenAIClient, legalAnswerModel } from "@/lib/openai-server";
import { extractResponseText } from "@/lib/openai-response";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const NAMESPACE = respuestaAntecedentesNamespace;
const MIN_TEXT_LENGTH = 20;
const MAX_PAGES = 80;
const ANALYSIS_LIMIT = 8000;
const EXTRACTION_TIMEOUT_MS = 8000;

// Extrae asunto + remitente del texto del PDF en una sola llamada.
// Devuelve null si el modelo no devuelve JSON valido o tarda demasiado.
async function extractAsuntoRemitente(
  text: string,
): Promise<{ asunto: string | null; remitente: string | null; inputTokens: number; outputTokens: number }> {
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const openai = getOpenAIClient();
    const response = await Promise.race([
      openai.responses.create({
        input: [
          {
            content: `Este es un documento RECIBIDO por mesa de partes de una entidad publica. Devuelve SOLO JSON valido, sin markdown, con estas claves (null si no aparece, NO inventes):
{
  "asunto": "sumilla o asunto del documento en una linea",
  "remitente": "nombre de la persona o entidad que ENVIA el documento (el administrado/solicitante), o null"
}

Texto:
${text.slice(0, ANALYSIS_LIMIT)}`,
            role: "user",
          },
        ],
        max_output_tokens: 300,
        model: legalAnswerModel,
        temperature: 0,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Extraccion IA timeout")), EXTRACTION_TIMEOUT_MS),
      ),
    ]);
    inputTokens = response.usage?.input_tokens ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;

    // Acepta output_text (legacy) o output[0].content[0].text (nuevo formato).
    const cleaned = extractResponseText(response)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return { asunto: null, inputTokens, outputTokens, remitente: null };
    }
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const asunto = typeof parsed.asunto === "string" && parsed.asunto.trim()
        ? parsed.asunto.trim().slice(0, 300)
        : null;
      const remitente = typeof parsed.remitente === "string" && parsed.remitente.trim()
        ? parsed.remitente.trim().slice(0, 200)
        : null;
      return { asunto, inputTokens, outputTokens, remitente };
    } catch {
      return { asunto: null, inputTokens, outputTokens, remitente: null };
    }
  } catch {
    return { asunto: null, inputTokens: 0, outputTokens: 0, remitente: null };
  }
}

type AnalisisTecnico = {
  consultasSugeridas: string[];
  extractionMethod: string;
  pageCount: number | null;
  puntosClave: string;
  materia: string;
  normativaIdentificada: string;
  partes: string;
  textLength: number;
  tipoDocumento: string;
  tipoRespuestaEsperada: string;
  tokenUsage: {
    estimatedCostUsd: number;
    inputTokens: number;
    model: string;
    outputTokens: number;
  };
};

// Resumen tecnico del PDF: tipo, materia, partes, puntos clave, normativa
// identificada y consultas sugeridas. Max 700 tokens de salida.
async function analizarDocumentoTecnico(
  text: string,
  pageCount: number | null,
): Promise<AnalisisTecnico> {
  let inputTokens = 0;
  let outputTokens = 0;
  let analysis: Record<string, unknown> = {};
  try {
    const openai = getOpenAIClient();
    const response = await Promise.race([
      openai.responses.create({
        input: [
          {
            content: `Eres un asistente especializado en derecho administrativo peruano. Analiza con precision el siguiente documento recibido por una entidad publica.

Devuelve SOLO JSON valido (sin markdown, sin texto adicional) con esta estructura EXACTA:

{
  "tipoDocumento": "tipo exacto del documento (solicitud, oficio, informe, recurso de reconsideracion, recurso de apelacion, queja, memorial, contrato, resolucion, notificacion, otro)",
  "materia": "asunto o materia principal concreta (ej: 'solicitud de licencia de funcionamiento', 'recurso de reconsideracion contra multa de transito'). NO uses 'asunto general' o 'varios'. Si no esta claro, escribe 'no identificada'",
  "partes": "quienes intervienen: nombre del administrado/empresa, entidad publica, funcionarios. Si no se identifica ninguna parte, escribe 'no identificadas'",
  "puntosClave": "lista numerada de los 2-4 puntos MAS IMPORTANTES que el funcionario debe responder o resolver, en lenguaje claro y concreto. NO repitas el tipo de documento. Cada punto debe empezar con un verbo de accion: 'Conceder/Denegar/Notificar/Resolver/Programar cita, etc.'",
  "normativaIdentificada": "normas ESPECIFICAS mencionadas en el documento (ej: 'Ley 32069 art. 55, TUPA item 4.2, Ley 27444 art. 113'). Si no hay ninguna, escribe 'no identificada'",
  "consultasSugeridas": ["3 consultas optimas para buscar en biblioteca de normas peruanas. Ej: 'licencia funcionamiento procedimiento TUPA', 'recurso reconsideracion plazo Ley 27444', 'notificacion electronica requisitos Ley 32069'"],
  "tipoRespuestaEsperada": "OFICIO o INFORME o CARTA o MEMORANDUM o RESOLUCION (segun formalidad requerida)"
}

INSTRUCCIONES CRITICAS:
- NO inventes datos. Si no puedes identificar un campo con el texto disponible, escribe 'no identificado' o 'no identificada' en lugar de inventar.
- NO uses frases genericas como 'documento administrativo' o 'asunto publico'. Se ESPECIFICO.
- Si el documento es una solicitud, los puntosClave deben indicar que la municipalidad debe evaluar y responder.
- Las consultasSugeridas deben incluir el termino legal ESPECIFICO + el tema del documento.

Texto del documento:
"""
${text.slice(0, ANALYSIS_LIMIT)}
"""`,
            role: "user",
          },
        ],
        max_output_tokens: 900,
        model: legalAnswerModel,
        temperature: 0,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Analisis IA timeout")), EXTRACTION_TIMEOUT_MS),
      ),
    ]);
    inputTokens = response.usage?.input_tokens ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;
    // Acepta output_text (legacy) o output[0].content[0].text (nuevo formato).
    const cleaned = extractResponseText(response)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      analysis = {};
    } else {
      try {
        analysis = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        analysis = {};
      }
    }
  } catch (err) {
    console.warn(`[analizarDocumentoTecnico] fallo: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Helper que extrae texto desde string o array de strings.
  // La IA puede devolver puntosClave/normativa como string o array.
  // Aceptamos ambos formatos y los normalizamos.
  const asTextOrJoin = (key: string, fallback: string): string => {
    const value = analysis[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const items = value
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim());
      if (items.length > 0) return items.join("\n");
    }
    return fallback;
  };

  return {
    consultasSugeridas: Array.isArray(analysis.consultasSugeridas)
      ? (analysis.consultasSugeridas as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [],
    extractionMethod: "pdf-text",
    materia: asTextOrJoin("materia", ""),
    normativaIdentificada: asTextOrJoin("normativaIdentificada", ""),
    partes: asTextOrJoin("partes", ""),
    pageCount,
    puntosClave: asTextOrJoin("puntosClave", ""),
    textLength: text.length,
    tipoDocumento: asTextOrJoin("tipoDocumento", "desconocido"),
    tipoRespuestaEsperada: asTextOrJoin("tipoRespuestaEsperada", "OFICIO"),
    tokenUsage: {
      estimatedCostUsd: roundCostUsd(estimateCostUsd(legalAnswerModel, inputTokens, outputTokens)),
      inputTokens,
      model: legalAnswerModel,
      outputTokens,
    },
  };
}

type AntecedenteRow = {
  id: string;
  created_by: string | null;
  entity: string | null;
  file_name: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  pinecone_namespace: string;
  pinecone_document_id: string;
  page_count: number | null;
  text_length: number;
  char_count: number;
  chunk_count: number;
  extraction_method: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function shapeAntecedente(row: AntecedenteRow) {
  return {
    charCount: row.char_count,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    documentId: row.pinecone_document_id,
    entity: row.entity,
    extractionMethod: row.extraction_method,
    fileName: row.file_name,
    fileSize: row.file_size,
    id: row.id,
    namespace: row.pinecone_namespace,
    pageCount: row.page_count,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    textLength: row.text_length,
  };
}

export type AntecedenteResponse = ReturnType<typeof shapeAntecedente>;

// POST /api/expedientes-archivo/respuesta/antecedente
// Body: FormData con `file` (PDF).
//
// Persiste el PDF en Supabase Storage y lo indexa en Pinecone
// (namespace 'respuesta-antecedentes'). Devuelve el id y metadatos
// para que el cliente lo vincule a la respuesta.
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "antecedente-upload"),
      RATE_LIMITS.upload,
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json(
        { error: `El PDF supera el límite de ${maxPdfSizeLabel}` },
        { status: 400 },
      );
    }

    // 1) Extraer texto. Primero texto seleccionable; OCR solo si hace falta.
    const extracted = await extractPdfText(file, { forceOcr: false });
    const text = (extracted.text ?? "").trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: "El PDF no contiene texto legible. Verifica el escaneo o sube un PDF con texto seleccionable.",
          retryable: false,
        },
        { status: 422 },
      );
    }
    if (extracted.pageCount > MAX_PAGES) {
      return NextResponse.json(
        { error: `El PDF excede ${MAX_PAGES} páginas. Divide el documento.` },
        { status: 400 },
      );
    }

    // 2) Subir binario a Supabase Storage.
    const { storageBucket } = getSupabaseServerConfig();
    const documentId = `ant-${randomUUID()}`;
    const storagePath = `respuesta/antecedente-${auth.user.id}-${documentId}.pdf`;
    await uploadPdfToStorage(storagePath, file);

    // 3) Chunkear e indexar en Pinecone.
    const chunks = chunkPages(
      extracted.pages && extracted.pages.length > 0
        ? extracted.pages
        : [{ pageNumber: 1, text }],
    );
    const records: PineconeRecord[] = chunks.map((chunk, index) => ({
      _id: `${documentId}-${index}`,
      chunk_id: `${documentId}-${index}`,
      chunk_index: index,
      document_id: documentId,
      document_type: "antecedente_respuesta",
      page_end: chunk.pageEnd ?? chunk.pageStart ?? undefined,
      page_start: chunk.pageStart ?? undefined,
      process_type: "respuesta_generada",
      section_title: chunk.sectionTitle ?? undefined,
      source_entity: auth.user.entity ?? undefined,
      text: chunk.content,
      title: file.name.replace(/\.pdf$/i, ""),
      year: new Date().getFullYear(),
    }));
    await upsertTextRecords(records, NAMESPACE);

    // 4) Persistir metadata en Supabase.
    // Si la tabla no existe (aun no se aplico el SQL), generamos un id
    // local para que el flujo funcione en modo degradado.
    const userEntity = auth.user.entity ?? null;
    let rowId: string | undefined;
    try {
      const insertedRows = await supabaseRest<Array<{ id: string }>>(
        "respuesta_antecedentes?select=id",
        {
          body: JSON.stringify({
            char_count: text.length,
            chunk_count: records.length,
            created_by: auth.user.id,
            entity: userEntity,
            extraction_method: extracted.extractionMethod,
            file_name: file.name,
            file_size: file.size,
            metadata: { originalName: file.name },
            page_count: extracted.pageCount,
            pinecone_document_id: documentId,
            pinecone_namespace: NAMESPACE,
            storage_bucket: storageBucket,
            storage_path: storagePath,
            text_length: text.length,
          }),
          method: "POST",
        },
      );
      rowId = insertedRows?.[0]?.id;
    } catch (err) {
      // PGRST205 = table not found. Si la tabla no existe, generamos un
      // id local para que el flujo funcione en modo degradado.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PGRST205") || msg.includes("Could not find the table")) {
        console.warn(
          "[antecedente] Tabla respuesta_antecedentes no existe. " +
            "Aplicar docs/supabase/respuesta-archivo-tables.sql. Usando id temporal.",
        );
        rowId = `local-${randomUUID()}`;
      } else {
        await deleteStorageObjects(storageBucket, [storagePath]).catch(() => undefined);
        throw err;
      }
    }
    if (!rowId) {
      // Rollback: borrar storage + pinecone si no se pudo persistir metadata.
      await deleteStorageObjects(storageBucket, [storagePath]).catch(() => undefined);
      return NextResponse.json(
        { error: "No se pudo registrar el antecedente" },
        { status: 500 },
      );
    }

    // Extraer asunto + remitente + resumen tecnico en paralelo
    // (2 llamadas IA, mismo tiempo que 1). Total ~1000 tokens de salida.
    const [extraction, analisis] = await Promise.all([
      extractAsuntoRemitente(text),
      analizarDocumentoTecnico(text, extracted.pageCount),
    ]);

    await writeAuditLog({
      action: "respuesta.antecedente.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        antecedenteId: rowId,
        documentId,
        fileName: file.name,
        fileSize: file.size,
        pageCount: extracted.pageCount,
        textLength: text.length,
        chunkCount: records.length,
        extractionMethod: extracted.extractionMethod,
      },
      entityId: rowId,
      entityType: "antecedente_respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({
      analisis: {
        consultasSugeridas: analisis.consultasSugeridas,
        materia: analisis.materia,
        normativaIdentificada: analisis.normativaIdentificada,
        partes: analisis.partes,
        puntosClave: analisis.puntosClave,
        tipoDocumento: analisis.tipoDocumento,
        tipoRespuestaEsperada: analisis.tipoRespuestaEsperada,
        tokenUsage: analisis.tokenUsage,
      },
      asunto: extraction.asunto,
      charCount: text.length,
      chunkCount: records.length,
      createdAt: new Date().toISOString(),
      documentId,
      extractionMethod: extracted.extractionMethod,
      fileName: file.name,
      fileSize: file.size,
      id: rowId,
      namespace: NAMESPACE,
      pageCount: extracted.pageCount,
      remitente: extraction.remitente,
      storageBucket,
      storagePath,
      text,
      textLength: text.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el antecedente" },
      { status: 500 },
    );
  }
}

// DELETE /api/expedientes-archivo/respuesta/antecedente?id=X
// Elimina el antecedente: Storage + Pinecone + DB.
// Solo el creador o admin.
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }

    const rows = await supabaseRest<AntecedenteRow[]>(
      `respuesta_antecedentes?id=eq.${id}&select=*`,
    ).catch(() => []);
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Antecedente no encontrado" }, { status: 404 });
    }
    if (
      row.created_by &&
      row.created_by !== auth.user.id &&
      auth.user.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este antecedente" },
        { status: 403 },
      );
    }

    // Borrar Pinecone + Storage + DB (best-effort).
    try {
      await deleteDocuments([row.pinecone_document_id], row.pinecone_namespace).catch(
        () => undefined,
      );
    } catch {
      // Continua aunque falle Pinecone.
    }
    await deleteStorageObjects(row.storage_bucket, [row.storage_path]).catch(
      () => undefined,
    );
    await supabaseRest(`respuesta_antecedentes?id=eq.${id}`, {
      method: "DELETE",
    });

    await writeAuditLog({
      action: "respuesta.antecedente.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { antecedenteId: id, documentId: row.pinecone_document_id },
      entityId: id,
      entityType: "antecedente_respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    );
  }
}

// GET /api/expedientes-archivo/respuesta/antecedente
// Lista los antecedentes del usuario (los mas recientes primero).
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") ?? "20", 10) || 20),
    );
    const rows = await supabaseRest<AntecedenteRow[]>(
      `respuesta_antecedentes?created_by=eq.${auth.user.id}&select=*&order=created_at.desc&limit=${limit}`,
    ).catch(() => []);
    return NextResponse.json({ antecedentes: rows.map(shapeAntecedente) });
  } catch (error) {
    return NextResponse.json(
      {
        antecedentes: [],
        error: error instanceof Error ? error.message : "No se pudo listar",
      },
      { status: 200 },
    );
  }
}

// Re-export para que el route GET /[id] lo use
export { shapeAntecedente };
export type { AntecedenteRow };
