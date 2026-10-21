"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campos de formulario de la nueva UI. La etiqueta lleva un badge
 * obligatorio/opcional (consistente con la ficha) para que un usuario no técnico
 * sepa de un vistazo qué debe rellenar. Input, Textarea y Select comparten el
 * mismo tratamiento visual (borde, foco teal, alto cómodo).
 */

const controlBase =
  "w-full rounded-[10px] border border-line bg-panel px-3 text-sm text-ink shadow-[inset_0_1px_1px_rgba(15,23,42,0.02)] " +
  "transition-[border-color,box-shadow] duration-150 outline-none " +
  "placeholder:text-muted/60 " +
  "focus:border-brand focus:shadow-[var(--shadow-focus)] " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-[76px] resize-y py-2.5 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(controlBase, "h-10 cursor-pointer appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    );
  },
);

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <span className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
      {children}
      {required === undefined ? null : (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide",
            required ? "bg-brand-soft text-brand" : "bg-ink/[0.06] text-muted",
          )}
        >
          {required ? "obligatorio" : "opcional"}
        </span>
      )}
      {hint ? <span className="ml-auto text-[11px] font-normal text-muted">{hint}</span> : null}
    </span>
  );
}

/** Envoltorio label + control + ayuda/error. Usa `<label>` para asociar foco. */
export function Field({
  label,
  required,
  hint,
  help,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const Wrap = htmlFor ? "div" : "label";
  return (
    <Wrap className={cn("block", className)} {...(htmlFor ? {} : {})}>
      {label ? (
        <FieldLabel required={required} hint={hint}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] font-medium text-danger">{error}</span>
      ) : help ? (
        <span className="mt-1.5 block text-[12px] leading-relaxed text-muted">{help}</span>
      ) : null}
    </Wrap>
  );
}
