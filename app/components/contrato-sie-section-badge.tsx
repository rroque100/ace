"use client";

import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { SectionStatus } from "./contrato-sie-validation";

// Badge visual de estado de una seccion del formulario.
// Muestra un check verde si esta completa, un circulo naranja si esta parcial,
// y una X roja si no se ha empezado.
export function SectionBadge({ status, compact = false }: { status: SectionStatus; compact?: boolean }) {
  const { done, total, isComplete } = status;
  const started = done > 0;
  const color = isComplete ? "#059669" : started ? "#ea580c" : "#9ca3af";
  const bg = isComplete ? "rgba(5,150,105,0.08)" : started ? "rgba(234,88,12,0.08)" : "transparent";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
      {status.fields.map((f) => (
        <div
          key={f.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: f.valid ? "#059669" : "#9ca3af",
          }}
        >
          {f.valid ? <CheckCircle2 size={12} /> : <Circle size={12} />}
          {f.label}
        </div>
      ))}
    </div>
  );
}