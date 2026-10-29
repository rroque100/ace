// Crédito del proveedor de embeddings: detectar que se acabó y no seguir quemando documentos.
//
// Cuando el límite mensual de Google se agotó (HTTP 402) los importadores siguieron con el lote
// entero: cada PDF se descargaba, se subía a Storage, se creaba su fila y fallaba al indexar, así que
// una importación de cientos de pronunciamientos dejó cientos de documentos en `error` (hubo que
// reindexar 217 a mano) y se perdió el tiempo de la descarga de cada uno. Un 402 no es transitorio:
// ningún documento siguiente va a funcionar hasta que alguien recargue, así que lo correcto es parar.
//
// Solo cuenta como «sin crédito» lo que no se arregla esperando. Un 429 suelto es límite por minuto y
// sí se supera reintentando, de modo que no se confunde con esto.

const SIN_CREDITO =
  /embeddings 402|\b402\b[^\n]{0,40}(payment|billing|quota|credit)|payment required|insufficient[_ ]quota|exceeded (your )?(current )?quota|spending cap|monthly (spend|limit|cap)|billing (account|hard limit)|credit balance|out of credits?/i;

/** ¿El error indica que el proveedor de embeddings se quedó sin crédito (y no un fallo pasajero)? */
export function isEmbeddingCreditExhausted(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = (error as { status?: unknown } | null)?.status;
  return status === 402 || SIN_CREDITO.test(message);
}

/**
 * Prueba barata (un embedding de una palabra) para comprobar, ANTES de empezar un lote, que el
 * proveedor responde y tiene saldo. Lanza con un mensaje accionable si no. Cualquier otro fallo (red,
 * clave ausente) también se propaga: empezar un lote con el proveedor caído solo produce errores.
 */
export async function assertEmbeddingCredit(): Promise<void> {
  // Import dinámico: el módulo es puro salvo esta función y los tests no deben cargar el cliente.
  const { embedTexts } = await import("./embeddings");
  try {
    await embedTexts(["prueba"]);
  } catch (error) {
    if (isEmbeddingCreditExhausted(error)) {
      throw new Error("El proveedor de embeddings no tiene crédito (402). Recarga o sube el límite y vuelve a ejecutar; no se ha tocado nada.");
    }
    throw error;
  }
}

/** Texto final cuando un lote se cortó por falta de crédito. */
export function creditStopMessage(pending: number, recoveryHint: string): string {
  return `\nCORTADO por falta de crédito de embeddings: quedan ${pending} sin procesar. ${recoveryHint}`;
}
