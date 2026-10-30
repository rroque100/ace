// Tarifas para ESTIMAR el costo de la IA que consume cada cuenta. Los tokens que registra el sistema son los que
// devuelve el proveedor; el costo no: es tokens × tarifa de lista, y las tarifas cambian y dependen del plan.
// Por eso el panel lo llama «costo estimado» y las tarifas se pueden sustituir sin tocar el código con la variable
// `AI_PRICING_JSON`, p. ej.:
//
//   AI_PRICING_JSON={"gemini-2.5-flash":{"entrada":0.30,"salida":2.50},"gemini-embedding-001":{"entrada":0.15,"salida":0}}
//
// Cifras: dólares por MILLÓN de tokens. Los valores de abajo son las tarifas de lista conocidas al escribir esto
// (octubre de 2026) y hay que revisarlas; un modelo sin tarifa cuesta 0 y se marca como «sin tarifa» en el panel
// en vez de inventar un precio. Módulo puro.

export type Tarifa = { entrada: number; salida: number };

const TARIFAS_BASE: Record<string, Tarifa> = {
  // OpenCode Console official list, checked 2026-10-30; estimates exclude credit purchase fees.
  "gemini-3.8-flash": { entrada: 1.5, salida: 7.5 },
  "gemini-2.5-flash-lite": { entrada: 0.1, salida: 0.4 },
  "gemini-2.5-flash": { entrada: 0.3, salida: 2.5 },
  "gemini-embedding-001": { entrada: 0.15, salida: 0 },
  // El plan gratuito de Z.ai no cobra por token.
  "glm-4.5-flash": { entrada: 0, salida: 0 },
  "gpt-4o-mini-transcribe": { entrada: 1.25, salida: 5 },
  "gpt-4o-mini": { entrada: 0.15, salida: 0.6 },
  "gpt-4o": { entrada: 2.5, salida: 10 },
  "text-embedding-3-small": { entrada: 0.02, salida: 0 },
  "text-embedding-3-large": { entrada: 0.13, salida: 0 },
};

function tarifasConfiguradas(entorno: string | undefined): Record<string, Tarifa> {
  if (!entorno) return TARIFAS_BASE;
  try {
    const dato = JSON.parse(entorno) as Record<string, { entrada?: unknown; salida?: unknown }>;
    const propias: Record<string, Tarifa> = {};
    for (const [modelo, valor] of Object.entries(dato)) {
      if (valor && typeof valor.entrada === "number" && valor.entrada >= 0 && typeof valor.salida === "number" && valor.salida >= 0) propias[modelo.toLowerCase()] = { entrada: valor.entrada, salida: valor.salida };
    }
    // Lo configurado manda, y lo que no se menciona conserva su tarifa base.
    return { ...TARIFAS_BASE, ...propias };
  } catch {
    return TARIFAS_BASE;
  }
}

/** La tarifa de un modelo: coincidencia exacta o por prefijo más largo («gemini-2.5-flash-preview-09-2025» → gemini-2.5-flash). */
export function tarifaDe(modelo: string, entorno: string | undefined = process.env.AI_PRICING_JSON): Tarifa | null {
  const tarifas = tarifasConfiguradas(entorno);
  const nombre = modelo.toLowerCase().trim();
  if (tarifas[nombre]) return tarifas[nombre];
  const candidatos = Object.keys(tarifas).filter((clave) => nombre.startsWith(clave)).sort((a, b) => b.length - a.length);
  return candidatos.length ? tarifas[candidatos[0]] : null;
}

/** Costo estimado en dólares; 6 decimales porque una consulta cuesta fracciones de centavo. */
export function costoEstimado(modelo: string, tokensEntrada: number, tokensSalida: number, entorno?: string): { costo: number; sinTarifa: boolean } {
  const tarifa = tarifaDe(modelo, entorno ?? process.env.AI_PRICING_JSON);
  if (!tarifa) return { costo: 0, sinTarifa: true };
  const costo = (Math.max(0, tokensEntrada) * tarifa.entrada + Math.max(0, tokensSalida) * tarifa.salida) / 1_000_000;
  return { costo: Math.round(costo * 1e6) / 1e6, sinTarifa: false };
}
