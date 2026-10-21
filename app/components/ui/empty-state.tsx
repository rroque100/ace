import { cn } from "@/lib/utils";

/** Estado vacío con icono, mensaje y acción opcional. Centrado y amable. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      ) : null}
      <div className="max-w-md">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
