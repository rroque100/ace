// Barra de avance del curso y los avisos de estado del guardado. Sin "use client": la pinta el servidor.
import type { EstadoProgreso } from "@/lib/cursos/progreso-server";

export function BarraAvance({ hechas, total, porcentaje }: { hechas: number; total: number; porcentaje: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">
          {hechas} de {total} clases
        </span>
        <span className="tabular-nums text-muted">{porcentaje} %</span>
      </div>
      <div
        role="progressbar"
        aria-label="Avance del curso"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        className="h-2 overflow-hidden rounded-full bg-brand-soft"
      >
        {/* Ancho dinámico: es el dato, no un estilo fijo. */}
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

export function AvisoProgreso({ estado }: { estado: EstadoProgreso["estado"] }) {
  if (estado === "ok") return null;
  return (
    <p role="status" className="m-0 rounded-xl bg-info-soft px-4 py-3 text-sm leading-relaxed text-info">
      {estado === "sin-migrar"
        ? "Tu avance aún no se guarda: falta que Administración active esta función. Puedes estudiar todas las clases igual."
        : "No se pudo leer tu avance en este momento. Puedes seguir estudiando; recarga la página más tarde para verlo."}
    </p>
  );
}
