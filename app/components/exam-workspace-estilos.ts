// Estilos de exam-workspace.tsx en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir de las
// reglas CSS que tenía el componente; una cadena por clase, con el mismo nombre que tenía.
export const S = {
  examAnswer: "min-h-16 [&_input]:mt-1 has-[input:disabled]:cursor-default",
  examAttemptLayout: "grid items-start gap-5 min-[1100px]:grid-cols-[minmax(0,_1fr)_260px]",
  examCustomLayout: "[scroll-margin-top:24px] grid items-start gap-5 min-[1100px]:grid-cols-[minmax(0,_1fr)_280px]",
  examCustomPanel: "rounded-2xl border border-line bg-panel shadow-card p-5 sm:p-7",
  examJourney: "rounded-2xl border border-line bg-panel shadow-card p-5 min-[1100px]:sticky min-[1100px]:top-5",
  examMode: "block min-h-28 has-[input:checked]:shadow-[inset_0_0_0_1px_var(--brand)] has-[input:checked]:border-brand has-[input:checked]:bg-brand-soft has-[input:disabled]:cursor-default",
  examQuestionGrid: "grid-cols-5 grid gap-2 [&_button]:min-h-11 [&_button]:min-w-0 [&_button]:rounded-lg [&_button]:text-sm [&_button[aria-current=step]]:border-brand [&_button[aria-current=step]]:bg-brand-soft [&_button[aria-current=step]]:text-brand",
  examQuestionPanel: "rounded-2xl border border-line bg-panel shadow-card p-5 sm:p-7 [&_h2]:text-lg [&_h2]:leading-8 [&_h2]:sm:text-xl",
  examResume: "border-l-[4px] border-l-brand flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/25 bg-brand-soft p-5 max-[639px]:[&>button]:w-full",
  examStudyGuide: "rounded-xl border border-line bg-surface p-6 text-ink [&_p]:text-sm [&_p]:leading-6 [&_p]:text-muted [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:leading-7 [&_h2]:text-ink [&_ol]:list-none [&_ol]:my-5 [&_ol]:space-y-4 [&_ol]:pl-0 [&_ol]:text-sm [&_ol]:leading-6 [&_ol]:text-muted [&>p:first-child]:text-xs [&>p:first-child]:font-semibold [&>p:first-child]:uppercase [&>p:first-child]:tracking-wider [&>p:first-child]:text-brand [&>p:last-child]:border-line",
  examWelcome: "flex flex-wrap items-center justify-between gap-5 border-b border-line pb-6",
  examWelcomeActions: "flex flex-wrap gap-2 max-[639px]:w-full max-[639px]:[&>*]:flex-1",
} as const;
