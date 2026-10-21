"use client";

import { useMemo } from "react";
import { BarChart3, CheckCircle2, ClipboardCheck, FileCheck, Loader } from "lucide-react";
import { FASES, hitosDeFase, progresoDeFase } from "@/lib/procurement-fases";
import { useExpediente } from "./expediente-contexto";

const FASE_META: Record<string, { label: string; icon: typeof ClipboardCheck; color: string }> = {
  F1: { label: "Actuaciones Preparatorias", icon: ClipboardCheck, color: "#0f766e" },
  F2: { label: "Selección", icon: FileCheck, color: "#4f46e5" },
  F3: { label: "Ejecución Contractual", icon: CheckCircle2, color: "#d97706" },
};

export function GlobalProgress() {
  // Los hitos vienen del contexto del expediente: pedirlos aquí por su cuenta
  // era una de las cuatro peticiones duplicadas del mismo jsonb de 9 KB.
  const { cargando: loading, hitos } = useExpediente();

  const fases = useMemo(() => FASES.map((f) => {
    const p = progresoDeFase(f.id, hitos);
    const meta = FASE_META[f.id];
    return { ...p, meta };
  }), [hitos]);

  const total = useMemo(() => {
    const all = FASES.flatMap((f) => hitosDeFase(f.id));
    const done = all.filter((h) => {
      const e = hitos[h.code];
      return e?.status === "hecho" || e?.status === "na";
    }).length;
    return {
      total: all.length,
      completados: done,
      porcentaje: all.length === 0 ? 0 : Math.round((done / all.length) * 100),
    };
  }, [hitos]);

  if (loading) {
    return (
      <section className="processPanel">
        <div className="processPanelHead">
          <BarChart3 size={17} />
          <h3 className="panelTitulo">Avance global del expediente</h3>
        </div>
        <p className="sideMuted"><Loader size={14} /> Cargando avance…</p>
      </section>
    );
  }

  return (
    <section className="processPanel mb-3">
      <div className="processPanelHead">
        <BarChart3 size={17} />
        <h3 className="panelTitulo">Avance global del expediente</h3>
        <span className="faseUnoBadge">{total.porcentaje}% completo</span>
      </div>

      <div className="mt-2">
        <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
          <div
            className="h-full rounded-full transition-[width] duration-[400ms]"
            style={{ width: `${total.porcentaje}%`, background: "linear-gradient(90deg, #0f766e, #4f46e5, #d97706)" }}
          />
        </div>
        <span className="mt-1 block text-right text-[11px] text-muted">
          {total.completados} de {total.total} pasos completados en total
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-3">
        {fases.map((f) => {
          const Icon = f.meta.icon;
          return (
            <div className="min-w-[160px] flex-1 rounded-[8px] border border-line bg-surface px-2.5 py-2" key={f.faseId}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px]">
                <Icon size={15} style={{ color: f.meta.color }} />
                <strong className="flex-1 text-[12px]">{f.meta.label}</strong>
                <span className="text-[13px] font-bold">{f.porcentaje}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-brand-soft">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${f.porcentaje}%`, background: f.meta.color }}
                />
              </div>
              <span className="mt-0.5 block text-[10px] text-muted">
                {f.completados}/{f.total} pasos
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
