import { cn } from "@/lib/utils";

/**
 * Tarjeta / panel de superficie. `interactive` añade la respuesta al hover para
 * las tarjetas que son enlaces (la lista de necesidades). `accent` pinta una
 * franja de color a la izquierda para señalar el tono de estado sin recuadrar.
 */

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  accent?: string;
};

export function Card({ interactive, accent, className, style, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-[14px] border border-line bg-panel shadow-card",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-pop",
        accent && "overflow-hidden",
        className,
      )}
      style={style}
      {...props}
    >
      {accent ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: accent }}
        />
      ) : null}
      {children}
    </div>
  );
}

/** Encabezado de sección dentro de un panel (título + descripción + acciones). */
export function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
