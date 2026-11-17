import { COMPETENCIES, EXAM_CURRICULUM } from "./exam-curriculum";
import type { StudyAttempt } from "./exam-learning-policy";
import type { ExamAnswer } from "./exam-policy";

export type ExamCoaching = {
  practiced: number;
  correct: number;
  accuracy: number | null;
  competencies: Array<{
    code: string;
    label: string;
    total: number;
    correct: number;
    omitted: number;
    accuracy: number | null;
  }>;
  recommendation: {
    competency: string;
    /** Código de subcompetencia del tema débil (p. ej. «2.8»); vacío si no hay tema débil. */
    code: string;
    topic: string;
    reason: "errors" | "unseen" | "continue";
  };
};

const accuracy = (correct: number, total: number) =>
  total ? Math.round((correct / total) * 100) : null;

/** Agregados de la última exposición válida por pregunta, sin datos privados. */
export function buildExamCoaching(
  attempts: StudyAttempt[],
  answers: Array<ExamAnswer & { attempt_id: string }>,
): ExamCoaching {
  const now = Date.now();
  const competencies = Object.entries(COMPETENCIES).map(([code, label]) => ({
    code, label, total: 0, correct: 0, omitted: 0,
    accuracy: null as number | null,
  }));
  const results = new Map<string, Map<string, string | null>>();
  for (const a of answers) {
    if (!a || typeof a.attempt_id !== "string" || typeof a.question_id !== "string") continue;
    const row = results.get(a.attempt_id) ?? new Map<string, string | null>();
    row.set(a.question_id, a.option);
    results.set(a.attempt_id, row);
  }
  const eligible = attempts.filter((t) =>
    t && t.regime === "32069" && t.state === "submitted" &&
    t.preview === false && typeof t.id === "string" &&
    typeof t.finished_at === "string" &&
    Number.isFinite(Date.parse(t.finished_at)) && Date.parse(t.finished_at) <= now &&
    Array.isArray(t.questions),
  ).sort((a, b) =>
    Date.parse(b.finished_at!) - Date.parse(a.finished_at!) ||
    (Date.parse(b.started_at) || 0) - (Date.parse(a.started_at) || 0) ||
    a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();
  // Los errores se agrupan por código de subcompetencia: con el código, la clase del curso que enseña el tema
  // se resuelve en el cliente con el mapa compacto de lib/cursos/clases-tema.ts.
  const topics = new Map<string, { competency: string; code: string; topic: string; errors: number }>();
  for (const t of eligible) {
    for (const q of t.questions) {
      if (!q || typeof q.id !== "string" || seen.has(q.id)) continue;
      seen.add(q.id);
      const classification = EXAM_CURRICULUM.find((s) =>
        s.competency === q.competency_code && s.code === q.subcompetency_code,
      );
      if (!classification) continue;
      const row = competencies.find((c) => c.code === classification.competency)!;
      const option = results.get(t.id)?.get(q.id);
      const omitted = !option;
      const correct = !omitted && option === q.correct_option;
      row.total++;
      row.correct += Number(correct);
      row.omitted += Number(omitted);
      if (!correct) {
        const entry = topics.get(classification.code) ?? {
          competency: row.code,
          code: classification.code,
          topic: typeof q.topic === "string" && q.topic.trim() ? q.topic : classification.label,
          errors: 0,
        };
        entry.errors++;
        topics.set(classification.code, entry);
      }
    }
  }
  for (const row of competencies) row.accuracy = accuracy(row.correct, row.total);
  const practiced = competencies.reduce((n, c) => n + c.total, 0);
  const correct = competencies.reduce((n, c) => n + c.correct, 0);
  const weakest = [...topics.values()].sort((a, b) =>
    b.errors - a.errors || a.code.localeCompare(b.code),
  )[0];
  const next = [...competencies].sort((a, b) => a.total - b.total || a.code.localeCompare(b.code))[0];
  return {
    practiced, correct, accuracy: accuracy(correct, practiced), competencies,
    recommendation: weakest
      ? { competency: weakest.competency, code: weakest.code, topic: weakest.topic, reason: "errors" as const }
      : { competency: next.code, code: "", topic: "", reason: next.total ? "continue" as const : "unseen" as const },
  };
}
