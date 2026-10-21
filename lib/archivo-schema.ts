/**
 * Esquemas de las consultas de /archivo. Aparte del modulo principal a
 * proposito: SOLO los usan las rutas de API de busqueda y chat, mientras que el
 * catalogo de tipos documentales y sus etiquetas los consume el navegador. Juntos,
 * la pantalla del archivo se llevaba zod entero sin usarlo.
 */
import { z } from "zod";

export const archivoSearchSchema = z.object({
  query: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(500),
  docKind: z.string().trim().optional(),
  documentNumber: z.string().trim().optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

export type ArchivoSearchInput = z.infer<typeof archivoSearchSchema>;

export const archivoChatSchema = z.object({
  query: z.string().trim().min(3, "Escribe una pregunta").max(800),
  docKind: z.string().trim().optional(),
});

export type ArchivoChatInput = z.infer<typeof archivoChatSchema>;
