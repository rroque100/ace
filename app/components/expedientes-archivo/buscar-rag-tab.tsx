"use client";
import { useEffect, useRef, useState } from "react";
import type { RagIdentity } from "@/lib/archivo-rag";
import type { ChatAnswer, SearchResult } from "./types";

type Row = { id: string; title: string; file_name: string; status: string; tipo_documento: string | null; nro_archivador: string | null; nro_local: string | null; nro_estante: string | null; nro_piso: string | null; error_message: string | null; metadata: { rag?: RagIdentity; uploadSource?: string; ocrPartial?: boolean; ragPagesDone?: number; pageCount?: number } | null };
const control = "w-full rounded-lg border border-exp-line bg-exp-panel px-3 py-2 text-sm text-exp-ink";
const button = "rounded-lg bg-exp-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const emptyFilters = { cp: "", siaf: "", cabinet: "", type: "", year: "" };

export function BuscarRagTab({ canManage, openDocument }: { canManage: boolean; openDocument: (id: string) => Promise<void> }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [hits, setHits] = useState<SearchResult[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const controller = useRef<AbortController | null>(null);
  const stopProcessing = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/expedientes-archivo/rag?${new URLSearchParams({ ...applied, page: String(page) })}`, { signal: abort.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setRows(result.rows); setMore(result.hasMore);
      } catch (err) { if (!abort.signal.aborted) { setRows([]); setMore(false); setError(err instanceof Error ? err.message : "No se pudo consultar"); } }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }
    void load(); return () => abort.abort();
  }, [applied, page, refresh]);
  useEffect(() => () => { controller.current?.abort(); stopProcessing.current = true; }, []);
  function select(row: Row | null) { controller.current?.abort(); setAsking(false); setSelected(row); setAnswer(null); setHits([]); setError(""); }
  async function consult(mode: "search" | "chat") {
    if (query.trim().length < 3 || asking) return;
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 90_000);
    setAsking(true); setError(""); setAnswer(null); setHits([]);
    try {
      const response = await fetch(`/api/expedientes-archivo/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal, body: JSON.stringify({ query, documentId: selected?.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo consultar");
      if (mode === "chat") setAnswer(result); else setHits(result.results);
      if ((mode === "chat" ? result.sources : result.results).length === 0) setError("No se encontraron fragmentos. Comprueba si terminó el OCR o cambia la consulta.");
    } catch (err) { if (controller.current === abort) setError(abort.signal.aborted ? "La consulta se detuvo o superó el tiempo de espera. Puedes reintentar." : err instanceof Error ? err.message : "No se pudo consultar"); }
    finally { clearTimeout(timer); if (controller.current === abort) setAsking(false); }
  }
  // Avanza UN expediente por bloques hasta que termina, falla o se pide
  // pausa. Extraído aparte de `advance`/`advanceAll` porque ambos lo
  // necesitan: uno para una fila, el otro para recorrer varias seguidas.
  async function advanceOne(row: Row, etiqueta: (msg: string) => string = (m) => m) {
    while (!stopProcessing.current) {
      const response = await fetch("/api/expedientes-archivo/rag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }), signal: AbortSignal.timeout(290_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const current = result.current;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...current } : r));
      setProgress(etiqueta(current?.status === "indexed" ? "Documento completo y disponible para consultas." : `Avance guardado: ${current?.metadata?.ragPagesDone ?? 0}/${current?.metadata?.pageCount ?? "?"} páginas. Continuando…`));
      if (!current || current.status === "indexed" || current.status === "error") return;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  async function advance(row: Row) {
    if (processing) return;
    stopProcessing.current = false;
    setProcessing(row.id); setProgress("Procesando el siguiente bloque de páginas…"); setError("");
    try {
      await advanceOne(row);
      setRefresh(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo continuar"); }
    finally { setProcessing(null); }
  }
  // "Procesar todos los pendientes" (de esta página): antes había que abrir
  // cada fila y pulsar "Procesar hasta completar" una por una — inviable para
  // un lote real de decenas de archivos subidos con Subir RAG. Recorre los
  // pendientes EN ORDEN, uno a la vez (no en paralelo, mismo criterio de no
  // saturar el servidor que ya usaba el botón por fila); si uno falla, sigue
  // con el siguiente en vez de abortar el lote entero.
  async function advanceAll() {
    if (processing) return;
    const pendientes = rows.filter(r => r.metadata?.uploadSource === "rag-folder" && r.status !== "indexed");
    if (pendientes.length === 0) return;
    stopProcessing.current = false;
    setProcessing("__all__"); setError("");
    try {
      for (let i = 0; i < pendientes.length; i += 1) {
        if (stopProcessing.current) break;
        const row = pendientes[i];
        try {
          await advanceOne(row, (msg) => `(${i + 1}/${pendientes.length}) "${row.title}": ${msg}`);
        } catch (err) {
          setError(`"${row.title}": ${err instanceof Error ? err.message : "no se pudo continuar"} — sigo con el resto.`);
        }
      }
      setProgress(stopProcessing.current ? "Lote detenido; el avance de cada archivo queda guardado." : "Lote de esta página terminado.");
      setRefresh(n => n + 1);
    } finally { setProcessing(null); }
  }
  const sources = answer?.sources ?? hits;
  return <section className="space-y-5 p-5 text-exp-ink" aria-labelledby="rag-search-title">
    <div><h2 id="rag-search-title" className="text-xl font-semibold">Buscar RAG</h2><p className="mt-1 text-sm text-exp-muted">Localiza archivos por sus datos, abre el PDF o consulta el contenido con fuentes.</p></div>
    <form className="space-y-3 rounded-xl border border-exp-line p-4" onSubmit={e => { e.preventDefault(); setApplied({ ...filters }); setPage(1); select(null); }}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{([['cp','Número CP','CP2955'],['siaf','SIAF','0982'],['cabinet','Código de archivador','CP_T137_EXP_2955 AL 2968 _2022'],['type','Tipo documental','NOTAS DE PAGO'],['year','Año','2022']] as const).map(([key,label,placeholder]) => <label key={key} className="text-sm">{label}<input className={control} value={filters[key]} placeholder={placeholder} maxLength={120} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></label>)}</div>
      <p className="text-xs text-exp-muted">Los filtros buscan valores exactos. CP y SIAF están disponibles en los archivos importados con Subir RAG. Sin filtros, se muestran todos los registros permitidos.</p>
      <div className="flex gap-2"><button className={button} disabled={loading}>Buscar registros</button><button type="button" className={control + " !w-auto"} onClick={() => { setFilters(emptyFilters); setApplied({ ...emptyFilters }); setPage(1); select(null); }}>Limpiar</button><button type="button" className={control + " !w-auto"} onClick={() => setRefresh(n => n + 1)}>Actualizar</button></div>
    </form>
    {loading ? <p role="status">Buscando registros…</p> : <div className="space-y-3">{rows.length === 0 && <p>No hay archivos que coincidan con estos filtros.</p>}{rows.map(row => <article key={row.id} className="rounded-xl border border-exp-line p-4">
      <h3 className="font-semibold">{row.title}</h3>
      <p className="mt-1 text-sm">{[row.tipo_documento, row.metadata?.rag?.cp, row.metadata?.rag?.siaf ? `SIAF ${row.metadata.rag.siaf}` : "", row.metadata?.rag?.date].filter(Boolean).join(" · ")}</p>
      <p className="mt-2 text-sm">{[row.nro_archivador ? `Archivador: ${row.nro_archivador}` : "", row.nro_local ? `Local: ${row.nro_local}` : "", row.nro_estante ? `Estante: ${row.nro_estante}` : "", row.nro_piso ? `Piso: ${row.nro_piso}` : ""].filter(Boolean).join(" · ") || "Ubicación física no registrada"}</p>
      <p className="mt-2 text-xs text-exp-muted">{row.status === "indexed" ? row.metadata?.ocrPartial ? "Contenido parcial: faltan páginas por leer" : "Contenido disponible para consultas" : row.status === "error" ? "Requiere reintento" : "Guardado · contenido pendiente de procesamiento"}{row.metadata?.ragPagesDone != null && row.status !== "indexed" ? ` · ${row.metadata.ragPagesDone}/${row.metadata.pageCount ?? "?"} páginas leídas` : ""}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button className={control + " !w-auto"} onClick={() => void openDocument(row.id).catch(() => setError("No se pudo abrir el documento"))}>Abrir PDF y ficha</button><button className={button} disabled={row.status !== "indexed"} onClick={() => select(row)}>Consultar este expediente</button>{canManage && row.metadata?.uploadSource === "rag-folder" && row.status !== "indexed" && <button disabled={!!processing} className={control + " !w-auto"} onClick={() => void advance(row)}>{processing === row.id ? "Procesando…" : "Procesar hasta completar"}</button>}</div>
    </article>)}</div>}
    {canManage && rows.some(r => r.metadata?.uploadSource === "rag-folder" && r.status !== "indexed") && <button className={button} disabled={!!processing} onClick={() => void advanceAll()}>{processing === "__all__" ? "Procesando lote…" : `Procesar todos los pendientes de esta página (${rows.filter(r => r.metadata?.uploadSource === "rag-folder" && r.status !== "indexed").length})`}</button>}
    <nav aria-label="Páginas de resultados" className="flex items-center gap-3"><button className={control + " !w-auto"} disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><span className="text-sm">Página {page}</span><button className={control + " !w-auto"} disabled={!more || loading} onClick={() => setPage(p => p + 1)}>Siguiente</button></nav>
    <p role="status" className="text-sm text-exp-muted">{progress}</p>
    {processing && <button className={control + " !w-auto"} onClick={() => { stopProcessing.current = true; setProgress("Se detendrá al terminar el bloque actual. El avance queda guardado."); }}>Pausar después del bloque actual</button>}
    <div className="space-y-3 rounded-xl border border-exp-line p-4">
      <h3 className="font-semibold">Consultar contenido</h3>
      <p className="text-sm">{selected ? `Expediente seleccionado: ${selected.title}` : "Consulta general sobre los documentos disponibles. Los filtros de registros de arriba no limitan esta consulta; selecciona un expediente para acotarla."}</p>
      {selected && <button className={control + " !w-auto"} onClick={() => select(null)}>Volver a consulta general</button>}
      <label className="block text-sm">Pregunta o texto a buscar<textarea className={control} value={query} maxLength={500} onChange={e => setQuery(e.target.value)} placeholder="¿Qué documentos sustentan este pago?" /></label>
      <p className="text-xs text-exp-muted">Las respuestas usan solo fragmentos recuperados y citan sus fuentes. No sustituyen la revisión completa del expediente.</p>
      <div className="flex gap-2"><button className={button} disabled={asking || query.trim().length < 3} onClick={() => void consult("search")}>Buscar contenido</button><button className={button} disabled={asking || query.trim().length < 3} onClick={() => void consult("chat")}>{asking ? "Consultando…" : "Preguntar a la IA"}</button></div>
      {answer && <p className="whitespace-pre-wrap rounded-lg bg-exp-brand-soft p-4 text-sm">{answer.answer}</p>}
      {answer?.warnings && answer.warnings.length > 0 && <p role="alert" className="rounded-lg border-l-[3px] border-l-exp-warning bg-exp-warning-soft p-3 text-sm text-[#78350f]">{answer.warnings.join(" ")}</p>}
      {sources.map((source, i) => <article key={`${source.expedienteId}-${source.pageStart}-${i}`} className="border-t border-exp-line pt-3 text-sm"><button className="font-semibold text-exp-brand underline" onClick={() => void openDocument(source.expedienteId).catch(() => setError("No se pudo abrir la fuente"))}>[E{i + 1}] {source.title} · {source.citation}</button><p className="mt-2">{source.excerpt}</p><p className="mt-2 text-exp-muted">{source.ubicacionResumen}</p></article>)}
    </div>
    {canManage && <p className="text-xs text-exp-muted">El servidor guarda el avance del OCR. Puedes continuar por bloques desde aquí; el proceso automático de recuperación está programado una vez al día.</p>}
    {error && <p role="alert" className="rounded-lg border border-exp-line p-3 text-sm">{error}</p>}
  </section>;
}
