"use client";

import { useEffect, useState } from "react";
import type { catalogoBalotarios } from "@/lib/balotarios-catalogo";
import { resumirBalotarios, type ResumenBanco } from "@/lib/simulador-navegacion";
import { boton } from "./balotarios/pregunta";

export function ResumenBalotarios({ catalogo, confirmado }: { catalogo: typeof catalogoBalotarios; confirmado: boolean }) {
  const resumen = resumirBalotarios(catalogo);
  return <div className="space-y-3">
    <p className="text-base text-muted">{catalogo.length} balotarios · {resumen.total} preguntas</p>
    {confirmado ? <>
      <p className="flex flex-wrap gap-2 text-sm font-medium">
        <span className="rounded-lg bg-success-soft px-3 py-2 text-success">{resumen.reviewed} revisadas</span>
        <span className="rounded-lg bg-warning-soft px-3 py-2 text-warning">{resumen.pending} pendientes de revisión</span>
      </p>
      <details className="rounded-xl border border-line bg-panel px-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink">Revisión por balotario</summary>
        <dl className="divide-y divide-line pb-2">{catalogo.map(b => {
          const r = resumirBalotarios([b]);
          return <div key={b.balotario} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm"><dt className="font-medium text-ink">Balotario {b.balotario} · {r.total} preguntas</dt><dd className="text-muted">{r.reviewed} revisadas · {r.pending} pendientes</dd></div>;
        })}</dl>
      </details>
      <p className="text-sm leading-relaxed text-muted">Las preguntas pendientes conservan la clave de origen. Su respuesta aún requiere revisión contra las fuentes.</p>
    </> : <p role="status" className="text-sm text-muted">Revisión sin confirmar. Las cantidades de revisadas y pendientes se mostrarán al consultar el catálogo.</p>}
  </div>;
}

export function ResumenDelBanco({ activo }: { activo: boolean }) {
  const [data, setData] = useState<ResumenBanco | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch("/api/exams/resumen", { cache: "no-store", signal: controller.signal });
        const x = await r.json();
        if (!r.ok) throw Error(x.error);
        if (!controller.signal.aborted) { setData(x); setError(""); }
      } catch {
        if (!controller.signal.aborted) { setData(null); setError("No se pudieron confirmar las cantidades del banco."); }
      }
    }
    void load();
    return () => controller.abort();
  }, [activo, version]);
  return <section className="space-y-3" aria-labelledby="banco-titulo">
    <h2 id="banco-titulo" className="text-2xl font-semibold text-ink">Banco de preguntas</h2>
    <p className="max-w-3xl text-base leading-relaxed text-muted">Entrena por temas, refuerza tus errores y comprueba tus conocimientos con un simulacro.</p>
    {error ? <div role="alert" className="rounded-xl bg-warning-soft p-4 text-warning"><p>{error}</p><button type="button" className={`${boton} mt-3`} onClick={() => { setError(""); setVersion(v => v + 1); }}>Reintentar consulta</button></div> : data ? <>
      <dl aria-label="Disponibilidad del banco" className="flex flex-wrap gap-2">{[["Revisadas disponibles", data.reviewed, "text-success"], ["Pendientes de revisión", data.pending, "text-warning"], ["Retiradas", data.retired, "text-muted"]].map(([label, value, color]) => <div key={label} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm"><dt className="order-2 text-muted">{label}</dt><dd className={`order-1 font-semibold tabular-nums ${color}`}>{value}</dd></div>)}</dl>
      <details className="text-sm text-muted"><summary className="min-h-11 cursor-pointer py-2.5">Qué incluyen estas cantidades</summary><p className="pb-2 leading-relaxed">{data.total} preguntas entre todas las leyes y competencias. Estas cifras describen la disponibilidad del banco; tu avance se calcula con tus intentos entregados. Las pendientes requieren revisión editorial o actualización de sus fuentes y las retiradas no se usan para practicar.</p></details>
    </> : <p role="status" className="text-sm text-muted">Consultando revisión y disponibilidad del banco…</p>}
  </section>;
}
