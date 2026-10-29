// Reintento con espera creciente para fallos PASAJEROS de un proveedor (límite por minuto, 5xx, red caída un
// instante). Antes una llamada que fallaba por un 503 de medio segundo degradaba la respuesta del chat a un
// extracto de fuentes, o dejaba un documento en `error` al indexarlo, sin que nada se hubiera roto de verdad.
//
// Lo que NO se reintenta, a propósito:
//   · el crédito agotado (402 y similares): ningún reintento lo arregla y cada uno gasta tiempo (ver embedding-credit.ts);
//   · los tiempos agotados: la llamada ya consumió su plazo entero, repetirla duplicaría la espera del usuario;
//   · cualquier 4xx (clave, formato, petición inválida): fallará igual.
// Módulo puro: la espera y el azar se inyectan para probarlo sin reloj.

import { isEmbeddingCreditExhausted } from "./embedding-credit";

export type RetryOptions = {
  /** Intentos en total, el primero incluido. */
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_CODE = /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT)\b/;

/** ¿Es un fallo que puede desaparecer solo? Mira el estado HTTP (en `status` o en el texto del error) y los códigos de red. */
export function isTransientError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if (isEmbeddingCreditExhausted(error)) return false;
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return TRANSIENT_STATUS.has(status);
  const message = error instanceof Error ? `${error.message} ${String((error as { code?: unknown }).code ?? "")} ${String((error as { cause?: { code?: unknown } }).cause?.code ?? "")}` : String(error);
  const http = /\b(?:HTTP|embeddings|status)\s*(\d{3})\b/i.exec(message);
  if (http) return TRANSIENT_STATUS.has(Number(http[1]));
  // «fetch failed» es lo que lanza Node cuando la conexión se cae antes de recibir respuesta.
  return TRANSIENT_CODE.test(message) || /\bfetch failed\b|\bnetwork error\b|\bsocket hang up\b/i.test(message);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(run: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseMs = options.baseMs ?? 400;
  const maxMs = options.maxMs ?? 4000;
  const shouldRetry = options.shouldRetry ?? isTransientError;
  const sleep = options.sleep ?? wait;
  const random = options.random ?? Math.random;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
      // Espera exponencial con algo de azar, para que varias peticiones que fallaron a la vez no vuelvan juntas.
      const delay = Math.min(maxMs, Math.round(baseMs * 2 ** (attempt - 1) * (0.5 + random())));
      options.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }
}
