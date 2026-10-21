const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

export type DocumentRecord = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  document_type: string;
  process_type?: string | null;
  source_entity: string | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Oficina de quien lo subió (FK a expedientes_oficinas); null en filas anteriores a la migración. */
  oficina_id?: string | null;
  /** Visible para cualquier oficina (p. ej. la Ley/Reglamento), no solo la que lo subió. */
  es_institucional?: boolean;
};

export async function getSupabaseAdminClient() {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabaseServerConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    serviceRoleKey,
    storageBucket,
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
  };
}

/**
 * ¿El id es seguro para interpolarlo en un filtro PostgREST?
 *
 * Los identificadores del sistema son UUID. Un id que llega del cliente y se
 * pega tal cual en `?id=eq.${id}` permite colar `&` y añadir filtros propios:
 * un PATCH o un DELETE de una fila se convierte en masivo. Validar la FORMA es
 * más seguro que escapar —un UUID no tiene ningún carácter especial— y además
 * descarta ids malformados antes de llegar a la base.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdSeguro(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

/**
 * Traga el error de una operación ACCESORIA, pero lo deja ver en el log.
 *
 * Hay escrituras que no deben tumbar la petición: un registro de auditoría que
 * falla no justifica perder el guardado que acaba de hacer el usuario. Lo que
 * no vale es que desaparezcan sin rastro. Dos fallos reales de este proyecto
 * vivieron meses escondidos exactamente así:
 *
 *   * `seedCounters(...).catch(() => undefined)` — las oficinas nuevas se
 *     quedaban sin contadores de numeración
 *   * `rpc/expedientes_next_doc_number ... .catch(() => null)` — la función
 *     fallaba con 42P10 y los documentos se archivaban sin número
 *
 * En ninguno de los dos casos había un síntoma: solo datos que faltaban.
 *
 * Uso: `await algo().catch(tragarPeroRegistrar("oficinas.seedCounters"))`
 *
 * Si el fallo SÍ debe llegar al usuario, no uses esto: propaga el error o
 * devuélvelo en la respuesta.
 */
export function tragarPeroRegistrar(contexto: string): (err: unknown) => undefined {
  return (err: unknown) => {
    console.error(`[${contexto}] operación accesoria fallida:`, err instanceof Error ? err.message : err);
    return undefined;
  };
}

export function getSupabaseHeaders(prefer?: string) {
  const { serviceRoleKey } = getSupabaseServerConfig();
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

export async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const shouldReturnRepresentation = init?.method === "POST" || init?.method === "PATCH";
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getSupabaseHeaders(shouldReturnRepresentation ? "return=representation" : undefined),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }

  // Con Prefer: return=minimal PostgREST responde 201/200 con cuerpo vacio.
  const raw = await response.text();
  if (!raw) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
}

/** Merge de un nivel en un objeto: si ambos valores son objetos, funde sus claves. */
function mergeUnNivel(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    const ambosObj =
      cur !== null && typeof cur === "object" && !Array.isArray(cur) &&
      v !== null && typeof v === "object" && !Array.isArray(v);
    out[k] = ambosObj ? { ...(cur as object), ...(v as object) } : v;
  }
  return out;
}

/**
 * Fusiona `patch` en `documents.metadata` SIN read-modify-write en la aplicación.
 *
 * Usa la función SQL `merge_document_metadata`, que hace el merge (un nivel) bajo
 * un `for update`: dos escrituras concurrentes de claves distintas no se pisan.
 * Filtra por kind eett_tdr + necesidadId, como hacían las rutas.
 *
 * Fallback ACOTADO a "SQL aún no aplicado": si la función no existe, cae al
 * read-modify-write de siempre (con su race) para no bloquear antes de migrar.
 * Cualquier otro error se propaga —lo maneja la ruta— en vez de tragarse.
 */
export async function mergeDocumentMetadata(
  docId: string,
  necesidadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseRest("rpc/merge_document_metadata", {
      method: "POST",
      body: JSON.stringify({ p_id: docId, p_necesidad_id: necesidadId, p_patch: patch }),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const funcionAusente = /merge_document_metadata|PGRST202|Could not find the function/i.test(msg);
    if (!funcionAusente) throw error;
    // La función aún no se ha creado: read-modify-write con el mismo merge.
    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&metadata->>kind=eq.eett_tdr&metadata->>necesidadId=eq.${necesidadId}&select=id,metadata`,
    );
    const doc = docs[0];
    if (!doc) return;
    const metadata = mergeUnNivel((doc.metadata ?? {}) as Record<string, unknown>, patch);
    await supabaseRest(`documents?id=eq.${docId}`, { body: JSON.stringify({ metadata }), method: "PATCH" });
  }
}

// Variante de supabaseRest que actua con el JWT del usuario (no el service_role)
// para que las politicas RLS filtren los datos privados del chat/comparaciones.
export async function supabaseUserRest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const shouldReturnRepresentation = init?.method === "POST" || init?.method === "PATCH";
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      ...(shouldReturnRepresentation ? { Prefer: "return=representation" } : {}),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST(user) ${response.status}: ${detail}`);
  }

  // Con Prefer: return=minimal PostgREST responde 201/200 con cuerpo vacio.
  const raw = await response.text();
  if (!raw) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
}

export async function uploadPdfToStorage(path: string, file: File) {
  const { serviceRoleKey, storageBucket, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${encodeURI(path)}`,
    {
      body: await file.arrayBuffer(),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.type || "application/pdf",
        "x-upsert": "false",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage ${response.status}: ${detail}`);
  }

  return response.json();
}

/**
 * Sube un archivo cualquiera al bucket, no solo PDFs.
 *
 * `uploadPdfToStorage` recibe un `File` y da por hecho PDF; los formatos que
 * genera la aplicación son buffers .xlsx y .docx que nunca fueron un `File`.
 */
export async function uploadStorageObject(
  path: string,
  contenido: ArrayBuffer | Uint8Array,
  contentType: string,
) {
  const { serviceRoleKey, storageBucket, supabaseUrl } = getSupabaseServerConfig();
  const cuerpo: ArrayBuffer =
    contenido instanceof Uint8Array
      ? (contenido.buffer.slice(
          contenido.byteOffset,
          contenido.byteOffset + contenido.byteLength,
        ) as ArrayBuffer)
      : contenido;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${encodeURI(path)}`,
    {
      body: cuerpo,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        // Se sobrescribe: un formato se re-exporta muchas veces y fallar por
        // colisión de nombre dejaría al usuario sin su archivo.
        "x-upsert": "true",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function downloadStorageObject(bucket: string, path: string) {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage download ${response.status}: ${detail}`);
  }

  return response.blob();
}

export async function deleteStorageObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({
      prefixes: paths,
    }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage delete ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function writeAuditLog(input: {
  action: string;
  actorReference?: string;
  details?: Record<string, unknown>;
  entityId?: string;
  entityType: string;
  module?: string;
  processType?: string | null;
  user?: {
    email?: string | null;
    entity?: string | null;
    id?: string | null;
    role?: string | null;
  };
}) {
  try {
    const modulo = input.module ?? input.action.split(".")[0] ?? input.entityType;
    await supabaseRest("audit_logs", {
      body: JSON.stringify({
        action: input.action,
        actor_reference: input.actorReference ?? "system",
        details: {
          action: input.action,
          module: modulo,
          processType: input.processType ?? null,
          ...(input.details ?? {}),
          ...(input.user
            ? {
                user: {
                  email: input.user.email ?? null,
                  entity: input.user.entity ?? null,
                  id: input.user.id ?? null,
                  role: input.user.role ?? null,
                },
              }
            : {}),
        },
        entity_id: input.entityId ?? null,
        entity_type: input.entityType,
      }),
      method: "POST",
    });
  } catch {
    // Audit logging must not break the user-facing workflow.
  }
}

export function institutionalAuditDetails(input: {
  conclusion?: string | null;
  documentId?: string | null;
  entity?: string | null;
  processId?: string | null;
  processType?: string | null;
  query?: string | null;
  role?: string | null;
  sources?: Array<{
    article?: string | null;
    documentId?: string | null;
    documentTitle?: string | null;
    documentType?: string | null;
    pageStart?: number | null;
    processType?: string | null;
  }>;
  userEmail?: string | null;
  userId?: string | null;
}) {
  return {
    conclusion: input.conclusion ?? null,
    documentId: input.documentId ?? null,
    processId: input.processId ?? null,
    processType: input.processType ?? null,
    query: input.query ?? null,
    sources:
      input.sources?.slice(0, 20).map((source) => ({
        article: source.article ?? null,
        documentId: source.documentId ?? null,
        documentTitle: source.documentTitle ?? null,
        documentType: source.documentType ?? null,
        pageStart: source.pageStart ?? null,
        processType: source.processType ?? null,
      })) ?? [],
    user: {
      email: input.userEmail ?? null,
      entity: input.entity ?? null,
      id: input.userId ?? null,
      role: input.role ?? null,
    },
  };
}
