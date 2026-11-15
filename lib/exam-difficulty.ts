export const EXAM_DIFFICULTIES = [
  { value: "", label: "Todas las dificultades" },
  { value: "basic", label: "Básica" },
  { value: "intermediate", label: "Intermedia" },
  { value: "advanced", label: "Avanzada" },
] as const;

export type ExamDifficulty = (typeof EXAM_DIFFICULTIES)[number]["value"];
export type ExamAvailability = {
  regime: string;
  topic: string;
  competency?: string;
  difficulty: Exclude<ExamDifficulty, "">;
  published: number;
  drafts: number;
};
export type ExamSelection = {
  regime: string;
  competency: string;
  topic: string;
  difficulty: ExamDifficulty;
  preview: boolean;
};

export function availableExamQuestions(
  groups: ExamAvailability[],
  selection: ExamSelection,
) {
  return groups.reduce((total, group) => {
    if (
      group.regime !== selection.regime ||
      (selection.competency && group.competency !== selection.competency) ||
      (selection.topic && group.topic !== selection.topic) ||
      (selection.difficulty && group.difficulty !== selection.difficulty)
    ) return total;
    return total + Number(group.published) + (selection.preview ? Number(group.drafts) : 0);
  }, 0);
}

export function examDifficultyLabel(value: string) {
  return EXAM_DIFFICULTIES.find((item) => item.value === value)?.label ?? "Todas las dificultades";
}
