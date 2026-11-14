import { z } from "zod";
import { examSourceSchema } from "./exam-policy";

export const DURACION_BALOTARIO = 120 * 60;
export const letraSchema = z.enum(["A", "B", "C", "D"]);
export type Letra = z.infer<typeof letraSchema>;
export type PreguntaBalotario = {
  id: string; n: number; competencia: string; pregunta: string;
  opciones: { letra: string; texto: string }[]; correcta?: string;
  explicacion?: string; fuentes?: z.infer<typeof examSourceSchema>[];
  revisada?: boolean; incidencia?: string;
};
export type IntentoBalotario = {
  id: string; balotario: number; state: "active" | "submitted";
  revision: number; started_at: string; deadline_at: string; finished_at: string | null;
  questions: PreguntaBalotario[]; answers: Record<string, Letra>;
  flagged: string[]; position: number;
  result: ResultadoBalotario | null;
};
export type ResultadoBalotario = { correct: number; incorrect: number; omitted: number; total: number; seconds: number; competencies?: { competencia: string; correctas: number; incorrectas: number; omitidas: number; total: number }[] };
export const comandoBalotario = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), balotario: z.number().int().min(1).max(5) }),
  z.object({ action: z.literal("save"), id: z.string().uuid(), revision: z.number().int().nonnegative(), questionId: z.string().regex(/^b[1-5]-q\d+$/), option: letraSchema.nullable(), flagged: z.boolean(), position: z.number().int().min(0).max(71) }),
  z.object({ action: z.literal("submit"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("position"), id: z.string().uuid(), revision: z.number().int().nonnegative(), position: z.number().int().min(0).max(71) }),
]);
export const revisionBalotario = z.object({
  questionId: z.string().regex(/^b[1-5]-q\d+$/),
  prompt: z.string().trim().min(20).max(3000),
  options: z.array(z.object({ id: letraSchema, text: z.string().trim().min(2).max(1000) })).length(4).refine(o => new Set(o.map(x => x.id)).size === 4, "Las opciones deben ser A, B, C y D, sin repetir."),
  explanation: z.string().trim().min(40).max(6000),
  correct: letraSchema,
  competency: z.enum(["COMPETENCIA 1", "COMPETENCIA 2", "COMPETENCIA 3"]),
  sources: z.array(examSourceSchema).min(1).max(6),
});
export function segundosRestantes(deadline: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}
export function calificar(preguntas: PreguntaBalotario[], respuestas: Record<string, string>, started: string, finished: string): ResultadoBalotario {
  const correct = preguntas.filter(q => respuestas[q.id] === q.correcta).length;
  const answered = preguntas.filter(q => respuestas[q.id] != null).length;
  return { correct, incorrect: answered - correct, omitted: preguntas.length - answered, total: preguntas.length,
    seconds: Math.min(DURACION_BALOTARIO, Math.max(0, Math.floor((Date.parse(finished) - Date.parse(started)) / 1000))) };
}
export function intentoPublico(t: IntentoBalotario): IntentoBalotario {
  return t.state === "active" ? { ...t, questions: t.questions.map(q => ({ ...q, correcta: undefined, explicacion: undefined, fuentes: undefined })) } : t;
}
export function nivelBalotario(correct: number, total = 72) {
  const score = total ? correct * 72 / total : 0;
  return score < 30 ? "En preparación" : score < 43 ? "Básico" : score < 58 ? "Intermedio" : "Avanzado";
}
export function barajarPreguntas<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
