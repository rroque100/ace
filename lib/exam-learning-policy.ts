import type { PublicExam, ExamAnswer, SnapshotQuestion } from "./exam-policy";
export type StudyAttempt = {
  id: string;
  started_at: string;
  finished_at: string | null;
  preview: boolean;
  state: string;
  regime: string;
  balotario_id?: string | null;
  questions: SnapshotQuestion[];
};
export type StudyReview = {
  questionId: string;
  revision: number;
  topic: string;
  regime: string;
  dueAt: string;
  stage: number;
  due: boolean;
  status: "pendiente" | "en repaso" | "recordada en varios días";
};
const DAY = 86400000;
const INTERVALS = [1, 3, 7, 14, 30];
/** Derivado exclusivamente de intentos entregados; una repetición el mismo día no demuestra retención. */
export function scheduledReviews(
  attempts: StudyAttempt[],
  answers: Array<ExamAnswer & { attempt_id: string }>,
  now = Date.now(),
): StudyReview[] {
  const results = new Map(
    answers.map((a) => [a.attempt_id + ":" + a.question_id, a.option]),
  );
  const rows = new Map<
    string,
    {
      q: SnapshotQuestion;
      regime: string;
      failed: boolean;
      stage: number;
      last: number;
      due: number;
    }
  >();
  for (const t of [...attempts]
    .filter((t) => t.state === "submitted" && !t.preview && t.finished_at)
    .sort(
      (a, b) =>
        Date.parse(a.finished_at!) - Date.parse(b.finished_at!) ||
        a.id.localeCompare(b.id),
    )) {
    const at = Date.parse(t.finished_at!);
    if (!Number.isFinite(at) || at > now) continue;
    for (const q of t.questions) {
      const old = rows.get(q.id);
      const same = old?.q.revision === q.revision;
      const correct = results.get(t.id + ":" + q.id) === q.correct_option;
      if (!correct) {
        rows.set(q.id, {
          q,
          regime: t.regime,
          failed: true,
          stage: 0,
          last: at,
          due: at + DAY,
        });
        continue;
      }
      if (!old?.failed) {
        rows.set(q.id, {
          q,
          regime: t.regime,
          failed: false,
          stage: 0,
          last: at,
          due: at,
        });
        continue;
      }
      if (!same) {
        rows.set(q.id, {
          q,
          regime: t.regime,
          failed: true,
          stage: 0,
          last: at,
          due: at + DAY,
        });
        continue;
      }
      const stage = old.stage;
      const spaced = at >= old.due && at - old.last >= DAY;
      const nextStage = spaced
        ? Math.min(stage + 1, INTERVALS.length - 1)
        : stage;
      rows.set(q.id, {
        q,
        regime: t.regime,
        failed: true,
        stage: nextStage,
        last: spaced ? at : old.last,
        due: spaced ? at + INTERVALS[nextStage] * DAY : old.due,
      });
    }
  }
  return [...rows.values()]
    .filter((r) => r.failed)
    .map((r) => ({
      questionId: r.q.id,
      revision: r.q.revision,
      regime: r.regime,
      topic: r.q.topic,
      dueAt: new Date(r.due).toISOString(),
      stage: r.stage,
      due: r.due <= now,
      status:
        r.stage >= 2
          ? ("recordada en varios días" as const)
          : r.stage
            ? ("en repaso" as const)
            : ("pendiente" as const),
    }))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}
export function examStudyReport(exam: PublicExam) {
  if (exam.attempt.state !== "submitted") return null;
  const topics = new Map<
    string,
    {
      topic: string;
      total: number;
      correct: number;
      omitted: number;
      sources: NonNullable<
        PublicExam["attempt"]["questions"][number]["sources"]
      >;
    }
  >();
  for (const q of exam.attempt.questions) {
    const a = exam.answers.find((a) => a.question_id === q.id);
    const row = topics.get(q.topic) ?? {
      topic: q.topic,
      total: 0,
      correct: 0,
      omitted: 0,
      sources: [],
    };
    row.total++;
    row.correct += Number(a?.option === q.correctOption);
    row.omitted += Number(!a?.option);
    if (a?.option !== q.correctOption)
      for (const s of q.sources ?? [])
        if (
          !row.sources.some(
            (x) =>
              x.documentId === s.documentId &&
              x.article === s.article &&
              x.pageStart === s.pageStart,
          )
        )
          row.sources.push(s);
    topics.set(q.topic, row);
  }
  return [...topics.values()].sort(
    (a, b) => a.correct / a.total - b.correct / b.total,
  );
}
export function resumeQuestionIndex(
  questions: Array<{ id: string }>,
  hash: string,
  lastId?: string | null,
) {
  const match = /^#q=(\d+)$/.exec(hash);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= questions.length) return n - 1;
  }
  const saved = questions.findIndex((q) => q.id === lastId);
  return saved >= 0 ? saved : 0;
}
export function reviewPriority<
  T extends {
    code: string;
    quota: number;
    published: number;
    drafts: number;
  },
>(coverage: T[]) {
  return coverage
    .filter((c) => c.published < c.quota)
    .map((c) => ({ ...c, missing: c.quota - c.published }))
    .sort((a, b) => b.missing - a.missing || a.code.localeCompare(b.code));
}
/** Solo recupera una respuesta de esta pestaña que pertenezca al intento activo recibido del servidor. */
export function recoverPendingAnswer(raw: string | null, exam: PublicExam) {
  if (!raw || raw.length > 4000 || exam.attempt.state !== "active") return null;
  try {
    const p = JSON.parse(raw);
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.questionId !== "string" ||
      typeof p.flagged !== "boolean"
    )
      return null;
    const q = exam.attempt.questions.find((q) => q.id === p.questionId);
    if (!q || (p.option !== null && !q.options.some((o) => o.id === p.option)))
      return null;
    return {
      questionId: p.questionId as string,
      option: p.option as string | null,
      flagged: p.flagged as boolean,
    };
  } catch {
    return null;
  }
}
