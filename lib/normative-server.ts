import { supabaseRest } from "./supabase-server";
/** Administrative auxiliary reads: explicit complete traversal, never silent limits. */
export async function loadNormativeRows<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page=0; page<200; page++) {
    const result = await supabaseRest<T[]>(`${path}&order=id.asc&offset=${page*500}&limit=500`);
    if (!Array.isArray(result)) throw new Error("Respuesta documental inválida");
    rows.push(...result);
    if (result.length<500) return rows;
  }
  throw new Error("La consulta supera el límite operativo; acota la selección.");
}
export async function optionalNormativeRows<T>(path: string, warning: string, warnings: string[]) {
  try { return await loadNormativeRows<T>(path); }
  catch { warnings.push(warning); return [] as T[]; }
}
