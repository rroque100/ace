// Estimación de coste de OpenAI por tokens, compartida por el módulo de
// expedientes (subida, chat, búsqueda IA). Precios APROXIMADOS en USD por 1M de
// tokens (input/output); ajústalos si cambian las tarifas. Si el modelo no está
// en la tabla, su coste estimado es 0 (mejor 0 que un número inventado).
export const MODEL_PRICES_USD_PER_M: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES_USD_PER_M[model];
  if (!price) return 0;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

// Redondeo a 5 decimales para guardar/mostrar el coste sin ruido de punto flotante.
export function roundCostUsd(value: number): number {
  return Number(value.toFixed(5));
}
