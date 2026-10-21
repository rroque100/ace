/**
 * Rate limiter en memoria para proteger endpoints sensibles.
 *
 * Implementación simple basada en Map<key, timestamps[]>.
 * Para producción con múltiples instancias, migrar a Upstash Redis o Vercel KV.
 *
 * Uso:
 *   const ok = rateLimit(`chat:${userId}`, 10, 60_000);
 *   if (!ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
 */

type Bucket = {
  timestamps: number[];
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Máximo de requests permitidos en la ventana */
  max: number;
  /** Tamaño de la ventana en milisegundos */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
}

/**
 * Verifica si una key (usuario + endpoint) puede hacer una request.
 * Retorna información detallada para headers HTTP.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existing = buckets.get(key);
  const timestamps = existing?.timestamps ?? [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= config.max) {
    const oldestInWindow = recent[0];
    const resetIn = oldestInWindow + config.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(0, resetIn),
      limit: config.max,
    };
  }

  recent.push(now);
  buckets.set(key, {
    timestamps: recent,
    resetAt: now + config.windowMs,
  });

  return {
    allowed: true,
    remaining: config.max - recent.length,
    resetIn: config.windowMs,
    limit: config.max,
  };
}

/**
 * Extrae una key de rate limit a partir del request.
 * Usa userId si está autenticado, sino IP.
 */
export function getRateLimitKey(
  request: Request,
  userId: string | null,
  endpoint: string,
): string {
  if (userId) return `${endpoint}:user:${userId}`;

  // Fallback a IP desde headers comunes
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "anonymous";
  return `${endpoint}:ip:${ip}`;
}

/**
 * Aplica rate limit y devuelve una respuesta 429 si se excede.
 * Helper para usar en API routes.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
      retryAfter: Math.ceil(result.resetIn / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.resetIn / 1000)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetIn / 1000)),
      },
    },
  );
}

export const RATE_LIMITS = {
  /** RAG chat: costoso (GPT-4) */
  chat: { max: 10, windowMs: 60_000 },
  /** AI search: moderado (GPT-4 mini) */
  aiSearch: { max: 15, windowMs: 60_000 },
  /** Búsqueda keyword: barato */
  search: { max: 30, windowMs: 60_000 },
  /** Listar (auto-refresh en segundo plano, no una acción del usuario): la
   *  pestaña Subir de expedientes-archivo sondea la lista completa Y la de
   *  "recientes" cada 4 s mientras algo está "procesando" — 30/min lo dejaba
   *  saturado por ese solo sondeo, sin margen para nada más, y los 429
   *  resultantes dejaban el banner "Indexando..." pegado para siempre (el
   *  sondeo nunca llegaba a ver el cambio a "indexado"). */
  list: { max: 60, windowMs: 60_000 },
  /** Subir PDF: costoso (storage + OCR) */
  upload: { max: 5, windowMs: 60_000 },
  /** Subir RAG (carga masiva desde carpeta, Subir RAG): sin OCR síncrono —
   *  el análisis se difiere a advanceRagDocument —, así que cada subida es
   *  mucho más barata que una del wizard normal. Un lote real es de decenas o
   *  cientos de archivos seguidos; con el límite de `upload` (5/min, pensado
   *  para una persona subiendo un documento a la vez) los últimos del lote
   *  fallaban en firme —el backoff de fetchRagRequest solo reintenta 2 veces—
   *  en vez de solo ir más lento. */
  uploadBulk: { max: 60, windowMs: 60_000 },
  /** Bulk operations: requiere queries */
  bulk: { max: 5, windowMs: 60_000 },
  /** Export: lectura pero pesado */
  export: { max: 10, windowMs: 60_000 },
  /** Reindex: costoso (re-procesa PDF) */
  reindex: { max: 5, windowMs: 60_000 },
} as const;
