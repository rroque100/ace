import { describe, it, expect } from "vitest";
import {
  EXAM_CURRICULUM,
  curriculumCoverage,
  isCurriculumPair,
} from "../lib/exam-curriculum";
describe("temario OECE", () => {
  it("conserva treinta cuotas y 25/22/25", () => {
    expect(new Set(EXAM_CURRICULUM.map((s) => s.code)).size).toBe(30);
    expect(
      ["1", "2", "3"].map((c) =>
        EXAM_CURRICULUM.filter((s) => s.competency === c).reduce(
          (n, s) => n + s.quota,
          0,
        ),
      ),
    ).toEqual([25, 22, 25]);
    expect(EXAM_CURRICULUM.reduce((n, s) => n + s.target, 0)).toBe(360);
  });
  it("no confunde total con cobertura", () => {
    const x = curriculumCoverage([
      { subcompetency_code: "1.1", published: 72, drafts: 2 },
    ]);
    expect(x.find((s) => s.code === "1.1")?.missing).toBe(0);
    expect(x.find((s) => s.code === "1.2")?.missing).toBe(13);
    expect(x.filter((s) => s.missing).length).toBe(29);
  });
  it("rechaza pares incompatibles", () => {
    expect(isCurriculumPair("2", "1.1")).toBe(false);
    expect(isCurriculumPair("2", "2.10")).toBe(true);
    expect(isCurriculumPair("1", "9.9")).toBe(false);
  });
});

import { examStartSchema } from "../lib/exam-policy";
it("impide personalizar silenciosamente el perfil fijo", () => {
  const p = {
    profile: "oece",
    mode: "exam",
    count: 72,
    minutes: 120,
    regime: "32069",
  };
  expect(examStartSchema.safeParse(p).success).toBe(true);
  for (const change of [
    { count: 71 },
    { minutes: 30 },
    { regime: "30225" },
    { preview: true },
    { topic: "garantías" },
    { mode: "practice" },
  ])
    expect(examStartSchema.safeParse({ ...p, ...change }).success).toBe(false);
  expect(
    examStartSchema.safeParse({ ...p, profile: "balotario" }).success,
  ).toBe(false);
});
