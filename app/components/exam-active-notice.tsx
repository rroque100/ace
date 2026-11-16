import { buttonClasses } from "@/app/components/ui/button";

export function ExamActiveNotice({
  count, preview, busy, onContinue, onCancel,
}: {
  count: number;
  preview: boolean;
  busy: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-labelledby="exam-active-title" className="mt-4 rounded-xl border border-warning/40 bg-warning-soft p-4 text-ink">
      <h3 id="exam-active-title" className="text-sm font-semibold">Tienes un intento pendiente</h3>
      <p id="exam-active-description" role="status" className="mt-2 text-sm leading-relaxed">
        Tienes un intento de {count} preguntas{preview ? " en borrador" : ""} todavía en curso.
        {" "}Para iniciar otra sesión, continúa y finaliza ese intento o cancélalo.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Si lo cancelas, se conservará en tu historial sin calificación.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={busy} className={buttonClasses({ variant: "primary" })} onClick={onContinue}>
          Continuar o finalizar
        </button>
        <button type="button" disabled={busy} className={buttonClasses({ variant: "secondary" })} onClick={onCancel}>
          Cancelar intento
        </button>
      </div>
    </section>
  );
}
