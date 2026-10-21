/**
 * Esquemas de validacion del PUT de admisibilidad. Aparte del catalogo a
 * proposito: `necesidad-detail.tsx` solo necesita `contarAdmisibilidad`, y al
 * importarla del mismo modulo que estos esquemas se llevaba zod al navegador.
 * Solo los usan las rutas de API.
 */
import { z } from "zod";
import { ADMISIBILIDAD_ITEMS, type AdmisibilidadEstado } from "./necesidad-admisibilidad";

const CLAVES = new Set(ADMISIBILIDAD_ITEMS.map((i) => i.key));

export const admisibilidadItemSchema = z.object({
  ok: z.boolean(),
  nota: z.string().trim().max(500).optional(),
});

/**
 * Body del PUT: mapa clave→estado. Se descartan claves que no son del catálogo
 * (una versión vieja del cliente no debe poder inyectar puntos inventados).
 */
export const admisibilidadUpdateSchema = z.object({
  items: z.record(z.string(), admisibilidadItemSchema).transform((items) => {
    const limpio: AdmisibilidadEstado = {};
    for (const [key, valor] of Object.entries(items)) {
      if (CLAVES.has(key)) limpio[key] = valor;
    }
    return limpio;
  }),
});
