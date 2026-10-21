import { containsExactNumber, searchArchivoExactNumbers } from "./archivo-exact-search";
import { normalizeEntity } from "./entity-utils";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { checkCitationFaithfulness } from "./citation-faithfulness";
import { type SearchFilters, searchTextRecords } from "./pinecone";
import { buscarVecinosPgvector } from "./expedientes-archivo-vectors";
import { supabaseRest } from "./supabase-server";
import { contenedorTipoLabel, getExpedientesNamespace } from "./expedientes-archivo";
import { type ExpedienteChatInput, type ExpedienteSearchInput } from "./expedientes-archivo-schema";

// Ubicación física del expediente (dónde está en papel).
export type ExpedienteUbicacion = {
  tipoAlmacenamiento: string;
  tipoAlmacenamientoLabel: string;
  nroArchivador: string | null;
  nroPaquete: string | null;
  empastado: boolean | null;
  color: string | null;
  nroEstante: string | null;
  nroPiso: string | null;
  nroLocal: string | null;
  folio: string | null;
};

export type ExpedienteSearchResult = {
  expedienteId: string;
  sgdExpediente: string | null;
  serieDocumento: string | null;
  tipoDocumento: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  anio: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
  score: number;
  storagePath: string | null;
  storageBucket: string | null;
  citation: string;
  ubicacion: ExpedienteUbicacion;
  ubicacionResumen: string;
};

type ChunkRow = { id: string; content: string };
type ExpRow = {
  id: string;
  uploaded_by: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  anio: number | null;
  sgd_expediente: string | null;
  serie_documento: string | null;
  tipo_documento: string | null;
  oficina: string | null;
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  folio: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
};

const EXP_SELECT =
  "id,uploaded_by,title,asunto,materia,anio,sgd_expediente,serie_documento,tipo_documento,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,storage_path,storage_bucket";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Arma el resumen legible de la ubicación física:
// "Archivador 12 (rojo) · Estante 3 · Piso 2 · Local A · folio 120".
function buildUbicacion(exp?: ExpRow): { ubicacion: ExpedienteUbicacion; resumen: string } {
  const tipo = exp?.tipo_almacenamiento ?? "otros";
  const ubicacion: ExpedienteUbicacion = {
    tipoAlmacenamiento: tipo,
    tipoAlmacenamientoLabel: contenedorTipoLabel(tipo),
    nroArchivador: exp?.nro_archivador ?? null,
    nroPaquete: exp?.nro_paquete ?? null,
    empastado: exp?.empastado ?? null,
    color: exp?.color_archivador ?? null,
    nroEstante: exp?.nro_estante ?? null,
    nroPiso: exp?.nro_piso ?? null,
    nroLocal: exp?.nro_local ?? null,
    folio: exp?.folio ?? null,
  };

  const contenedor = [
    contenedorTipoLabel(tipo),
    ubicacion.nroArchivador ?? ubicacion.nroPaquete ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  const resumen = [
    contenedor || null,
    ubicacion.color ? `(${ubicacion.color})` : null,
    ubicacion.nroEstante ? `Estante ${ubicacion.nroEstante}` : null,
    ubicacion.nroPiso ? `Piso ${ubicacion.nroPiso}` : null,
    ubicacion.nroLocal ? `Local ${ubicacion.nroLocal}` : null,
    ubicacion.folio ? `folio ${ubicacion.folio}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { ubicacion, resumen: resumen || "Ubicación física no registrada" };
}

// Códigos EXACTOS mencionados en la consulta (3+ dígitos seguidos — "2956" en
// "busca el comprobante de pago nro 2956"). Sirve para el refinamiento de
// abajo: la búsqueda semántica sola no distingue bien documentos casi
// idénticos en forma (mismo formato de comprobante, mismo módulo SIAF) que
// solo cambian en el número.
export function extractExactCodes(query: string): string[] {
  // Un año expresamente indicado como fecha no es otro número de expediente.
  const withoutYears = query.replace(/\b(?:año|ano|del|de|en)\s+(?:el\s+)?(?:año\s+)?(?:19|20|21)\d{2}\b/gi, " ");
  return Array.from(new Set(withoutYears.match(/\d{3,}/g) ?? []));
}

// `uploadedBy` (scope "own"): limita los resultados a los expedientes subidos
// por ese usuario. Se aplica como post-filtro contra la fila de la BD; los hits
// cuyo expediente no se puede verificar se descartan.
//
// `accessToken`: si viene, se intenta PRIMERO la búsqueda nativa en pgvector
// (buscarVecinosPgvector, scopeada por RLS — ver docs/supabase/expedientes-
// archivo-pgvector.sql). Si la migración de SQL todavía no se aplicó, esa
// función devuelve null y se cae a Pinecone sin que la búsqueda se rompa.
// Sin `accessToken` (llamador viejo, o ninguno disponible) va directo a
// Pinecone, como siempre.
export async function searchExpedientes(
  input: ExpedienteSearchInput & { uploadedBy?: string; accessToken?: string },
): Promise<ExpedienteSearchResult[]> {
  const namespace = getExpedientesNamespace();
  const filters: SearchFilters = {};
  if (input.documentId) filters.documentId = input.documentId;
  if (input.anio) filters.year = input.anio;
  const normalizedOficina = normalizeEntity(input.oficina);
  if (normalizedOficina) filters.sourceEntity = normalizedOficina;
  // Con filtros de metadata (oficina/materia/usuario) se traen más candidatos
  // porque el filtrado se hace después de recuperar (no es nativo de Pinecone
  // ni de la función de pgvector, que solo filtra document_id/year).
  const hasMetaFilter = Boolean(input.oficina || input.materia || input.uploadedBy);
  const topK = input.topK ?? (hasMetaFilter ? 24 : 8);
  const oficinaFilter = input.oficina?.toLowerCase().trim() || null;
  const materiaFilter = input.materia?.toLowerCase().trim() || null;

  const exactCodes = extractExactCodes(input.query);
  const exactHits = await searchArchivoExactNumbers(input, exactCodes);
  const pgvectorHits = exactHits === null && input.accessToken
    ? await buscarVecinosPgvector(input.accessToken, input.query, topK, {
        documentId: input.documentId,
        year: input.anio,
      })
    : null;

  // Normaliza al shape que ya esperaba el resto de la función (el de
  // searchTextRecords/Pinecone): _id/_score + chunk_id/document_id. Los
  // campos que solo vivían en metadata de Pinecone (document_number, title,
  // topic) quedan ausentes — el código de abajo ya prefiere el dato de
  // Supabase (`exp`) sobre el del hit en todos los casos que importan.
  const hits: Array<Record<string, unknown>> = exactHits ?? (pgvectorHits
    ? pgvectorHits.map((hit) => ({
        _id: hit.chunkId,
        _score: hit.score,
        chunk_id: hit.chunkId,
        chunk_index: hit.chunkIndex,
        document_id: hit.documentoId,
        page_end: hit.pageEnd ?? undefined,
        page_start: hit.pageStart ?? undefined,
      }))
    : await searchTextRecords(input.query, topK, filters, namespace));
  if (hits.length === 0) {
    return [];
  }

  const chunkIds = Array.from(
    new Set(hits.map((hit) => asString(hit.chunk_id)).filter(Boolean)),
  ) as string[];
  const expedienteIds = Array.from(
    new Set(hits.map((hit) => asString(hit.document_id)).filter(Boolean)),
  ) as string[];

  const [chunkRows, expRows] = await Promise.all([
    chunkIds.length > 0
      ? supabaseRest<ChunkRow[]>(
          `expedientes_archivo_chunks?id=in.(${chunkIds.map((id) => `"${id}"`).join(",")})&select=id,content`,
        )
      : Promise.resolve([]),
    expedienteIds.length > 0
      ? supabaseRest<ExpRow[]>(
          `expedientes_archivo?id=in.(${expedienteIds.map((id) => `"${id}"`).join(",")})&select=${EXP_SELECT}`,
        )
      : Promise.resolve([]),
  ]);

  const contentById = new Map(chunkRows.map((row) => [row.id, row.content]));
  const expById = new Map(expRows.map((row) => [row.id, row]));

  const results: ExpedienteSearchResult[] = [];
  for (const hit of hits) {
    const record = hit as Record<string, unknown>;
    const expedienteId = asString(record.document_id);
    if (!expedienteId) {
      continue;
    }
    const exp = expById.get(expedienteId);
    // Serie documental: la del hit (metadata de Pinecone) si la trae, si no la
    // de Supabase. Los hits de pgvector nunca traen document_number (ese campo
    // solo vivía en metadata de Pinecone), así que sin este fallback el
    // post-filtro de abajo quedaba mudo —nunca descartaba nada— al buscar por
    // esta vía.
    const hitNumber = asString(record.document_number) ?? exp?.serie_documento ?? null;
    // Post-filtro por serie documental (no es filtro nativo de Pinecone ni de
    // la función de pgvector).
    if (input.serieDocumento && hitNumber && !hitNumber.includes(input.serieDocumento)) {
      continue;
    }

    // Scope "own": solo expedientes subidos por el usuario (verificado en BD).
    if (input.uploadedBy && exp?.uploaded_by !== input.uploadedBy) {
      continue;
    }

    // Post-filtro por oficina / materia (coincidencia parcial, sin acentos-sensible).
    if (oficinaFilter && !(exp?.oficina ?? "").toLowerCase().includes(oficinaFilter)) {
      continue;
    }
    if (materiaFilter && !(exp?.materia ?? "").toLowerCase().includes(materiaFilter)) {
      continue;
    }

    if (input.documentId && expedienteId !== input.documentId) continue;
    const chunkId = asString(record.chunk_id);
    // No mostrar generaciones preparadas ni vectores antiguos sin chunk vigente.
    if (!exp || !chunkId || !contentById.has(chunkId)) continue;
    const content = contentById.get(chunkId)!;
    const pageStart = asNumber(record.page_start);
    const pageEnd = asNumber(record.page_end);
    const serie = hitNumber ?? exp?.serie_documento ?? null;
    const { ubicacion, resumen } = buildUbicacion(exp);

    results.push({
      anio: exp?.anio ?? null,
      asunto: exp?.asunto ?? asString(record.topic),
      citation: `${serie ? serie : "Expediente"}${pageStart ? `, pág. ${pageStart}` : ""}`,
      excerpt: content.slice(0, 700),
      expedienteId,
      materia: exp?.materia ?? null,
      oficina: exp?.oficina ?? null,
      pageEnd,
      pageStart,
      score: asNumber(record._score) ?? 0,
      serieDocumento: serie,
      sgdExpediente: exp?.sgd_expediente ?? null,
      storageBucket: exp?.storage_bucket ?? null,
      storagePath: exp?.storage_path ?? null,
      tipoDocumento: exp?.tipo_documento ?? null,
      title: exp?.title ?? asString(record.title) ?? "Expediente",
      ubicacion,
      ubicacionResumen: resumen,
    });
  }

  // Refinamiento por código exacto: si la consulta menciona un número de 3+
  // cifras y ALGÚN resultado lo trae literal en su título o serie documental,
  // se descartan los que no lo traen. Documentos como los comprobantes de
  // pago son casi idénticos entre sí salvo por ese número, así que el vector
  // trae de vuelta varios "parecidos" con OTRO número en vez de aislar el que
  // se pidió — "comprobante de pago nro 2956" mostraba el 2956 enterrado
  // entre el 2955, 2966 y 2967. Solo actúa si hay al menos un match exacto:
  // una consulta sin código, o cuyo código no aparece en ningún resultado,
  // sigue el orden semántico normal sin tocar nada.
  if (exactCodes.length > 0) {
    const exactMatches = results.filter((r) =>
      exactCodes.some(
        (code) =>
          containsExactNumber(r.title, code) ||
          containsExactNumber(r.serieDocumento, code) ||
          containsExactNumber(r.sgdExpediente, code),
      ),
    );
    if (exactMatches.length > 0) return exactMatches;
  }

  return results;
}

export type LlmUsage = { model: string; inputTokens: number; outputTokens: number };

export type ExpedienteAnswer = {
  answer: string;
  sufficient: boolean;
  sources: ExpedienteSearchResult[];
  usage?: LlmUsage;
  /** Avisos de la verificación de fidelidad de citas (ver checkCitationFaithfulness). */
  warnings?: string[];
};

function buildContext(sources: ExpedienteSearchResult[]) {
  return sources
    .map((source, index) => {
      const head = [
        `[E${index + 1}] ${source.title}`,
        source.serieDocumento ? `Serie ${source.serieDocumento}` : null,
        source.anio ? `Año: ${source.anio}` : null,
        source.materia ? `Materia: ${source.materia}` : null,
        source.asunto ? `Asunto: ${source.asunto}` : null,
        `Ubicación física: ${source.ubicacionResumen}`,
        source.pageStart ? `Pág. ${source.pageStart}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${head}\n${source.excerpt}`;
    })
    .join("\n\n---\n\n");
}

// Responde preguntas en lenguaje natural sobre la biblioteca de expedientes
// archivados. Si no hay fuentes, lo dice; no inventa. Cita con [E#] e indica la
// ubicación física cuando es relevante ("dónde está").
export async function answerExpedienteQuestion(
  input: ExpedienteChatInput & { uploadedBy?: string; accessToken?: string },
): Promise<ExpedienteAnswer> {
  const sources = await searchExpedientes({
    query: input.query,
    documentId: input.documentId,
    anio: input.anio,
    oficina: input.oficina,
    uploadedBy: input.uploadedBy,
    accessToken: input.accessToken,
    topK: input.uploadedBy ? 24 : 8,
  });

  if (sources.length === 0) {
    return {
      answer: "No encontré expedientes relacionados en la biblioteca de expedientes archivados.",
      sources: [],
      sufficient: false,
      usage: { inputTokens: 0, model: legalAnswerModel, outputTokens: 0 },
    };
  }

  const openai = getOpenAIClient();
  const context = buildContext(sources);

  const response = await openai.responses.create({
    input: [
      {
        content: `Eres un asistente de la biblioteca de EXPEDIENTES ARCHIVADOS de una entidad pública. Responde la consulta del usuario USANDO SOLO la información de los expedientes proporcionados.

Reglas:
- Usa únicamente lo que consta en los fragmentos. No inventes datos, fechas, números ni ubicaciones.
- Cita la fuente con [E#] al final de cada afirmación sustantiva.
- Cuando el usuario pregunte DÓNDE está un expediente, indica su ubicación física (caja/archivador, color, ambiente) tal como consta.
- Menciona número y fecha del expediente cuando sea relevante.
- Si la respuesta no está en los expedientes, dilo claramente.

Expedientes disponibles:
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

  const answerText =
    response.output_text.trim() || "No pude generar una respuesta a partir de los expedientes.";

  // Red de seguridad anti-misatribución (mismo verificador que legal-chat.ts,
  // adaptado al marcador [E#] que usa este chat): si un dato numérico
  // específico citado con [E#] no consta en el fragmento que cita, se avisa
  // en vez de dejar la cifra pasar como si estuviera confirmada. No bloquea
  // la respuesta ni la regenera — solo la marca para que se revise contra el
  // documento original.
  const faithfulness = checkCitationFaithfulness(answerText, sources, "E");
  const warnings = faithfulness.ok
    ? undefined
    : [
        `Verificación de citas: ${faithfulness.issues.length} dato(s) citado(s) (${faithfulness.issues
          .map((issue) => issue.datum)
          .slice(0, 3)
          .join(", ")}) no se hallaron en el fragmento citado; confirma en el documento original.`,
      ];

  return {
    answer: answerText,
    sources,
    sufficient: true,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      model: legalAnswerModel,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
    warnings,
  };
}
