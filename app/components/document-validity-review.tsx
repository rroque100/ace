"use client";

import { useEffect, useState } from "react";
import { activeValidityReview, VALIDITY_RESULTS, validityReviewInput, type ValidityRecord } from "@/lib/validity-review";
import { ValidityReviewDetails } from "./validity-review-details";

type Article = { id: string; articleNumber: string; bodyTitle?: string; pageStart: number | null };
type ReviewState = { revision: number; active: { document?: unknown; articles?: Record<string, unknown> }; invalidatedAt: string | null; canReview: boolean; history: Array<{ id: string; revision: number; record: ValidityRecord }>; nextBefore: number | null };
export function DocumentValidityReview({ documentId, version, articles, onSaved }: {
  documentId: string; version: string | null; articles: Article[]; onSaved: () => void;
}) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("insufficient");
  const [scope, setScope] = useState("document");
  const [articleIds, setArticleIds] = useState<string[]>([]);
  const [versionLabel, setVersionLabel] = useState(version ?? "");
  const [asOf, setAsOf] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [basis, setBasis] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/api/norms/${documentId}/validity`, { cache: "no-store", signal: abort.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error);
      setState(payload); setError("");
    }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar la revisión"); });
    return () => abort.abort();
  }, [documentId]);
  async function refresh(append = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/norms/${documentId}/validity${append && state?.nextBefore ? `?before=${state.nextBefore}` : ""}`, { cache: "no-store" });
      const payload = await response.json(); if (!response.ok) throw Error(payload.error);
      setState(append ? { ...payload, history: [...(state?.history ?? []), ...payload.history] } : payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar la revisión"); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!state) return;
    const parsed = validityReviewInput.safeParse({ result, scope, articleIds: scope === "articles" ? articleIds : [], version: versionLabel, asOf, sourceUrl, basis, revision: state.revision });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/norms/${documentId}/validity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload = await response.json(); if (!response.ok) throw Error(payload.error);
      setOpen(false); setSuccess("Revisión guardada y visible para quienes consultan esta versión.");
      await refresh(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la revisión"); }
    finally { setBusy(false); }
  }
  const current = state ? activeValidityReview({ validityReviews: state.active }) : null;
  return <section className="documentValidityReview" aria-label="Revisión de vigencia">
    <h3>Estado y revisión de esta versión</h3>
    {!state && !error ? <p role="status">Consultando revisión…</p> : null}
    {current ? <ValidityReviewDetails review={current} /> : state ? <p>No hay revisión activa del documento completo. {Object.keys(state.active.articles ?? {}).length ? "Hay revisiones específicas de artículos: consulta el historial o abre el artículo." : "Los estados registrados automáticamente no sustituyen esta revisión."}</p> : null}
    {state?.invalidatedAt && !current ? <p>El archivo o su estructura cambió. Las revisiones anteriores se conservan en el historial y requieren nueva comprobación.</p> : null}
    {state?.canReview ? <button type="button" className="secondaryButton" onClick={() => setOpen(!open)} disabled={busy}>{open ? "Cerrar formulario" : "Registrar revisión de estado"}</button> : null}
    {open ? <form onSubmit={save}>
      <p>Registra únicamente lo que has comprobado. Este registro será institucional y visible para otros usuarios; no incluyas datos privados de expedientes.</p>
      <div className="validityReviewGrid">
        <label>Resultado<select aria-label="Resultado de la revisión" value={result} onChange={event => setResult(event.target.value)}>{VALIDITY_RESULTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Alcance<select aria-label="Alcance de la revisión" value={scope} onChange={event => setScope(event.target.value)}><option value="document">Documento completo</option><option value="articles">Solo artículos seleccionados</option></select></label>
        <label>Versión comprobada<input value={versionLabel} onChange={event => setVersionLabel(event.target.value)} minLength={3} maxLength={200} required placeholder="Denominación del texto y su actualización" /></label>
        <label>Comprobado a fecha de<input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} required /></label>
      </div>
      {scope === "articles" ? <fieldset><legend>Artículos incluidos en la revisión</legend><p>Selecciona por cuerpo normativo, número y página; no solo por número.</p><div className="validityArticleChoices">{articles.map(article => <label key={article.id}><input type="checkbox" checked={articleIds.includes(article.id)} onChange={event => setArticleIds(previous => event.target.checked ? [...previous, article.id] : previous.filter(id => id !== article.id))} />{article.bodyTitle ?? "Cuerpo sin identificar"} · artículo {article.articleNumber} · página {article.pageStart ?? "sin registrar"}</label>)}</div>{!articles.length ? <p>Este documento no tiene artículos identificados. No se puede registrar un alcance por artículos.</p> : null}</fieldset> : null}
      <label>Publicación oficial que sustenta la revisión<input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2000} required placeholder="https://www.gob.pe/…" /></label>
      <label>Sustento y observaciones<textarea value={basis} onChange={event => setBasis(event.target.value)} minLength={20} maxLength={6000} rows={5} required placeholder="Qué comprobaste, modificaciones o derogaciones consultadas y alcance de la conclusión. Si es parcial, identifica las partes afectadas." /></label>
      <p>El servidor registrará tu identidad y la hora. Una corrección crea otra entrada; no elimina el historial.</p>
      <div className="formActions"><button className="primaryButton" disabled={busy}>{busy ? "Guardando…" : "Guardar revisión y hacerla visible"}</button><button type="button" className="secondaryButton" disabled={busy} onClick={() => void refresh()}>Recargar revisión sin borrar mi texto</button></div>
    </form> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" className="secondaryButton" disabled={busy} onClick={() => void refresh()}>Volver a consultar</button></div> : null}
    {success ? <p role="status">{success}</p> : null}
    {state ? <details><summary>Historial de revisiones · {state.history.length} cargadas</summary>{state.history.length ? state.history.map(item => <article key={item.id}><p>Revisión {item.revision} {current?.id === item.id ? "· activa para el documento" : "· registro histórico o alcance específico"}</p><ValidityReviewDetails review={item.record} /></article>) : <p>No hay revisiones registradas.</p>}{state.nextBefore ? <button type="button" className="secondaryButton" disabled={busy} onClick={() => void refresh(true)}>Cargar revisiones anteriores</button> : null}</details> : null}
  </section>;
}
