import { z } from "zod";
import { CURRICULUM_VERSION, isCurriculumPair } from "./exam-curriculum";
export const OPTION_IDS = ["A", "B", "C", "D"] as const;
export const examStartSchema = z
  .object({
    mode: z.enum(["practice", "exam"]),
    profile: z
      .enum(["custom", "oece", "review", "balotario"])
      .default("custom"),
    balotarioId: z.string().uuid().optional(),
    count: z.number().int().min(1).max(72),
    minutes: z.number().int().min(5).max(180).default(120),
    regime: z.enum(["32069", "30225"]),
    topic: z.string().trim().max(160).default(""),
    competency: z.enum(["", "1", "2", "3"]).default(""),
    preview: z.boolean().default(false),
  })
  .superRefine((v, c) => {
    if (
      (v.profile === "oece" || v.profile === "balotario") &&
      (v.mode !== "exam" ||
        v.count !== 72 ||
        v.minutes !== 120 ||
        v.regime !== "32069" ||
        v.topic !== "" ||
        v.competency !== "" ||
        v.preview)
    )
      c.addIssue({
        code: "custom",
        path: ["profile"],
        message:
          "El perfil OECE requiere 72 preguntas, 120 minutos, Ley 32069 y banco publicado.",
      });
    if (v.profile === "balotario" && !v.balotarioId)
      c.addIssue({
        code: "custom",
        path: ["balotarioId"],
        message: "Elige un balotario.",
      });
    if (v.profile === "review" && (v.mode !== "practice" || v.preview))
      c.addIssue({
        code: "custom",
        path: ["profile"],
        message: "El repaso utiliza preguntas publicadas en modo práctica.",
      });
    if (v.preview && v.mode !== "practice")
      c.addIssue({
        code: "custom",
        path: ["preview"],
        message: "Los borradores solo se prueban en práctica.",
      });
  });
export const examSaveSchema = z.object({
  revision: z.number().int().min(0),
  questionId: z.string().uuid(),
  option: z.enum(OPTION_IDS).nullable(),
  flagged: z.boolean(),
});
export const examSourceSchema = z
  .object({
    documentId: z.string().uuid(),
    chunkId: z.string().uuid(),
    title: z.string().min(3).max(400),
    article: z.string().trim().min(1).max(100),
    pageStart: z.number().int().positive(),
    pageEnd: z.number().int().positive(),
    quote: z.string().trim().min(40).max(5000),
    version: z.string().min(3).max(300),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .refine((s) => s.pageEnd >= s.pageStart, {
    message: "Revisa el rango de páginas.",
  });
export const examQuestionSchema = z
  .object({
    id: z.string().uuid().optional(),
    revision: z.number().int().min(0).default(0),
    prompt: z.string().trim().min(20).max(3000),
    options: z
      .array(
        z.object({
          id: z.enum(OPTION_IDS),
          text: z.string().trim().min(2).max(1000),
        }),
      )
      .length(4),
    correctOption: z.enum(OPTION_IDS),
    explanation: z.string().trim().min(40).max(6000),
    regime: z.enum(["32069", "30225"]),
    topic: z.string().trim().min(3).max(160),
    competency: z.string().trim().min(3).max(160),
    difficulty: z.enum(["basic", "intermediate", "advanced"]),
    curriculumVersion: z.string().default(""),
    competencyCode: z.string().default(""),
    subcompetencyCode: z.string().default(""),
    cognitiveLevel: z
      .enum(["understand", "apply", "analyze"])
      .default("understand"),
    optionRationales: z
      .object({
        A: z.string().max(2000),
        B: z.string().max(2000),
        C: z.string().max(2000),
        D: z.string().max(2000),
      })
      .default({ A: "", B: "", C: "", D: "" }),
    reviewChecks: z
      .object({
        unambiguous: z.boolean(),
        distractors: z.boolean(),
        conditions: z.boolean(),
        exceptions: z.boolean(),
        sources: z.boolean(),
      })
      .default({
        unambiguous: false,
        distractors: false,
        conditions: false,
        exceptions: false,
        sources: false,
      }),
    sourceCutoff: z.string().default(""),
    origin: z.string().max(200).default("manual"),
    sources: z.array(examSourceSchema).min(1).max(5),
    status: z.enum(["draft", "published", "retired"]),
    reviewBasis: z.string().trim().max(4000).default(""),
    confirmReview: z.boolean().default(false),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.options.map((o) => o.id)).size !== 4 ||
      new Set(v.options.map((o) => o.text.toLowerCase())).size !== 4
    )
      c.addIssue({
        code: "custom",
        path: ["options"],
        message: "Las cuatro alternativas deben ser distintas.",
      });
    if (
      v.subcompetencyCode &&
      (!isCurriculumPair(v.competencyCode, v.subcompetencyCode) ||
        v.curriculumVersion !== CURRICULUM_VERSION)
    )
      c.addIssue({
        code: "custom",
        path: ["subcompetencyCode"],
        message:
          "La competencia y subcompetencia no corresponden al temario seleccionado.",
      });
    if (
      v.status === "published" &&
      (!isCurriculumPair(v.competencyCode, v.subcompetencyCode) ||
        v.curriculumVersion !== CURRICULUM_VERSION ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v.sourceCutoff) ||
        Object.values(v.optionRationales).some((x) => x.trim().length < 20) ||
        Object.values(v.reviewChecks).some((x) => !x))
    )
      c.addIssue({
        code: "custom",
        path: ["reviewChecks"],
        message:
          "Completa clasificación, fecha normativa, explicación por alternativa y las cinco comprobaciones editoriales.",
      });
    if (
      v.status === "published" &&
      (!v.confirmReview || v.reviewBasis.length < 20)
    )
      c.addIssue({
        code: "custom",
        path: ["reviewBasis"],
        message: "Registra el sustento de tu revisión antes de publicar.",
      });
  });
export type ExamQuestion = z.infer<typeof examQuestionSchema>;
export type ExamAnswer = {
  question_id: string;
  option: string | null;
  flagged: boolean;
};
export type SnapshotQuestion = {
  id: string;
  revision: number;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correct_option: string;
  explanation: string;
  topic: string;
  competency: string;
  difficulty: string;
  subcompetency_code?: string;
  competency_code?: string;
  cognitive_level?: string;
  curriculum_version?: string;
  source_cutoff?: string;
  option_rationales?: Record<string, string>;
  sources: ExamQuestion["sources"];
};
export type RawExam = {
  attempt: {
    id: string;
    mode: string;
    preview: boolean;
    regime: string;
    question_count: number;
    profile?: string;
    review_context?: { updated: number; unavailable: number } | null;
    state: string;
    revision: number;
    started_at: string;
    deadline_at: string | null;
    finished_at: string | null;
    last_question_id?: string | null;
    questions: SnapshotQuestion[];
    result: ExamResult | null;
  };
  answers: ExamAnswer[];
  serverNow: string;
};
export type ExamResult = {
  total: number;
  answered: number;
  correct: number;
  omitted: number;
  incorrect: number;
  topics: Array<{ topic: string; total: number; correct: number }>;
};
export function publicExam(raw: RawExam) {
  const a = raw.attempt;
  const { questions, ...safe } = a;
  return {
    attempt: {
      ...safe,
      questions: questions.map((q) => {
        const answered = raw.answers.find(
          (x) => x.question_id === q.id,
        )?.option;
        const reveal =
          a.state === "submitted" ||
          (a.mode === "practice" && a.state === "active" && Boolean(answered));
        return {
          id: q.id,
          revision: q.revision,
          prompt: q.prompt,
          options: q.options,
          topic: q.topic,
          competency: q.competency,
          difficulty: q.difficulty,
          subcompetencyCode: q.subcompetency_code,
          competencyCode: q.competency_code,
          cognitiveLevel: q.cognitive_level,
          sourceCutoff: q.source_cutoff,
          ...(reveal
            ? {
                correctOption: q.correct_option,
                explanation: q.explanation,
                optionRationales: q.option_rationales,
                sources: q.sources,
              }
            : {}),
        };
      }),
    },
    answers: raw.answers.map((x) => ({
      question_id: x.question_id,
      option: x.option,
      flagged: x.flagged,
    })),
    serverNow: raw.serverNow,
  };
}
export type PublicExam = ReturnType<typeof publicExam>;
export function remainingSeconds(deadline: string | null, serverNow: number) {
  return deadline
    ? Math.max(0, Math.ceil((Date.parse(deadline) - serverNow) / 1000))
    : null;
}

export function examReviewFingerprint(q: ExamQuestion) {
  return JSON.stringify([
    q.prompt,
    q.options.map((o) => [o.id, o.text]),
    q.correctOption,
    q.explanation,
    q.regime,
    q.topic,
    q.competency,
    q.difficulty,
    q.curriculumVersion,
    q.competencyCode,
    q.subcompetencyCode,
    q.cognitiveLevel,
    q.sourceCutoff,
    OPTION_IDS.map((id) => q.optionRationales[id]),
    q.sources.map((s) => [
      s.documentId,
      s.chunkId,
      s.sha256,
      s.quote,
      s.article,
      s.pageStart,
      s.pageEnd,
      s.version,
      s.title,
    ]),
  ]);
}
