"use client";

import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { SectionStatus } from "./contrato-sie-validation";
import { cn } from "@/lib/utils";

// Badge visual de estado de una seccion del formulario.
// Muestra un check verde si esta completa, un circulo naranja si esta parcial,
// y una X roja si no se ha empezado. Colores por token (success/warning/muted)
// para que sigan el tema claro/oscuro; antes eran hex fijos.
export function SectionBadge({ status, compact = false }: { status: SectionStatus; compact?: boolean }) {
  const { done, total, isComplete } = status;
  const started = done > 0;
  const tono = isComplete ? "bg-success-soft text-success" : started ? "bg-warning-soft text-warning" : "text-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold",
        compact ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
        tono,
      )}
    >
      {isComplete ? (
        <CheckCircle2 size={compact ? 11 : 13} />
      ) : started ? (
        <AlertCircle size={compact ? 11 : 13} />
      ) : (
        <Circle size={compact ? 11 : 13} />
      )}
      {compact ? `${done}/${total}` : `${done}/${total} campos`}
    </span>
  );
}

// Lista de campos de una seccion con su estado individual (para tooltip o panel expandible).
export function SectionFieldList({ status }: { status: SectionStatus }) {
  return (
    <div className="mt-1.5 flex flex-col gap-[3px]">
      {status.fields.map((f) => (
        <div
          key={f.key}
          className={cn("flex items-center gap-1.5 text-[11.5px]", f.valid ? "text-success" : "text-muted")}
        >
          {f.valid ? <CheckCircle2 size={12} /> : <Circle size={12} />}
          {f.label}
        </div>
      ))}
    </div>
  );
}