import { describe, it, expect } from "vitest";
import {
  publicExam,
  examStartSchema,
  examQuestionSchema,
  remainingSeconds,
  type RawExam,
} from "../lib/exam-policy";
const raw = (mode = "exam", state = "active"): RawExam => ({
  attempt: {
    id: "a",
    mode,
    state,
    preview: false,
    regime: "32069",
    question_count: 1,
    revision: 0,
    started_at: "2026-01-01T00:00:00Z",
    deadline_at: null,
    finished_at: null,
    result: null,
    questions: [
      {
        id: "q",
        revision: 1,
        prompt: "Pregunta",
        options: [
          { id: "A", text: "Uno" },
          { id: "B", text: "Dos" },
          { id: "C", text: "Tres" },
          { id: "D", text: "Cuatro" },
        ],
        correct_option: "C",
        explanation: "Explicación privada",
        topic: "Tema",
        competency: "Competencia",
        difficulty: "basic",
        sources: [],
      },
    ],
  },
  answers: [],
  serverNow: "2026-01-01T00:00:00Z",
});
describe("exámenes: aislamiento de claves", () => {
  it("no expone claves ni explicación antes de entregar, aunque haya respuesta", () => {
    const x = raw();
    x.answers = [{ question_id: "q", option: "A", flagged: false }];
    const v = publicExam(x);
    expect(JSON.stringify(v)).not.toContain("correctOption");
    expect(JSON.stringify(v)).not.toContain("Explicación privada");
    expect(JSON.stringify(v)).not.toContain("correct_option");
  });
  it("revela únicamente preguntas contestadas en práctica", () => {
    const x = raw("practice");
    expect(publicExam(x).attempt.questions[0]).not.toHaveProperty(
      "correctOption",
    );
    x.answers = [{ question_id: "q", option: "A", flagged: false }];
    expect(publicExam(x).attempt.questions[0].correctOption).toBe("C");
  });
  it("entrega permite revisar la clave; cancelación no la expone", () => {
    expect(
      publicExam(raw("exam", "submitted")).attempt.questions[0].correctOption,
    ).toBe("C");
    expect(
      publicExam(raw("exam", "cancelled")).attempt.questions[0],
    ).not.toHaveProperty("correctOption");
  });
  it("validaciones impiden un examen de borradores y tamaños inválidos", () => {
    expect(
      examStartSchema.safeParse({
        mode: "exam",
        preview: true,
        count: 10,
        regime: "32069",
      }).success,
    ).toBe(false);
    expect(
      examStartSchema.safeParse({
        mode: "practice",
        count: 73,
        regime: "32069",
      }).success,
    ).toBe(false);
  });
  it("el reloj se deriva del vencimiento y no admite negativos", () => {
    expect(
      remainingSeconds(
        "2026-01-01T00:01:00Z",
        Date.parse("2026-01-01T00:00:40Z"),
      ),
    ).toBe(20);
    expect(
      remainingSeconds(
        "2026-01-01T00:00:00Z",
        Date.parse("2026-01-01T00:01:00Z"),
      ),
    ).toBe(0);
  });
  it("el banco rechaza preguntas incompletas", () => {
    expect(
      examQuestionSchema.safeParse({ prompt: "Pregunta sin fuente" }).success,
    ).toBe(false);
  });
});

it("publicar exige confirmación y sustento de revisión", () => {
  const question = {
    prompt: "Pregunta sintética para probar el flujo de revisión",
    options: [
      { id: "A", text: "Uno" },
      { id: "B", text: "Dos" },
      { id: "C", text: "Tres" },
      { id: "D", text: "Cuatro" },
    ],
    correctOption: "A",
    explanation:
      "Explicación sintética usada exclusivamente para validar el formulario.",
    regime: "32069",
    topic: "Tema",
    competency: "Competencia",
    difficulty: "basic",
    sources: [
      {
        documentId: "11111111-1111-4111-8111-111111111111",
        chunkId: "22222222-2222-4222-8222-222222222222",
        title: "Fuente sintética",
        article: "1",
        pageStart: 1,
        pageEnd: 1,
        quote:
          "Este pasaje sintético permite probar validaciones del formulario.",
        version: "Prueba sintética",
        sha256: "a".repeat(64),
      },
    ],
    status: "published",
    reviewBasis: "Revisión sintética del formulario, sin contenido normativo.",
  };
  expect(examQuestionSchema.safeParse(question).success).toBe(false);
  expect(
    examQuestionSchema.safeParse({ ...question, confirmReview: true }).success,
  ).toBe(true);
});
