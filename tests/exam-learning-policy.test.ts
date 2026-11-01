import { describe, it, expect } from "vitest";
import {
  scheduledReviews,
  resumeQuestionIndex,
  reviewPriority,
  examStudyReport,
  type StudyAttempt,
} from "../lib/exam-learning-policy";
import type { SnapshotQuestion, PublicExam } from "../lib/exam-policy";
const day = 86400000,
  base = Date.UTC(2026, 9, 1),
  q = {
    id: "q1",
    revision: 1,
    topic: "Garantías",
    correct_option: "B",
  } as SnapshotQuestion;
const t = (
  id: string,
  days: number,
  preview = false,
  revision = 1,
): StudyAttempt => ({
  id,
  preview,
  regime: "32069",
  started_at: new Date(base + days * day).toISOString(),
  finished_at: new Date(base + days * day).toISOString(),
  state: "submitted",
  questions: [{ ...q, revision }],
});
const a = (id: string, option: string | null) => ({
  attempt_id: id,
  question_id: "q1",
  option,
  flagged: false,
});
describe("plan de repaso privado", () => {
  it("excluye vistas administrativas, intentos activos y fechas futuras", () => {
    expect(
      scheduledReviews(
        [t("a", 0, true), { ...t("b", 0), state: "active" }, t("c", 20)],
        [],
        base + day,
      ),
    ).toEqual([]);
  });
  it("programa omisión o error para el día siguiente", () => {
    const r = scheduledReviews([t("a", 0)], [a("a", null)], base + day);
    expect(r[0]).toMatchObject({ due: true, stage: 0 });
    expect(Date.parse(r[0].dueAt)).toBe(base + day);
  });
  it("repetir antes de 24 horas no incrementa la retención ni retrasa el repaso", () => {
    const r = scheduledReviews(
      [t("a", 0), t("b", 0.5)],
      [a("a", "A"), a("b", "B")],
      base + day,
    );
    expect(r[0]).toMatchObject({ stage: 0, due: true });
  });
  it("aciertos espaciados incrementan el intervalo", () => {
    const r = scheduledReviews(
      [t("a", 0), t("b", 1), t("c", 4)],
      [a("a", "A"), a("b", "B"), a("c", "B")],
      base + 5 * day,
    );
    expect(r[0]).toMatchObject({
      stage: 2,
      due: false,
      status: "recordada en varios días",
    });
    expect(Date.parse(r[0].dueAt)).toBe(base + 11 * day);
  });
  it("un error posterior reinicia el intervalo", () => {
    const r = scheduledReviews(
      [t("a", 0), t("b", 1), t("c", 4)],
      [a("a", "A"), a("b", "B"), a("c", "A")],
      base + 5 * day,
    );
    expect(r[0]).toMatchObject({ stage: 0, due: true });
  });
  it("una versión diferente no hereda dominio de la anterior", () => {
    const r = scheduledReviews(
      [t("a", 0), t("b", 1), t("c", 4, false, 2)],
      [a("a", "A"), a("b", "B"), a("c", "B")],
      base + 4 * day,
    );
    expect(r[0]).toMatchObject({ stage: 0, revision: 2, due: false });
  });
  it("las preguntas que siempre fueron correctas no inventan errores", () => {
    expect(scheduledReviews([t("a", 0)], [a("a", "B")], base + day)).toEqual(
      [],
    );
  });
});
it("recupera posición validando rango y priorizando el enlace", () => {
  const qs = [{ id: "a" }, { id: "b" }];
  expect(resumeQuestionIndex(qs, "#q=2", "a")).toBe(1);
  expect(resumeQuestionIndex(qs, "#q=999", "b")).toBe(1);
  expect(resumeQuestionIndex(qs, "#q=x", "otro")).toBe(0);
});
it("prioriza cuotas faltantes y conserva etiquetas", () => {
  expect(
    reviewPriority([
      { code: "1", label: "uno", quota: 5, published: 5, drafts: 50 },
      { code: "2", label: "dos", quota: 8, published: 1, drafts: 9 },
    ]),
  ).toEqual([
    { code: "2", label: "dos", quota: 8, published: 1, drafts: 9, missing: 7 },
  ]);
});
it("no muestra el informe antes de entregar", () => {
  expect(examStudyReport({ attempt: { state: "active" } } as PublicExam)).toBe(
    null,
  );
});
it("el informe ordena temas por resultados y conserva fuentes de errores", () => {
  const source = { documentId: "d", article: "a", pageStart: 3 };
  const exam = {
    attempt: {
      state: "submitted",
      questions: [
        { id: "a", topic: "Fuerte", correctOption: "A", sources: [] },
        { id: "b", topic: "Débil", correctOption: "B", sources: [source] },
      ],
    },
    answers: [
      { question_id: "a", option: "A" },
      { question_id: "b", option: null },
    ],
  } as unknown as PublicExam;
  const r = examStudyReport(exam)!;
  expect(r[0]).toMatchObject({ topic: "Débil", omitted: 1, correct: 0 });
  expect(r[0].sources).toHaveLength(1);
});
import { recoverPendingAnswer } from "../lib/exam-learning-policy";
const resumable = {
  attempt: {
    state: "active",
    questions: [{ id: "a", options: [{ id: "A", text: "Fixture" }] }],
  },
} as unknown as PublicExam;
it("recupera solo campos de respuesta válidos, sin confiar en revisiones o actores almacenados", () => {
  expect(
    recoverPendingAnswer(
      JSON.stringify({
        questionId: "a",
        option: "A",
        flagged: true,
        actor: "ajeno",
        revision: 999,
      }),
      resumable,
    ),
  ).toEqual({ questionId: "a", option: "A", flagged: true });
});
it("rechaza pendientes ajenos, corruptos o de un intento entregado", () => {
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ questionId: "otro", option: "A", flagged: false }),
    JSON.stringify({ questionId: "a", option: "X", flagged: false }),
  ])
    expect(recoverPendingAnswer(raw, resumable)).toBe(null);
  expect(
    recoverPendingAnswer(
      JSON.stringify({ questionId: "a", option: "A", flagged: false }),
      { ...resumable, attempt: { ...resumable.attempt, state: "submitted" } },
    ),
  ).toBe(null);
});
