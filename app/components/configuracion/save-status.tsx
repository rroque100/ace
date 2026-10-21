"use client";

import { AlertCircle, Check, Loader2, Pencil } from "lucide-react";

export type SaveStatusType = "idle" | "saving" | "saved" | "dirty" | "error";

interface SaveStatusProps {
  status: SaveStatusType;
  message?: string;
}

const STATUS_CONFIG: Record<
  SaveStatusType,
  { icon: typeof Check; text: string; className: string }
> = {
  idle: { icon: Check, text: "", className: "opacity-0" },
  saving: {
    icon: Loader2,
    text: "Guardando…",
    className: "text-muted",
  },
  saved: {
    icon: Check,
    text: "Todo guardado",
    className: "text-brand-dark",
  },
  dirty: {
    icon: Pencil,
    text: "Cambios sin guardar",
    className: "text-accent",
  },
  error: {
    icon: AlertCircle,
    text: "No se pudo guardar. Reintenta.",
    className: "text-danger",
  },
};

export function SaveStatus({ status, message }: SaveStatusProps) {
  if (status === "idle") return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs font-medium transition-opacity ${config.className}`}
    >
      <Icon
        className={`size-3.5 ${status === "saving" ? "animate-spin" : ""}`}
      />
      <span>{message ?? config.text}</span>
    </span>
  );
}
