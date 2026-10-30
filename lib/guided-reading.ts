import { z } from "zod";
export const GUIDED_ACTIONS = [
  { id: "explain", label: "Explicar este pasaje" },
  { id: "questions", label: "Identificar las consultas" },
  { id: "conclusions", label: "Resumir las conclusiones" },
  { id: "relate", label: "Relacionar con otras fuentes" },
] as const;
export const guidedReadingSchema = z.object({
  documentId: z.string().uuid(),
  action: z.enum(["explain", "questions", "conclusions", "relate"]),
  chunkId: z.string().uuid().optional(),
  locator: z.string().trim().min(1).max(150).optional(),
  page: z.number().int().min(1).max(20000).optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export function guidedQuestion(
  action: z.infer<typeof guidedReadingSchema>["action"],
  title: string,
  location?: string,
) {
  const task = {
    explain:
      "Explica el pasaje seleccionado y su contexto. Separa texto original e interpretación asistida.",
    questions:
      "Identifica las consultas formuladas en este documento. Distingue preguntas expresas de las que solo puedan inferirse.",
    conclusions:
      "Resume las conclusiones expresas de este documento, separando el criterio de sus condiciones y límites.",
    relate:
      "Relaciona este documento con otras fuentes disponibles. Conserva la fuente inicial e identifica claramente las adicionales.",
  }[action];
  return `${task}\nDocumento seleccionado: ${title}${location ? ` · ${location}` : ""}. Cita cada afirmación sustantiva mediante documento y página o bloque real. No presentes como exhaustivo un análisis basado en fragmentos ni inventes datos ausentes. Indica qué contenido no pudo comprobarse.`;
}
