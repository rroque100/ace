import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado de completitud de una sección de la ficha (los obligatorios mandan). */
export type EstadoSeccion = "completo" | "pendiente" | "parcial" | "vacio";

/**
 * Badge de avance de una sección del requerimiento, ÚNICO para los dos modos de la
 * ficha (edición y lectura).
 *
 * Antes cada modo pintaba su propia píldora —edición con icono de check y un estado
 * "pendiente" en ámbar; lectura sin check y solo verde/gris—, así que la MISMA
 * sección se veía distinta según se estuviera editando o leyendo. Aquí hay un solo
 * lenguaje, el mismo que la cabecera de pasos de la Fase 1: verde + check cuando está
 * "completo", ámbar cuando quedan obligatorios ("pendiente"), gris el resto.
 */
export function SeccionBadge({
  estado,
  texto,
  className,
}: {
  estado: EstadoSeccion;
  texto: string;
  className?: string;
}) {
  if (!texto) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold",
        estado === "completo" && "bg-success-soft text-success",
        estado === "pendiente" && "bg-warning-soft text-warning",
        (estado === "parcial" || estado === "vacio") && "bg-ink/[0.06] text-muted",
        className,
      )}
    >
      {estado === "completo" ? <Check size={11} aria-hidden /> : null}
      {texto}
    </span>
  );
}

/**
 * Barra de avance de los campos OBLIGATORIOS del requerimiento, única para la
 * cabecera de la necesidad y el toolbar de edición.
 *
 * Antes cada sitio pintaba su propia barra con distinto texto ("X/Y · faltan N" vs
 * "X/Y obligatorios") y solo una cambiaba a verde al completarse. Aquí el lenguaje
 * es uno: barra de marca que pasa a verde y a "completo" cuando no falta ninguno,
 * el mismo criterio que la cabecera de pasos de la Fase 1.
 */
export function BarraObligatorios({
  done,
  total,
  textoCompleto = "Completo",
  className,
  barClassName,
}: {
  done: number;
  total: number;
  /** Texto al llegar al 100% (la cabecera usa "Requerimiento completo"). */
  textoCompleto?: string;
  className?: string;
  /** Sobrescribe el ancho de la barra (el toolbar la quiere fija y estrecha). */
  barClassName?: string;
}) {
  if (total <= 0) return null;
  const completo = done >= total;
  const pct = Math.round((done / total) * 100);
  return (
    <div
      className={cn("flex items-center gap-2.5", className)}
      title={`${done} de ${total} campos obligatorios`}
    >
      <div className={cn("h-2 flex-1 overflow-hidden rounded-full bg-line", barClassName)}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", completo ? "bg-success" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("shrink-0 text-[12px] font-semibold", completo ? "text-success" : "text-muted")}>
        {completo ? textoCompleto : `${done}/${total} · faltan ${total - done}`}
      </span>
    </div>
  );
}
