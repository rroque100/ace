import { cn } from "@/lib/utils";
import type { TonoEstado } from "@/lib/necesidad-workflow";

/**
 * Insignia / chip de estado. Los `tone` reflejan los tonos del flujo de la
 * necesidad (neutral, progreso, atención, éxito, terminal) más un `objeto`
 * para las etiquetas de tipo de objeto. Colores derivados de los tokens de marca.
 */

export type BadgeTone = TonoEstado | "objeto" | "marca" | "peligro";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-muted ring-1 ring-inset ring-ink/[0.08]",
  progreso: "bg-brand-soft text-brand ring-1 ring-inset ring-brand/20",
  atencion: "bg-warning-soft text-warning ring-1 ring-inset ring-warning/25",
  exito: "bg-success-soft text-success ring-1 ring-inset ring-success/20",
  terminal: "bg-ink/[0.05] text-muted line-through decoration-muted/50 ring-1 ring-inset ring-ink/[0.08]",
  objeto: "bg-accent/10 text-accent ring-1 ring-inset ring-accent/20",
  marca: "bg-brand text-white",
  // Faltaba: sin un tono rojo no se puede expresar un riesgo alto ni un
  // incumplimiento, y esos casos acababan con su propia clase suelta.
  peligro: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/25",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Punto de color a la izquierda (indicador de estado tipo semáforo). */
  dot?: boolean;
};

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Contador compacto (número junto a una etiqueta, p. ej. en los chips del tablero). */
export function Count({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-ink/[0.06] px-1.5 text-[11px] font-bold tabular-nums text-ink/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
