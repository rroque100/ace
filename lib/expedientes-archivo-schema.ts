/**
 * Esquemas de las consultas de /expedientes-archivo. Aparte del modulo principal
 * a proposito: SOLO los usan dos rutas de API (search y chat), mientras que los
 * catalogos y ayudantes de ese modulo (ARCHIVO_COLORES, CONTENEDOR_TIPOS,
 * contenedorTipoLabel...) los consumen componentes de navegador. Al vivir juntos,
 * cada pantalla del archivo se llevaba zod entero de propina.
 */
import { z } from "zod";

// ── Esquemas de consulta ──────────────────────────────────────────────────────
export const expedienteSearchSchema = z.object({
  documentId: z.string().uuid().optional(),
  query: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(500),
  serieDocumento: z.string().trim().optional(),
  oficina: z.string().trim().max(200).optional(),
  materia: z.string().trim().max(200).optional(),
  anio: z.coerce.number().int().min(1900).max(2200).optional(),
  topK: z.number().int().min(1).max(30).optional(),
});
export type ExpedienteSearchInput = z.infer<typeof expedienteSearchSchema>;
export const expedienteChatSchema = z.object({
  documentId: z.string().uuid().optional(),
  query: z.string().trim().min(3, "Escribe una pregunta").max(800),
  anio: z.coerce.number().int().min(1900).max(2200).optional(),
  oficina: z.string().trim().max(200).optional(),
});
export type ExpedienteChatInput = z.infer<typeof expedienteChatSchema>;
