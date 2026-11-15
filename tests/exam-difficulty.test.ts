import { expect, it } from "vitest";
import { availableExamQuestions, type ExamAvailability } from "@/lib/exam-difficulty";
import { examStartSchema } from "@/lib/exam-policy";

const groups: ExamAvailability[] = [
  { regime: "32069", topic: "Planificación", competency: "1", difficulty: "basic", published: 4, drafts: 2 },
  { regime: "32069", topic: "Planificación", competency: "1", difficulty: "advanced", published: 3, drafts: 1 },
  { regime: "32069", topic: "Ejecución", competency: "3", difficulty: "basic", published: 5, drafts: 0 },
  { regime: "30225", topic: "Planificación", competency: "1", difficulty: "basic", published: 10, drafts: 0 },
];
it("cuenta la intersección de nivel, tema, competencia y régimen sin borradores", () => {
  const selection = { regime: "32069", topic: "Planificación", competency: "1", difficulty: "basic" as const, preview: false };
  expect(availableExamQuestions(groups, selection)).toBe(4);
  expect(availableExamQuestions(groups, { ...selection, preview: true })).toBe(6);
  expect(availableExamQuestions(groups, { ...selection, difficulty: "" })).toBe(7);
  expect(availableExamQuestions(groups, { ...selection, competency: "3" })).toBe(0);
  expect(availableExamQuestions(groups, { ...selection, topic: "", competency: "" })).toBe(9);
});
it("mantiene compatibilidad y acepta únicamente niveles conocidos en el perfil personalizado", () => {
  const base = { mode: "exam", count: 72, minutes: 120, regime: "32069" };
  expect(examStartSchema.parse(base).difficulty).toBe("");
  for (const difficulty of ["basic", "intermediate", "advanced"]) {
    expect(examStartSchema.safeParse({ ...base, difficulty }).success).toBe(true);
    for (const profile of ["oece", "balotario", "review"])
      expect(examStartSchema.safeParse({ ...base, profile, difficulty }).success).toBe(false);
  }
  expect(examStartSchema.safeParse({ ...base, difficulty: "expert" }).success).toBe(false);
});
