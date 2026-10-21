import { TIPOS_DOCUMENTO_DEFAULT } from "./document-number";
import { supabaseRest, tragarPeroRegistrar } from "./supabase-server";

/**
 * Siembra los contadores por defecto de una oficina recién creada.
 *
 * Solo se llama al CREAR la oficina, nunca al leer: una oficina que se quede
 * sin contadores no se recupera sola. Por eso el fallo se registra —antes se
 * tragaba en silencio y una oficina llegó a quedarse sin numeración sin que
 * nadie lo notase—.
 */
export async function seedCounters(oficinaId: string, year: number) {
  await supabaseRest("expedientes_doc_counters", {
    body: JSON.stringify(
      TIPOS_DOCUMENTO_DEFAULT.map((tipo) => ({
        oficina_id: oficinaId,
        tipo,
        siguiente: 1,
        year,
      })),
    ),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    method: "POST",
  }).catch(tragarPeroRegistrar("oficinas.seedCounters"));
}
