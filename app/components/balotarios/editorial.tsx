"use client";
import { useEffect, useState } from "react";
import type { PreguntaBalotario } from "@/lib/balotarios-policy";
import { boton, campo, primario } from "./pregunta";
type Documento = { id: string; title: string; metadata: { officialVersion?: string; sha256?: string } };
type Fragmento = { id: string; content: string; page_start: number; page_end: number; metadata: { article?: string } };
export type ReporteEditorial = { id: string; question_id: string; reason: string; created_at: string };
export function RevisionEditorial({ preguntas, reports, onActualizado }: { preguntas: PreguntaBalotario[]; reports: ReporteEditorial[]; onActualizado: () => void }) {
  const [qid, setQid] = useState(preguntas[0]?.id ?? ""); const q = preguntas.find(q => q.id === qid)!;
  const [docs, setDocs] = useState<Documento[]>([]); const [docId, setDocId] = useState("");
  const [page, setPage] = useState(1); const [chunks, setChunks] = useState<Fragmento[]>([]); const [chunkId, setChunkId] = useState("");
  const [explanation, setExplanation] = useState(""); const [competency, setCompetency] = useState("");
  const [correct, setCorrect] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [prompt,setPrompt]=useState<string|null>(null); const [optionTexts,setOptionTexts]=useState<Record<string,string>>({});
  function seleccionar(id: string) { setQid(id); setExplanation(""); setMessage(""); setPrompt(null); setOptionTexts({}); setCompetency(""); setCorrect(""); }
  useEffect(() => { const c = new AbortController(); fetch("/api/exams/bank", { signal: c.signal, cache: "no-store" }).then(async r => { const x = await r.json(); if (!r.ok) throw Error(x.error); setDocs(x.documents ?? []); }).catch(e => { if (!c.signal.aborted) setMessage(e.message); }); return () => c.abort(); }, []);
  async function buscar() {
    setBusy(true); setMessage(""); setChunks([]); setChunkId("");
    try { const r = await fetch(`/api/exams/bank?documentId=${encodeURIComponent(docId)}&page=${page}`, { cache: "no-store" }); const x = await r.json(); if (!r.ok) throw Error(x.error); setChunks(x.chunks ?? []); if (!x.chunks?.length) setMessage("No hay fragmentos indexados en esa página."); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="mt-6 rounded-2xl border border-line bg-panel p-5"><summary className="cursor-pointer font-semibold text-ink">Revisión editorial · {preguntas.filter(q => !q.revisada).length} preguntas pendientes</summary>
    <p className="my-3 text-sm text-muted">La clave importada solo pasa a revisada con explicación, competencia y un pasaje comprobado del corpus. La comprobación de la cita no sustituye el juicio editorial sobre la respuesta.</p>
    <p className="my-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">{preguntas.filter(q=>!q.competencia).length} sin competencia · {preguntas.filter(q=>q.incidencia).length} incidencias de contexto · {preguntas.length-new Set(preguntas.map(q=>q.pregunta.toLowerCase().replace(/\s+/g," ").trim())).size} repeticiones de enunciado que deben compararse con sus opciones.</p>
    {reports.length>0&&<details className="my-4 rounded-xl border border-line p-3"><summary className="cursor-pointer font-medium text-ink">Reportes recibidos · últimos {reports.length}</summary><ul className="mt-3 space-y-3">{reports.map(r=><li className="rounded-lg bg-surface p-3 text-sm text-ink" key={r.id}><p>{r.reason}</p><button type="button" className={`${boton} mt-2`} onClick={()=>{seleccionar(r.question_id);}}>Revisar pregunta {r.question_id}</button></li>)}</ul></details>}
    <label className="block text-sm text-ink">Pregunta<select className={campo} value={qid} onChange={e => seleccionar(e.target.value)}>{preguntas.map(q => <option key={q.id} value={q.id}>{q.id} · {q.pregunta.slice(0,100)}</option>)}</select></label>
    {q && <><label className="mt-3 block text-sm text-ink">Enunciado completo<textarea className={campo} minLength={20} maxLength={3000} rows={3} value={prompt??q.pregunta} onChange={e=>setPrompt(e.target.value)}/></label><div className="mt-3 grid gap-3 sm:grid-cols-2">{q.opciones.map(o=><label key={o.letra} className="text-sm text-ink">Alternativa {o.letra}<textarea className={campo} minLength={2} maxLength={1000} rows={3} value={optionTexts[o.letra]??o.texto} onChange={e=>setOptionTexts(old=>({...old,[o.letra]:e.target.value}))}/></label>)}</div></>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-ink">Competencia<select className={campo} value={competency} onChange={e => setCompetency(e.target.value)}><option value="">Confirma la competencia</option>{[1,2,3].map(n => <option key={n}>COMPETENCIA {n}</option>)}</select></label>
      <label className="text-sm text-ink">Respuesta contrastada<select className={campo} value={correct} onChange={e => setCorrect(e.target.value)}><option value="">Confirma la respuesta correcta</option>{q?.opciones.map(o => <option key={o.letra} value={o.letra}>{o.letra} · {optionTexts[o.letra]??o.texto}</option>)}</select></label></div>
    <label className="mt-3 block text-sm text-ink">Explicación y fundamento<textarea minLength={40} maxLength={6000} rows={4} className={campo} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-ink">Documento institucional<select className={campo} value={docId} onChange={e => { setDocId(e.target.value); setChunks([]); setChunkId(""); }}><option value="">Selecciona una fuente</option>{docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
      <label className="text-sm text-ink">Página<input className={campo} type="number" min={1} max={20000} value={page} onChange={e => { setPage(Number(e.target.value)); setChunks([]); setChunkId(""); }} /></label></div>
    <button type="button" className={`${boton} mt-3`} disabled={busy || !docId} onClick={() => void buscar()}>Consultar pasajes</button>
    {chunks.length > 0 && <label className="mt-3 block text-sm text-ink">Pasaje<select value={chunkId} className={campo} onChange={e => setChunkId(e.target.value)}><option value="">Selecciona el fundamento</option>{chunks.map(c => <option key={c.id} value={c.id}>Artículo {c.metadata.article || "sin identificar"} · {c.content.slice(0,100)}</option>)}</select></label>}
    {chunkId && <blockquote className="mt-3 max-h-64 overflow-auto rounded-xl bg-surface p-4 text-sm leading-relaxed text-ink">{chunks.find(c => c.id === chunkId)?.content}</blockquote>}
    <button type="button" className={`${primario} mt-4`} disabled={busy || !chunkId || !competency || !correct || explanation.trim().length < 40} onClick={async () => {
      const doc = docs.find(d => d.id === docId)!; const chunk = chunks.find(c => c.id === chunkId)!; setBusy(true); setMessage("");
      try { const r = await fetch("/api/balotarios/contenido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: qid, prompt:prompt??q.pregunta, options:q.opciones.map(o=>({id:o.letra,text:optionTexts[o.letra]??o.texto})), competency, correct, explanation, sources: [{ documentId: doc.id, chunkId: chunk.id, title: doc.title, article: String(chunk.metadata.article ?? ""), pageStart: chunk.page_start, pageEnd: chunk.page_end, quote: chunk.content.slice(0,5000), version: doc.metadata.officialVersion ?? "", sha256: doc.metadata.sha256 ?? "" }] }) }); const x = await r.json(); if (!r.ok) throw Error(x.error); setMessage("Revisión guardada con fuente comprobada. Los intentos anteriores mantienen su versión."); onActualizado(); }
      catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
    }}>Guardar revisión con fuente</button><p className="mt-3 text-sm text-muted" role="status">{message}</p>
  </details>;
}
