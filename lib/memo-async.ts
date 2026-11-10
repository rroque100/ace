// Memoria de promesas con vencimiento: una misma operación pedida a la vez (o poco después) se calcula una sola vez.
//
// Por qué existe: el chat lanza de 5 a 8 recuperaciones por pregunta (general, ampliada, anclada al proceso, tipada al
// Reglamento, por régimen…) y cada una corre la búsqueda léxica y el embedding de su consulta. Varias llevan EXACTAMENTE
// la misma consulta, y la búsqueda léxica ni siquiera mira los filtros, así que la base de datos recibía la misma consulta
// `ilike` de 3 a 6 veces en paralelo. Eso alargaba la respuesta y, con la base ya al límite de su statement_timeout, hacía
// más probable que alguna agotara el tiempo. La caché de embeddings de lib/embeddings.ts no lo evitaba: guarda el vector
// cuando termina, y las llamadas simultáneas arrancan antes de que exista.
//
// Lo que se guarda es la PROMESA, no el resultado: quien llega mientras se calcula espera la misma. Un fallo NO se recuerda
// (se borra la entrada al rechazarse): un tiempo agotado pasajero no debe repetirse durante el vencimiento. Es memoria de cada
// instancia del servidor, no compartida; no se usa para respuestas del modelo, que dependen del caso y del historial.

export type MemoAsync<T> = {
  /** Devuelve la promesa vigente de `key` o, si no hay, ejecuta `fn` y la recuerda. */
  get(key: string, fn: () => Promise<T>): Promise<T>;
  clear(): void;
  size(): number;
};

export function createMemoAsync<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
  /** Solo comparte el cálculo EN CURSO: al terminar (con éxito o no) la entrada se retira y `ttlMs` ya no cuenta. */
  soloEnCurso?: boolean;
}): MemoAsync<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { promise: Promise<T>; storedAt: number }>();

  return {
    get(key, fn) {
      const current = entries.get(key);
      if (current && now() - current.storedAt <= options.ttlMs) return current.promise;
      const promise = fn();
      const entry = { promise, storedAt: now() };
      entries.set(key, entry);
      // Solo se retira si la entrada sigue siendo ESTA: otra llamada pudo reemplazarla tras vencer el plazo.
      const retirar = () => { if (entries.get(key) === entry) entries.delete(key); };
      promise.then(options.soloEnCurso ? retirar : () => undefined, retirar);
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return promise;
    },
    clear: () => entries.clear(),
    size: () => entries.size,
  };
}
