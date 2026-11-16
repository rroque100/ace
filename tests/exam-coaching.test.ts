import { expect, it } from "vitest";
import { buildExamCoaching } from "../lib/exam-coaching";
import type { StudyAttempt } from "../lib/exam-learning-policy";
import type { SnapshotQuestion } from "../lib/exam-policy";

const q = (id = "q1", competency = "1", topic = "Expediente") => ({
  id, revision: 1, competency_code: competency,
  subcompetency_code: `${competency}.1`, topic, correct_option: "B",
} as SnapshotQuestion);
const t = (id = "a", questions = [q()], extra: Partial<StudyAttempt> = {}): StudyAttempt => ({
  id, questions, regime: "32069", state: "submitted", preview: false,
  started_at: "2020-01-01T00:00:00Z", finished_at: "2020-01-02T00:00:00Z", ...extra,
});
const a = (attempt_id = "a", question_id = "q1", option: string | null = "B") => ({
  attempt_id, question_id, option, flagged: false,
});

it("sin datos devuelve tres competencias e inicio en la primera", () => {
  const r = buildExamCoaching([], []);
  expect(r).toMatchObject({ practiced: 0, correct: 0, accuracy: null,
    recommendation: { competency: "1", topic: "", reason: "unseen" } });
  expect(r.competencies.map(c => [c.code, c.total, c.accuracy])).toEqual([
    ["1", 0, null], ["2", 0, null], ["3", 0, null],
  ]);
});

it("excluye 30225, preview, active, cancelled, fechas inválidas y futuras e intentos incompletos", () => {
  const invalid = [
    { regime: "30225" }, { preview: true }, { state: "active" }, { state: "cancelled" },
    { finished_at: null }, { finished_at: "invalid" }, { finished_at: "2999-01-01" },
    { preview: undefined }, { questions: undefined },
  ];
  expect(buildExamCoaching([
    ...invalid.map((extra, i) => t(String(i), [q(String(i))], extra)),
    { id: "private", questions: [{ correct_option: "SECRETO" }] } as StudyAttempt,
  ], []).practiced).toBe(0);
});

it("solo cuenta la última exposición por ID aunque cambie la revisión y elimina errores corregidos", () => {
  const attempts = [t("a"), t("b", [{ ...q(), revision: 2 }], { finished_at: "2020-02-01" })];
  const r = buildExamCoaching(attempts, [a("a", "q1", "A"), a("b")]);
  expect(r).toMatchObject({ practiced: 1, correct: 1, accuracy: 100,
    recommendation: { competency: "2", topic: "", reason: "unseen" } });
  expect(attempts.map(x => x.id)).toEqual(["a", "b"]);
});

it("desempata por inicio descendente e ID estable independientemente del orden recibido", () => {
  const attempts = [t("b"), t("a"), t("c", [q()], { started_at: "2019-01-01" })];
  const answers = [a("a"), a("b", "q1", "A"), a("c", "q1", "A")];
  expect(buildExamCoaching(attempts, answers).correct).toBe(1);
  expect(buildExamCoaching([...attempts].reverse(), answers)).toEqual(buildExamCoaching(attempts, answers));
});

it("omisiones explícitas y respuestas ausentes cuentan como no aciertos y priorizan el tema con más errores", () => {
  const r = buildExamCoaching([t("a", [q(), q("q2", "2", "Selección"), q("q3", "2", "Selección"), q("q4")])],
    [a("a", "q1", "A"), a("a", "q2", null), a("a", "q4")]);
  expect(r).toMatchObject({ practiced: 4, correct: 1, accuracy: 25,
    recommendation: { competency: "2", topic: "Selección", reason: "errors" } });
  expect(r.competencies[1]).toMatchObject({ total: 2, omitted: 2, correct: 0, accuracy: 0 });
});

it("clasificaciones desconocidas o pares incompatibles no inflan resultados ni rescatan revisiones viejas", () => {
  const r = buildExamCoaching([t("old"), t("a", [q("q2", "9"),
    { ...q(), subcompetency_code: "2.1" }], { finished_at: "2020-03-01" })], [a("old")]);
  expect(r.practiced).toBe(0);
});

it("sin errores y con exposición en todas continúa en la menos practicada", () => {
  const questions = [q(), q("q2"), q("q3", "2"), q("q4", "3")];
  const r = buildExamCoaching([t("a", questions)], questions.map(x => a("a", x.id)));
  expect(r.recommendation).toEqual({ competency: "2", topic: "", reason: "continue" });
});

it("solo expone agregados y no IDs, claves, respuestas ni fuentes", () => {
  const r = buildExamCoaching([t("attempt-private", [{ ...q("question-private"),
    correct_option: "SECRETO", prompt: "PROMPT-PRIVATE", explanation: "EXPLANATION-PRIVATE" }])],
    [a("attempt-private", "question-private", "SECRETO")]);
  expect(Object.keys(r).sort()).toEqual(["accuracy", "competencies", "correct", "practiced", "recommendation"]);
  expect(Object.keys(r.competencies[0]).sort()).toEqual(["accuracy", "code", "correct", "label", "omitted", "total"]);
  expect(Object.keys(r.recommendation).sort()).toEqual(["competency", "reason", "topic"]);
  expect(JSON.stringify(r)).not.toMatch(/SECRETO|private|PRIVATE|correct_option|question_id|attempt_id/);
});
