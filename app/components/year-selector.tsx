"use client";

import { Calendar } from "lucide-react";
import { useYear } from "@/lib/year-context";

export function YearSelector({ label = true }: { label?: boolean }) {
  const { year, setYear, availableYears } = useYear();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "var(--muted, #667)",
      }}
    >
      {label ? <Calendar size={15} /> : null}
      <select
        value={year}
        onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
        aria-label="Seleccionar año fiscal"
        style={{
          background: "transparent",
          border: "1px solid var(--line, #e2e4ea)",
          borderRadius: 6,
          padding: "2px 6px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--brand, #0f766e)",
          cursor: "pointer",
        }}
      >
        {availableYears.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </span>
  );
}
