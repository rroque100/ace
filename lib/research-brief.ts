import { z } from "zod";
export const researchBriefSchema = z.object({
  research_question: z.string().trim().max(3000).default(""),
  research_objective: z.string().trim().max(3000).default(""),
  research_notes: z.string().trim().max(15000).default(""),
  research_status: z.enum(["draft", "review", "closed"]).default("draft"),
});
export type ResearchBrief = z.infer<typeof researchBriefSchema>;
export function briefText(b: ResearchBrief) {
  return `Pregunta de trabajo: ${b.research_question || "Sin precisar"}\nObjetivo: ${b.research_objective || "Sin precisar"}\nEstado: ${{ draft: "Borrador", review: "En revisión", closed: "Cerrado" }[b.research_status]}\nNotas personales: ${b.research_notes || "Sin notas"}`;
}
