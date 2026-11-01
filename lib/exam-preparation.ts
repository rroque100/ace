export type ExamPreparation = {
  version: string;
  coverage: Array<{
    code: string;
    competency: string;
    label: string;
    quota: number;
    target: number;
    published: number;
    drafts: number;
  }>;
  progress: Array<{
    code: string | null;
    total: number;
    correct: number;
    omitted: number;
  }>;
  balotarios: Array<{
    id: string;
    edition: string;
    slot: number;
    created_at?: string;
    eligible: number;
  }>;
  reports: Array<{
    id: string;
    question_id: string;
    question_revision: number;
    reason: string;
    comment: string;
    state: string;
    resolution?: string;
    created_at: string;
  }>;
  metrics: Array<{
    question_id: string;
    revision: number;
    n: number;
    accuracy: number;
    omitted: number;
    active_seconds: number | null;
    timed_responses?: number;
    alternatives?: Record<string, number>;
    discrimination: number | null;
  }>;
  authoring: Array<{
    id: string;
    subcompetency_code: string;
    state: string;
    target: number;
    created_count: number;
    detail: string | null;
    provider: string;
    model: string;
  }>;
};
export const REPORT_REASONS = {
  ambiguous: "Pregunta ambigua",
  key: "Clave discutible",
  outdated: "Fuente desactualizada",
  explanation: "Explicación insuficiente",
} as const;
export function metricLabel(n: number) {
  return n < 30 ? "Muestra insuficiente" : "Resultado exploratorio";
}
