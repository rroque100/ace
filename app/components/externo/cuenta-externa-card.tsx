import { CalendarClock, Sparkles } from "lucide-react";
import { MODULOS_EXTERNOS, type ModuloExterno } from "@/lib/modulos-acceso";
import { fechaFin, textoDias, type EstadoCuentaExterna } from "@/lib/cuenta-externa-estado";

// Lo que la barra lateral enseña a una cuenta externa en lugar de «Consulta · Sin oficina asignada · Ve solo lo que sube o
// crea»: esos son conceptos del personal de la entidad y a una persona externa no le dicen nada. Aquí va lo suyo: a qué
// módulos entra, cuánta IA le queda este mes y hasta cuándo tiene acceso. Presentacional puro (sin estado): lo decide
// `estadoCuentaExterna` y se calcula en el servidor.
//
// Va sobre el fondo OSCURO de la barra lateral, de ahí los tonos claros. Tailwind acotado a `.tw`.

const COLOR_BARRA = {
  sin_tope: "bg-emerald-300",
  normal: "bg-emerald-300",
  alto: "bg-amber-300",
  agotado: "bg-red-400",
} as const;

const numero = (n: number) => n.toLocaleString("es-PE");

export function CuentaExternaCard({ modulos, estado }: { modulos: readonly ModuloExterno[]; estado: EstadoCuentaExterna }) {
  const { nivelIA, porcentajeIA, cuota, usados, nivelVigencia, vigenteHasta, diasRestantes } = estado;
  return (
    // En la barra colapsada solo queda el avatar: el resto se oculta con el atributo que ya pone el <aside>.
    <div className="tw mt-2 flex flex-col gap-3 text-[12px] leading-snug text-white/80 in-data-[collapsed=true]:hidden" aria-label="Tu cuenta">
      <div>
        <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">Tu acceso</p>
        {modulos.length ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {modulos.map((modulo) => (
              <li key={modulo} className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white">{MODULOS_EXTERNOS[modulo].label}</li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-white/70">Sin módulos habilitados</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55"><Sparkles size={12} aria-hidden /> IA este mes</p>
          <span className={`text-[11px] font-semibold ${nivelIA === "agotado" ? "text-red-300" : nivelIA === "alto" ? "text-amber-300" : "text-white/80"}`}>
            {nivelIA === "sin_tope" ? "Sin tope" : nivelIA === "agotado" ? "Agotada" : `${porcentajeIA} % usado`}
          </span>
        </div>
        {cuota !== null ? (
          <div
            role="progressbar"
            aria-label="Uso de IA del mes"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentajeIA ?? 0}
            aria-valuetext={`${porcentajeIA} % de la cuota mensual usado`}
            className="h-1.5 overflow-hidden rounded-full bg-white/15"
          >
            <div className={`h-full rounded-full transition-[width] duration-500 ${COLOR_BARRA[nivelIA]}`} style={{ width: `${porcentajeIA ?? 0}%` }} />
          </div>
        ) : null}
        <p className="m-0 mt-1.5 text-[11px] text-white/60">
          {nivelIA === "agotado"
            ? cuota === 0
              ? "Tu cuenta no incluye IA. Puedes consultar las normas."
              : "Ya no puedes hacer preguntas hasta el mes que viene. Sigues pudiendo leer las normas."
            : cuota === null
              ? `${numero(usados)} tokens usados este mes`
              : `${numero(usados)} de ${numero(cuota)} tokens`}
        </p>
      </div>

      <p className={`m-0 flex items-start gap-1.5 text-[11px] ${nivelVigencia === "por_vencer" ? "font-semibold text-amber-300" : "text-white/60"}`}>
        <CalendarClock size={13} className="mt-px shrink-0" aria-hidden />
        <span>
          {vigenteHasta === null
            ? "Acceso sin fecha de fin"
            : nivelVigencia === "por_vencer"
              ? `Tu acceso termina ${textoDias(diasRestantes ?? 0)} (${fechaFin(vigenteHasta)})`
              : `Acceso hasta el ${fechaFin(vigenteHasta)}`}
        </span>
      </p>
    </div>
  );
}
