// Utilidades Tailwind con los tokens semánticos de ACE.
export const S = {
  examPreparation: "space-y-4 rounded-2xl border border-line bg-panel p-4 text-ink shadow-card sm:p-5",
  examCoverage: "grid gap-3 sm:grid-cols-3",
  examCoverageCard: "rounded-xl border border-line bg-surface p-3 sm:p-4",
  examCompetencyLabel: "mb-1 text-xs font-semibold uppercase tracking-wider text-brand",
  examPreparationActions: "flex flex-wrap items-center gap-2 border-t border-line pt-4 [&>button]:w-full sm:[&>button]:w-auto",
  examStatus: "inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted",
} as const;
