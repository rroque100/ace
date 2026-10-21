import { prepareArchivoUpload } from "./archivo-upload-client";
/**
 * Acciones de negocio del módulo /expedientes-archivo
 *
 * Funciones puras que encapsulan las llamadas HTTP al backend y la lógica
 * de transformación. Separar estas funciones de la UI permite:
 *   - Reutilizarlas desde otros componentes
 *   - Testearlas sin renderizar React
 *   - Cambiar el backend sin tocar la UI
 */
// `zod/mini`, no `zod`: este modulo lo carga el navegador y zod entero pesaba
// unos 54 KB (brotli) en la ruta mas pesada de la aplicacion. La API funcional
// (`z.optional(x)`, `x.check(...)`) valida igual; lo unico que mini no trae es
// el catalogo de mensajes por defecto, asi que cada regla lleva el suyo escrito.
import * as z from "zod/mini";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "./document-number";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "./upload-limits";
import type { ChatAnswer, DuplicateMatch, ExpedienteLegajoItem, LegajoDetalle, PdfInventory, SearchResult } from "@/app/components/expedientes-archivo/types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

// ── Esquemas de validación runtime ─────────────────────────────────────

/** Texto recortado con longitud acotada; el mensaje se le ensena al usuario. */
const texto = (min: number, max: number, mensaje?: string) =>
  z.string().check(z.trim(), z.minLength(min, mensaje), z.maxLength(max));
/** Texto opcional recortado: solo topa la longitud, no exige contenido. */
const opcional = (max: number) => z.optional(z.string().check(z.trim(), z.maxLength(max)));

const SearchQuerySchema = texto(2, 500, "La búsqueda debe tener al menos 2 caracteres");
const AnioSchema = z.optional(z.coerce.number().check(
    z.int("El año debe ser un número entero"),
    z.gte(1900, "El año debe estar entre 1900 y 2200"),
    z.lte(2200, "El año debe estar entre 1900 y 2200"),
  ));
const ChatQuerySchema = texto(3, 800, "La pregunta debe tener al menos 3 caracteres");

const ChatRequestSchema = z.object({ query: ChatQuerySchema });
const SearchRequestSchema = z.object({
  query: SearchQuerySchema,
  anio: AnioSchema,
  oficina: opcional(200),
  materia: opcional(200),
});
const BulkUpdateSchema = z.object({
  ids: z.array(z.string().check(z.minLength(1))).check(
    z.minLength(1, "Selecciona al menos un expediente"),
    z.maxLength(200, "No se pueden procesar más de 200 expedientes a la vez"),
  ),
  action: z.enum(["update", "markForDisposal"]),
  updates: z.optional(z.record(z.string(), z.unknown())),
});

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json();
    return new Error(data?.error ?? fallback);
  } catch {
    return new Error(`${fallback} (HTTP ${response.status})`);
  }
}

/** Llama al endpoint /chat para hacer una pregunta con RAG */
export async function chatWithExpedientes(query: string): Promise<ChatAnswer> {
  const parsed = ChatRequestSchema.parse({ query });
  const res = await fetch("/api/expedientes-archivo/chat", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo responder la consulta");
  return res.json();
}

/** Llama al endpoint /search para búsqueda por contenido (con filtros opcionales) */
export async function searchExpedientes(
  query: string,
  filters: { anio?: number; oficina?: string; materia?: string } = {},
): Promise<{ query: string; results: SearchResult[] }> {
  const parsed = SearchRequestSchema.parse({
    query,
    anio: filters.anio,
    oficina: filters.oficina || undefined,
    materia: filters.materia || undefined,
  });
  const res = await fetch("/api/expedientes-archivo/search", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo ejecutar la búsqueda");
  return res.json();
}

/** Llama al endpoint /duplicates para detectar duplicados */
export async function detectDuplicates(params: {
  title?: string;
  sgd?: string;
  serie?: string;
  excludeId?: string;
}): Promise<{ duplicates: DuplicateMatch[]; matchType: "exact" | "fuzzy" | "none" }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  if ([...qs].length === 0) return { duplicates: [], matchType: "none" };
  const res = await fetch(`/api/expedientes-archivo/duplicates?${qs.toString()}`);
  if (!res.ok) throw await parseError(res, "No se pudo detectar duplicados");
  const data = await res.json();
  return {
    duplicates: data.duplicates ?? [],
    matchType: data.matchType ?? "none",
  };
}

/** Busca legajos existentes (para el selector "añadir documento a legajo
 *  existente" del wizard de Subir). Query vacía = los más recientes. */
export async function searchLegajos(
  query: string,
  limit: number = 10,
): Promise<{ legajos: ExpedienteLegajoItem[] }> {
  const empty = { legajos: [] as ExpedienteLegajoItem[] };
  const q = query.trim();
  if (q.length > 0 && q.length < 2) return empty;
  try {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    qs.set("limit", String(limit));
    const res = await fetch(`/api/expedientes-archivo/legajos?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = (await res.json().catch(() => ({}))) as { legajos?: ExpedienteLegajoItem[] };
    return { legajos: data.legajos ?? [] };
  } catch {
    return empty;
  }
}

/** Trae un legajo y sus documentos (folios), para la sección "Otros
 *  documentos de este expediente" del slide-over. */
export async function fetchLegajoDetalle(id: string): Promise<LegajoDetalle | null> {
  try {
    const res = await fetch(`/api/expedientes-archivo/legajos/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Partial<LegajoDetalle>;
    if (!data.legajo) return null;
    return { legajo: data.legajo, documentos: data.documentos ?? [] };
  } catch {
    return null;
  }
}

/** Llama al endpoint /extract para extraer metadata de un PDF.
 *  `forceRefresh`: salta la cache de OCR del servidor — la visión no es 100%
 *  determinista, así que un reintento manual debe poder leer de nuevo en vez
 *  de repetir un resultado malo ya guardado. */
export async function autoFillFromPdf(
  file: File,
  title: string,
  forceRefresh: boolean = false,
): Promise<PdfInventory> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) {
    throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  if (forceRefresh) formData.append("forceRefresh", "true");
  let res: Response;
  try {
    await prepareArchivoUpload(formData);
    res = await fetch("/api/expedientes-archivo/extract", {
      signal: AbortSignal.timeout(240_000),
      method: "POST",
      body: formData,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("La lectura del PDF superó el tiempo de espera. Puedes volver a analizarlo o completar los campos manualmente; los datos ingresados se conservan.");
    }
    throw error;
  }
  if (!res.ok) {
    if (res.status === 422) {
      throw await parseError(res, "El PDF no se pudo procesar con OCR");
    }
    throw await parseError(res, "No se pudo analizar el PDF");
  }
  const payload = await res.json();
  return payload.inventory ?? payload;
}

/** Ubicación física sugerida por el backend (basada en lo ya archivado) */
export type UbicacionSugerida = {
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
};

export type UbicacionSugeridaResponse = {
  ultima: UbicacionSugerida | null;
  siguientePaquete: string | null;
  basadoEn: { serie: string | null; anio: string | null } | null;
};

/** Pide una sugerencia de ubicación física para un nuevo expediente */
export async function fetchUbicacionSugerida(params: {
  serie?: string;
  anio?: string | number;
}): Promise<UbicacionSugeridaResponse> {
  const qs = new URLSearchParams();
  if (params.serie) qs.set("serie", params.serie);
  if (params.anio) qs.set("anio", String(params.anio));
  try {
    const res = await fetch(`/api/expedientes-archivo/ubicacion-sugerida?${qs.toString()}`);
    if (!res.ok) return { ultima: null, siguientePaquete: null, basadoEn: null };
    return res.json();
  } catch {
    return { ultima: null, siguientePaquete: null, basadoEn: null };
  }
}

/** Sube un nuevo expediente */
export async function uploadExpediente(formData: FormData, onProgress?: (loaded: number, total: number) => void): Promise<{ expediente: unknown; processing: boolean }> {
  await prepareArchivoUpload(formData);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      });
    }
    xhr.addEventListener("load", () => {
      try {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body?.error ?? `HTTP ${xhr.status}`));
        }
      } catch (e) {
        reject(new Error(`No se pudo subir el expediente: ${e instanceof Error ? e.message : "error"}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir el PDF")));
    xhr.addEventListener("abort", () => reject(new Error("Subida cancelada")));
    xhr.open("POST", "/api/expedientes-archivo");
    xhr.send(formData);
  });
}

/** Edita la metadata de un expediente (PATCH). El backend aplica una whitelist
 *  de columnas; los campos no permitidos se ignoran silenciosamente. */
export async function updateExpediente(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ updated: string[] }> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw await parseError(res, "No se pudo actualizar el expediente");
  return res.json();
}

/** Reindexa un expediente existente */
export async function reindexExpediente(id: string): Promise<void> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
  if (!res.ok) throw await parseError(res, "No se pudo reindexar");
}

/** Elimina un expediente */
export async function deleteExpediente(id: string): Promise<void> {
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, "No se pudo eliminar");
}

/** Reemplaza el PDF de un expediente */
export async function replaceExpedienteFile(id: string, file: File): Promise<void> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) {
    throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  }
  const formData = new FormData();
  formData.append("file", file);
  await prepareArchivoUpload(formData);
  const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "PUT", body: formData });
  if (!res.ok) throw await parseError(res, "No se pudo reemplazar el PDF");
}

/** Aplica una actualización masiva a N expedientes */
export async function bulkUpdateExpedientes(
  ids: string[],
  updates: Record<string, unknown>,
): Promise<{ updated: number; fields: string[] }> {
  if (ids.length === 0) return { updated: 0, fields: [] };
  const parsed = BulkUpdateSchema.parse({ ids, action: "update", updates });
  const res = await fetch("/api/expedientes-archivo/bulk", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo aplicar la operación masiva");
  return res.json();
}

/** Marca expedientes para baja */
export async function bulkMarkForDisposal(ids: string[]): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const parsed = BulkUpdateSchema.parse({ ids, action: "markForDisposal" });
  const res = await fetch("/api/expedientes-archivo/bulk", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo marcar para baja");
  return res.json();
}

// ── Respuesta de mesa de partes (oficio/carta fundamentado) ────────────

export type RespuestaSource = {
  citation: string;
  title: string;
  number: string | null;
  excerpt: string;
};

export type RespuestaTokenUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type RespuestaAntecedente = {
  expedienteId: string;
  title: string;
  serie: string | null;
  anio: number | null;
  ubicacion: string;
  excerpt: string;
};

export type RespuestaResult = {
  respuesta: string;
  sources: RespuestaSource[];
  antecedentes?: RespuestaAntecedente[];
  assessment?: { sufficient?: boolean; reason?: string } | null;
  tokenUsage?: RespuestaTokenUsage;
};

// Catalogo compartido con Configuracion → Numeracion (lib/document-number.ts).
export const DOC_TIPOS = TIPOS_DOCUMENTO;
export type DocTipo = TipoDocumento;

const RespuestaGenerateSchema = z.object({
  intencion: texto(10, 8000, "Escribe qué quieres responder (mín. 10 caracteres)"),
  tipoDocumento: z._default(z.enum(DOC_TIPOS), "OFICIO"),
  documentoTexto: opcional(20000),
  remitente: opcional(200),
  // A quien va dirigido el documento (campo "Dirigido a" de la UI): la IA
  // redacta el saludo/vocativo y el cuerpo dirigidos a esta persona.
  destinatario: opcional(300),
  cargoDestinatario: opcional(200),
  asunto: opcional(300),
  tone: z._default(z.enum(["cercano", "formal", "tecnico"]), "formal"),
  length: z._default(z.enum(["concisa", "media", "detallada"]), "media"),
  selectedSources: z.optional(z.array(z.string()).check(z.maxLength(20))),
  // Documentos seleccionados de la biblioteca de normativa (Pinecone documentId)
  normativaIds: z.optional(z.array(z.string()).check(z.maxLength(20))),
  // Adjuntos subidos por el usuario (Pinecone documentId, namespace respuesta-adjuntos)
  adjuntosIds: z.optional(z.array(z.string()).check(z.maxLength(5))),
  // Antecedente persistido (respuesta_antecedentes.id) - se re-lee de Pinecone
  antecedenteId: z.optional(z.uuid("El antecedente elegido no es válido")),
  includeAntecedentes: z.optional(z.boolean()),
  entityName: opcional(200),
  // Oficina emisora: da al generador la voz del jefe responsable y el
  // historial de feedback de redaccion de esa oficina.
  oficinaId: z.optional(z.uuid("La oficina elegida no es válida")),
});

// === Biblioteca de normativa (catalog) ===
export type NormativaEntry = {
  chunkCount: number;
  documentId: string;
  documentNumber: string | null;
  documentType: string | null;
  sourceEntity: string | null;
  title: string;
  year: number | null;
};

export type NormativaCatalog = {
  entries: NormativaEntry[];
  total: number;
};

export async function listNormativaBiblioteca(
  search?: string,
  limit: number = 200,
): Promise<NormativaCatalog> {
  const empty: NormativaCatalog = { entries: [], total: 0 };
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", String(limit));
    const res = await fetch(`/api/normativa/biblioteca?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = (await res.json().catch(() => ({}))) as Partial<NormativaCatalog>;
    return {
      entries: data.entries ?? [],
      total: data.total ?? 0,
    };
  } catch {
    return empty;
  }
}

// === Adjuntar normativa temporal ===
export type AdjuntoResult = {
  chunkCount: number;
  documentId: string;
  namespace: string;
  pages: number;
  textLength: number;
  title: string;
};

export async function adjuntarNormativa(
  file: File,
  titulo?: string,
): Promise<AdjuntoResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (titulo) fd.append("titulo", titulo);
  const res = await fetch("/api/normativa/adjuntar", {
    method: "POST",
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AdjuntoResult> & {
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "No se pudo adjuntar la normativa");
  return {
    chunkCount: data.chunkCount ?? 0,
    documentId: data.documentId ?? "",
    namespace: data.namespace ?? "respuesta-adjuntos",
    pages: data.pages ?? 0,
    textLength: data.textLength ?? 0,
    title: data.title ?? file.name,
  };
}

export type RespuestaGenerateInput = z.input<typeof RespuestaGenerateSchema>;

/** Genera el borrador de respuesta oficial fundamentado en el corpus normativo */
export async function generateRespuesta(input: RespuestaGenerateInput): Promise<RespuestaResult> {
  const parsed = RespuestaGenerateSchema.parse(input);
  const res = await fetch("/api/expedientes-archivo/respuesta/generate", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw await parseError(res, "No se pudo generar la respuesta");
  return res.json();
}

export type RespuestaExportInput = {
  format?: "docx" | "pdf";
  // CARTA usa layout epistolar (lugar y fecha arriba, Señor(a), asunto opcional).
  tipoDocumento?: DocTipo;
  oficinaId?: string;
  entity: { name: string; ruc?: string; address?: string; executingUnit?: string };
  nroOficio?: string;
  destinatario?: string;
  cargoDestinatario?: string;
  // Ciudad del encabezado: "Challhuahuacho, 6 de julio de 2026".
  lugar?: string;
  // REF.: numero del documento anterior al que se responde (opcional).
  referencia?: string;
  asunto: string;
  cuerpo: string;
  // @deprecated La base legal NO se incluye en el documento descargado.
  // Solo se usa como contexto para que la IA redacte el cuerpo.
  // Se mantiene el campo por compatibilidad con codigo legacy, pero el
  // endpoint /export lo ignora.
  baseLegal?: { referencia: string; texto: string }[];
  remitente?: string;
  cargoRemitente?: string;
};

/** Exporta la respuesta a .docx (membrete texto) o .pdf (sobre la hoja membretada) */
export async function exportRespuestaDocx(input: RespuestaExportInput): Promise<void> {
  const format = input.format ?? "docx";
  // En la CARTA el asunto es opcional (modelo epistolar peruano).
  const esCarta = (input.tipoDocumento ?? "").toUpperCase().includes("CARTA");
  if (!input.asunto && !esCarta) throw new Error("Indica el asunto");
  if (!input.cuerpo) throw new Error("Genera o escribe el cuerpo de la respuesta");
  if (format === "docx" && !input.entity?.name) throw new Error("Para .docx indica el nombre de la entidad");
  const res = await fetch("/api/expedientes-archivo/respuesta/export", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...input, format }),
  });
  if (!res.ok) throw await parseError(res, "No se pudo exportar el documento");
  const blob = await res.blob();
  const slug = input.asunto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "respuesta";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respuesta-${slug}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Vista previa del documento SIN descargar: pide el PDF al backend y devuelve
 * un object URL para mostrarlo en un <iframe>. El llamador debe revocarlo
 * con URL.revokeObjectURL cuando cierre la vista previa.
 */
export async function previewRespuestaPdf(input: RespuestaExportInput): Promise<string> {
  if (!input.cuerpo) throw new Error("Genera o escribe el cuerpo de la respuesta");
  const res = await fetch("/api/expedientes-archivo/respuesta/export", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...input, format: "pdf" }),
  });
  if (!res.ok) throw await parseError(res, "No se pudo generar la vista previa");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Evalua el borrador (correcto/incorrecto). Los "like" alimentan al generador
 * como ejemplos de estilo de la oficina; los "dislike" como defectos a evitar.
 */
export async function enviarFeedbackRespuesta(input: {
  oficinaId?: string;
  tipoDocumento?: string;
  rating: "like" | "dislike";
  comentario?: string;
  cuerpo: string;
  intencion?: string;
}): Promise<void> {
  const res = await fetch("/api/expedientes-archivo/respuesta/feedback", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res, "No se pudo guardar la evaluación");
}

export type RefinarResult = {
  cuerpo: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
};

/**
 * Refinamiento conversacional del borrador: aplica SOLO el cambio pedido
 * ("mas corto", "agrega un parrafo sobre X", ...) sin regenerar desde cero.
 */
export async function refinarRespuesta(input: {
  cuerpo: string;
  instruccion: string;
  tipoDocumento?: string;
  tone?: "cercano" | "formal" | "tecnico";
}): Promise<RefinarResult> {
  const res = await fetch("/api/expedientes-archivo/respuesta/refinar", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res, "No se pudo refinar el borrador");
  return res.json();
}

// ── Oficinas emisoras (configuradas por el admin) ──────────────────────
export type OficinaOption = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsableNombre: string | null;
  responsableCargo: string | null;
  tieneMembrete: boolean;
  // Tipos de documento que la oficina emite (Configuracion → Numeracion).
  tipos: DocTipo[];
  previews: Partial<Record<DocTipo, string>>;
};

export type OficinasList = {
  // Ciudad institucional (Configuracion): "Lugar" por defecto del encabezado.
  ciudad: string | null;
  defaultOficinaId: string | null;
  isAdmin: boolean;
  oficinas: OficinaOption[];
  totalActivas: number;
  userEntity: string | null;
};

/**
 * Lista las oficinas activas para el usuario logueado.
 * - admin: ve TODAS las oficinas
 * - dec/consulta/legal: ve solo las oficinas de SU entidad
 * Devuelve ademas `defaultOficinaId` para pre-seleccionar la oficina del usuario.
 */
export async function listOficinas(): Promise<OficinasList> {
  const empty: OficinasList = {
    ciudad: null,
    defaultOficinaId: null,
    isAdmin: false,
    oficinas: [],
    totalActivas: 0,
    userEntity: null,
  };
  try {
    const res = await fetch("/api/expedientes-archivo/respuesta/oficinas", {
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = (await res.json().catch(() => ({}))) as Partial<OficinasList>;
    return {
      ciudad: data.ciudad ?? null,
      defaultOficinaId: data.defaultOficinaId ?? null,
      isAdmin: Boolean(data.isAdmin),
      oficinas: (data.oficinas ?? []).map((o) => ({
        ...o,
        // Compatibilidad: si el backend no envia `tipos`, la oficina emite todo.
        tipos: Array.isArray(o.tipos) && o.tipos.length > 0 ? o.tipos : [...DOC_TIPOS],
      })),
      totalActivas: data.totalActivas ?? 0,
      userEntity: data.userEntity ?? null,
    };
  } catch {
    return empty;
  }
}

// ── Subir PDF recibido (OCR) ───────────────────────────────────────────
export type LeerPdfResult = {
  texto: string;
  asunto: string | null;
  remitente: string | null;
  tokenUsage?: RespuestaTokenUsage;
};

/** Sube el PDF de un documento recibido y devuelve su texto (OCR) + asunto/remitente */
export async function leerDocumentoPdf(file: File): Promise<LeerPdfResult> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/expedientes-archivo/respuesta/leer", { method: "POST", body: formData });
  if (!res.ok) throw await parseError(res, "No se pudo leer el PDF");
  return res.json();
}

// ── Antecedente persistido (Supabase + Pinecone) ────────────────────
export type AnalisisTecnico = {
  consultasSugeridas: string[];
  materia: string;
  normativaIdentificada: string;
  partes: string;
  puntosClave: string;
  tipoDocumento: string;
  tipoRespuestaEsperada: string;
  tokenUsage: {
    estimatedCostUsd: number;
    inputTokens: number;
    model: string;
    outputTokens: number;
  };
};

export type AntecedenteResult = {
  id: string;
  documentId: string;
  namespace: string;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  textLength: number;
  charCount: number;
  chunkCount: number;
  extractionMethod: string;
  text: string;
  createdAt: string;
  // Extraidos en el backend (mismo POST, sin llamada IA adicional).
  asunto?: string | null;
  remitente?: string | null;
  // Resumen tecnico del documento (1 sola llamada IA en paralelo con asunto).
  analisis?: AnalisisTecnico | null;
};

/**
 * Sube un PDF como antecedente persistido:
 * - Binario va a Supabase Storage
 * - Texto indexado en Pinecone (namespace 'respuesta-antecedentes')
 * - Metadata en respuesta_antecedentes
 * - Asunto y remitente se extraen en el mismo POST (1 sola llamada IA)
 * Devuelve el id y el texto extraido para que el cliente lo muestre y edite.
 */
export async function subirAntecedente(file: File): Promise<AntecedenteResult> {
  if (!file) throw new Error("No se proporcionó archivo");
  if (file.type !== "application/pdf") throw new Error("Solo se permiten archivos PDF");
  if (file.size > maxPdfSizeBytes) throw new Error(`El PDF supera el límite de ${maxPdfSizeLabel}`);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/expedientes-archivo/respuesta/antecedente", {
    method: "POST",
    body: formData,
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AntecedenteResult> & {
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "No se pudo subir el antecedente");
  return {
    analisis: data.analisis ?? null,
    asunto: data.asunto ?? null,
    charCount: data.charCount ?? 0,
    chunkCount: data.chunkCount ?? 0,
    createdAt: data.createdAt ?? new Date().toISOString(),
    documentId: data.documentId ?? "",
    extractionMethod: data.extractionMethod ?? "pdf-text",
    fileName: data.fileName ?? file.name,
    fileSize: data.fileSize ?? file.size,
    id: data.id ?? "",
    namespace: data.namespace ?? "respuesta-antecedentes",
    pageCount: data.pageCount ?? null,
    remitente: data.remitente ?? null,
    text: data.text ?? "",
    textLength: data.textLength ?? 0,
  };
}

export async function obtenerAntecedente(id: string): Promise<AntecedenteResult> {
  const res = await fetch(`/api/expedientes-archivo/respuesta/antecedente/${encodeURIComponent(id)}`);
  const data = (await res.json().catch(() => ({}))) as Partial<AntecedenteResult> & {
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "No se pudo obtener el antecedente");
  return {
    analisis: data.analisis ?? null,
    asunto: data.asunto ?? null,
    charCount: data.charCount ?? 0,
    chunkCount: data.chunkCount ?? 0,
    createdAt: data.createdAt ?? new Date().toISOString(),
    documentId: data.documentId ?? "",
    extractionMethod: data.extractionMethod ?? "pdf-text",
    fileName: data.fileName ?? "",
    fileSize: data.fileSize ?? 0,
    id: data.id ?? id,
    namespace: data.namespace ?? "respuesta-antecedentes",
    pageCount: data.pageCount ?? null,
    remitente: data.remitente ?? null,
    text: data.text ?? "",
    textLength: data.textLength ?? 0,
  };
}

export async function eliminarAntecedente(id: string): Promise<void> {
  const res = await fetch(
    `/api/expedientes-archivo/respuesta/antecedente?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "No se pudo eliminar el antecedente");
  }
}

export async function listarAntecedentes(limit: number = 10): Promise<AntecedenteResult[]> {
  try {
    const res = await fetch(
      `/api/expedientes-archivo/respuesta/antecedente?limit=${limit}`,
    );
    const data = (await res.json().catch(() => ({}))) as {
      antecedentes?: Array<{
        id: string;
        documentId: string;
        fileName: string;
        fileSize: number;
        pageCount: number | null;
        textLength: number;
        charCount: number;
        chunkCount: number;
        extractionMethod: string;
        createdAt: string;
        namespace: string;
      }>;
      error?: string;
    };
    if (!res.ok) return [];
    return (data.antecedentes ?? []).map((a) => ({
      charCount: a.charCount,
      chunkCount: a.chunkCount,
      createdAt: a.createdAt,
      documentId: a.documentId,
      extractionMethod: a.extractionMethod,
      fileName: a.fileName,
      fileSize: a.fileSize,
      id: a.id,
      namespace: a.namespace,
      pageCount: a.pageCount,
      text: "",
      textLength: a.textLength,
    }));
  } catch {
    return [];
  }
}

// ── Guardar / listar respuestas ────────────────────────────────────────
export type SaveRespuestaInput = {
  nroOficio?: string;
  tipoDocumento?: DocTipo;
  oficinaId?: string;
  assignNumber?: boolean;
  anio?: number;
  asunto?: string;
  destinatario?: string;
  cargoDestinatario?: string;
  remitente?: string;
  documentoTexto?: string;
  cuerpo: string;
  baseLegal?: { referencia: string; texto: string }[];
  antecedentes?: RespuestaAntecedente[];
  entity?: Record<string, unknown>;
  expedienteId?: string | null;
  antecedenteId?: string;
  tone?: string;
  length?: string;
  tokenUsage?: RespuestaTokenUsage;
};

/**
 * Guarda/archiva una respuesta generada. Si assignNumber, asigna el correlativo
 * del tipo.
 *
 * `numeracionError` viene relleno cuando se pidió número y no se pudo dar: el
 * borrador se guarda igual —perderlo sería peor— pero queda SIN numerar, y eso
 * hay que decirlo. Un documento sin número no se puede emitir.
 */
export async function saveRespuesta(
  input: SaveRespuestaInput,
): Promise<{ id: string | null; nroOficio?: string; numeracionError?: string | null }> {
  if (!input.cuerpo?.trim()) throw new Error("No hay cuerpo de respuesta para guardar");
  const res = await fetch("/api/expedientes-archivo/respuesta/save", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res, "No se pudo guardar la respuesta");
  return res.json();
}

export type SavedRespuesta = {
  id: string;
  nro_oficio: string | null;
  tipo_documento: string | null;
  anio: number | null;
  asunto: string | null;
  destinatario: string | null;
  remitente: string | null;
  cuerpo: string;
  base_legal: { referencia: string; texto: string }[];
  antecedentes: RespuestaAntecedente[];
  entity: Record<string, unknown>;
  tone: string | null;
  length: string | null;
  token_usage: RespuestaTokenUsage | null;
  created_at: string;
  // Contexto del antecedente persistido (vacio si no tiene).
  antecedente_id: string | null;
  documento_texto: string | null;
  // Versionado (Sprint 3). NULL para v1 (registros legacy).
  version: number | null;
  parent_version_id: string | null;
};

/** Lista las respuestas guardadas más recientes */
export async function listRespuestas(limit = 20): Promise<SavedRespuesta[]> {
  const res = await fetch(`/api/expedientes-archivo/respuesta/list?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { respuestas?: SavedRespuesta[] };
  return data.respuestas ?? [];
}

// === Sprint 3: Versionado ===
export type VersionedRespuesta = {
  id: string;
  parentId: string;
  version: number;
};

/** Crea una nueva version (vN+1) de una respuesta existente. */
export async function nuevaVersionRespuesta(id: string): Promise<VersionedRespuesta> {
  const res = await fetch(`/api/respuesta/${encodeURIComponent(id)}/version`, {
    method: "POST",
  });
  const data = (await res.json().catch(() => ({}))) as Partial<VersionedRespuesta> & {
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "No se pudo crear la nueva version");
  return {
    id: data.id ?? "",
    parentId: data.parentId ?? id,
    version: data.version ?? 1,
  };
}

// === Sprint 3: Busqueda semantica ===
export type RespuestaSearchResult = {
  anio: number | null;
  asunto: string | null;
  createdAt: string;
  destinatario: string | null;
  excerpt: string;
  id: string;
  nroOficio: string | null;
  parentVersionId: string | null;
  tipoDocumento: string | null;
  version: number | null;
};

export type RespuestaSearchResponse = {
  query: string;
  results: RespuestaSearchResult[];
};

/** Busqueda full-text de respuestas pasadas en espanol. */
export async function buscarRespuestas(
  query: string,
  limit: number = 10,
): Promise<RespuestaSearchResponse> {
  const empty: RespuestaSearchResponse = { query, results: [] };
  if (!query || query.trim().length < 3) return empty;
  try {
    const res = await fetch(
      `/api/respuesta/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
      { cache: "no-store" },
    );
    const data = (await res.json().catch(() => ({}))) as Partial<RespuestaSearchResponse> & {
      error?: string;
    };
    if (!res.ok) return empty;
    return {
      query: data.query ?? query,
      results: data.results ?? [],
    };
  } catch {
    return empty;
  }
}

/** Carga la lista de expedientes con paginación opcional */
export type ExpedienteCounts = {
  total: number;
  indexed: number;
  pending: number;
  error: number;
  totalBytes: number;
};

export async function loadExpedientes(
  options: { page?: number; limit?: number; status?: string; anio?: number } = {},
): Promise<{
  expedientes: unknown[];
  counts: ExpedienteCounts | null;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.status) params.set("status", options.status);
  if (options.anio) params.set("anio", String(options.anio));
  const qs = params.toString();
  const url = `/api/expedientes-archivo${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw await parseError(res, "No se pudo listar los expedientes");
  const data = await res.json();
  return {
    expedientes: data.expedientes ?? [],
    counts: data.counts ?? null,
    pagination: data.pagination ?? {
      page: 1,
      limit: data.expedientes?.length ?? 0,
      total: data.expedientes?.length ?? 0,
      totalPages: 1,
    },
  };
}

/** Trae la metadata (JSON) de un expediente por id. Para abrir el detalle de un
 *  resultado de búsqueda que no esté en la página cargada de la lista. */
export async function fetchExpedienteById(id: string): Promise<unknown | null> {
  const res = await fetch(`/api/expedientes-archivo/${id}?meta=1`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.expediente ?? null;
}
