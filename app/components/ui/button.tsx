"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón base de la nueva UI (Radix-friendly + Tailwind).
 *
 * Un único componente cubre las cuatro intenciones que la app venía resolviendo
 * con clases sueltas (`primaryButton`, `secondaryButton`, `iconButton`…). El
 * `variant` dice el peso visual; el `tone` tiñe las acciones destructivas.
 *
 * Debe renderizarse dentro de un contenedor `.tw` (donde vive el reset acotado).
 */

type Variant = "primary" | "secondary" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold " +
  "transition-[background,border-color,color,box-shadow,transform] duration-150 " +
  "outline-none focus-visible:shadow-[var(--shadow-focus)] " +
  "disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-px select-none";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-card hover:bg-brand-dark",
  secondary:
    "border border-line bg-panel text-ink shadow-card hover:bg-brand-soft hover:border-brand/40 hover:text-brand",
  ghost:
    "text-muted hover:bg-brand-soft hover:text-brand",
  subtle:
    "bg-brand-soft text-brand hover:bg-brand/15",
};

const danger: Record<Variant, string> = {
  primary: "bg-danger text-white shadow-card hover:bg-danger/90",
  secondary:
    "border border-danger/30 bg-panel text-danger shadow-card hover:bg-danger-soft",
  ghost: "text-danger hover:bg-danger-soft",
  subtle: "bg-danger-soft text-danger hover:bg-danger/15",
};

/**
 * Clases del botón sin el `<button>`.
 *
 * Para lo que NAVEGA en vez de actuar: un `<Link>` que debe parecer un botón
 * sigue siendo un enlace —abrir en pestaña nueva, copiar dirección, lector de
 * pantalla que lo anuncia como enlace—. Envolverlo en un botón para que se vea
 * igual rompería las tres cosas.
 */
export function buttonClasses(opciones: { variant?: Variant; size?: Size; destructive?: boolean } = {}) {
  const { variant = "secondary", size = "md", destructive } = opciones;
  return cn(base, sizes[size], destructive ? danger[variant] : variants[variant]);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Acción destructiva: cambia la paleta a roja conservando el `variant`. */
  destructive?: boolean;
  /** Ocupa todo el ancho disponible (útil en móvil y en pies de diálogo). */
  block?: boolean;
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", destructive, block, loading, disabled, className, children, ...props },
  ref,
) {
  const palette = destructive ? danger[variant] : variants[variant];
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, sizes[size], palette, block && "w-full", className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

/** Botón cuadrado solo-icono (cerrar, acciones de fila). */
export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
  destructive?: boolean;
  "aria-label": string;
};

const iconSizes: Record<Size, string> = {
  sm: "size-7",
  md: "size-9",
  lg: "size-10",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", destructive, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-[10px] text-muted transition-colors duration-150",
        "outline-none focus-visible:shadow-[var(--shadow-focus)]",
        "hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-55",
        destructive && "hover:bg-danger-soft hover:text-danger",
        iconSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
