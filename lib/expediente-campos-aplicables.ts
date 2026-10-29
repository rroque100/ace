// Módulo puro, sin dependencias de servidor, a propósito: `app/components/fase-panel.tsx` es un componente de
// cliente y necesita `camposAplicables`. Vivía en `expediente-copiloto.ts`, que también importa `openai-server`
// (y con él la medición de IA, que usa `node:async_hooks` y `next/headers`); el bundler del cliente no puede
// empaquetar eso y el build de producción fallaba. Un componente de cliente nunca debe importar de ese módulo.

function comoTexto(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * De la propuesta del copiloto (`api → texto`), qué campos conviene APLICAR: solo
 * los que están VACÍOS en el paso, para no pisar lo que la DEC ya escribió. Es la
 * misma disciplina de la precarga («rellena huecos, no sobrescribe»).
 */
export function camposAplicables(
  propuesta: Record<string, string>,
  a3Data: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, texto] of Object.entries(propuesta)) {
    if (!texto?.trim()) continue;
    if (comoTexto(a3Data[key]).trim() === "") out[key] = texto;
  }
  return out;
}
