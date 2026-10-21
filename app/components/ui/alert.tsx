import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Aviso en bloque: error, información, éxito o advertencia. */

type AlertTone = "info" | "danger" | "success" | "warning";

const map: Record<AlertTone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-brand/20 bg-brand-soft text-brand", Icon: Info },
  danger: { cls: "border-danger/25 bg-danger-soft text-danger", Icon: XCircle },
  success: { cls: "border-success/20 bg-success-soft text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/25 bg-warning-soft text-warning", Icon: AlertTriangle },
};

export function Alert({
  tone = "info",
  icon = true,
  className,
  children,
}: {
  tone?: AlertTone;
  icon?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { cls, Icon } = map[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-relaxed",
        cls,
        className,
      )}
    >
      {icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
      <div className="min-w-0 [&_strong]:font-semibold">{children}</div>
    </div>
  );
}
