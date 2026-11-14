"use client";
import { useEffect, useRef, useState } from "react";
import { Flag, BookOpen } from "lucide-react";
import type { PreguntaBalotario } from "@/lib/balotarios-policy";
export const boton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-panel px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed";
export const primario = `${boton} border-brand bg-brand text-on-brand hover:bg-brand-dark`;
export const campo = "mt-1 min-h-11 min-w-0 w-full rounded-xl border border-line-strong bg-panel px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-brand";

export function Pregunta({ q, position, total, answer, reveal, locked, onAnswer }: {
  q: PreguntaBalotario; position: number; total: number; answer?: string; reveal: boolean; locked?: boolean; onAnswer: (option: string) => void;
}) {
  const legend = useRef<HTMLLegendElement>(null);
  const previous = useRef(q.id);
  useEffect(() => {
    if (previous.current !== q.id) {
      previous.current = q.id;
      legend.current?.focus();
    }
  }, [q.id]);
  return <article className="min-w-0 rounded-2xl border border-line bg-panel p-4 sm:p-6" aria-labelledby={`titulo-${q.id}`}>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
      <span className="font-semibold text-brand">Pregunta {position} de {total}</span>
      <span>{q.competencia || "Competencia por clasificar"}</span>
      <span className="ml-auto rounded-lg bg-surface px-2 py-1">{q.revisada ? "Revisada con fuente" : "Clave de origen · revisión pendiente"}</span>
    </div>
    {q.incidencia && <p role="note" className="mb-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">{q.incidencia}</p>}
    <fieldset className="min-w-0 border-0 p-0">
      <legend ref={legend} tabIndex={-1} id={`titulo-${q.id}`} className="mb-5 w-full scroll-mt-28 text-base font-semibold leading-relaxed text-ink outline-none sm:text-lg lg:scroll-mt-8">{q.pregunta}</legend>
      <div className="space-y-3">{q.opciones.map(o => {
        const selected = answer === o.letra;
        const correct = reveal && q.correcta === o.letra;
        const wrong = reveal && selected && !correct;
        return <label key={o.letra} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 leading-relaxed focus-within:outline-2 focus-within:outline-brand ${correct ? "border-success bg-success-soft" : wrong ? "border-danger bg-danger-soft" : selected ? "border-brand bg-brand-soft" : "border-line-strong hover:border-brand"}`}>
          <input className="mt-1 size-5 shrink-0 accent-brand" type="radio" name={q.id} checked={selected} disabled={locked} onChange={() => onAnswer(o.letra)} />
          <span className="font-semibold text-muted">{o.letra}.</span><span className="min-w-0 break-words text-base text-ink">{o.texto}{correct && <strong className="ml-2 text-success">✓ Correcta</strong>}{wrong && <strong className="ml-2 text-danger">Tu respuesta · incorrecta</strong>}</span>
        </label>;
      })}</div>
    </fieldset>
    {reveal && <div className="mt-5 space-y-3 border-t border-line pt-4">
      <p className="font-semibold text-ink">{answer ? answer === q.correcta ? "Respuesta acertada." : `La clave es ${q.correcta}.` : `Sin responder. La clave es ${q.correcta}.`}</p>
      <p className="text-base leading-relaxed text-muted">{q.explicacion || "La colección importada no incluye una explicación verificada. Puedes consultar el corpus y reportar cualquier discrepancia para revisión."}</p>
      {q.fuentes?.map(s => <blockquote key={s.chunkId} className="rounded-xl border-l-4 border-brand bg-brand-soft p-4 text-sm leading-relaxed text-ink"><p>{s.quote}</p><footer className="mt-2"><a className="font-semibold underline" href={`/normas?documentId=${encodeURIComponent(s.documentId)}&article=${encodeURIComponent(s.article)}`}>{s.title} · artículo {s.article} · pp. {s.pageStart}–{s.pageEnd} · {s.version}</a></footer></blockquote>)}
      <a className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline" href="/normas?regime=32069"><BookOpen size={16} aria-hidden /> Consultar normativa</a>
    </div>}
    <Reportar key={q.id} id={q.id} />
  </article>;
}
function Reportar({ id }: { id: string }) {
  const [reason, setReason] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  return <details className="mt-5 border-t border-line pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted"><Flag className="mr-2 inline" size={15} aria-hidden />Reportar un problema</summary>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); try {
      const r = await fetch("/api/balotarios/contenido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report", questionId: id, reason }) });
      const x = await r.json(); if (!r.ok) throw Error(x.error); setMessage("Reporte registrado. La respuesta queda pendiente de revisión editorial."); setReason("");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>
      <label className="block text-sm text-ink">Describe el problema<textarea required minLength={10} maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className={campo} /></label>
      <button className={`${boton} mt-3`} disabled={busy || reason.trim().length < 10}>Enviar reporte</button><p role="status" className="mt-2 text-sm text-muted">{message}</p>
    </form>
  </details>;
}
