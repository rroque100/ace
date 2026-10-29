"use client";

import "./voice-search.css";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, LoaderCircle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { assistantProposalSchema, type AssistantProposal } from "@/lib/search-assistant";
import { type DocumentSearchFilters, type DocumentSearchInput } from "@/lib/document-search";
import { voiceSearchInput, reviewVoiceText, voiceFallback, guardVoiceProposal } from "@/lib/voice-search";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { useVoiceRecorder } from "./use-voice-recorder";

export function VoiceSearch({ filters, onApply }: { filters: DocumentSearchFilters; onApply: (input: DocumentSearchInput) => void }) {
  const [open, setOpen] = useState(false);
  const voice = useVoiceRecorder({ purpose: "search", open });
  const { phase, config, error, setError, consent, setConsent, seconds, maxSeconds, text, setText, original, audioUrl, uncertain } = voice;
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const prepareRequest = useRef<AbortController | null>(null);
  const review = reviewVoiceText(text);

  useEffect(() => () => prepareRequest.current?.abort(), []);

  function close() {
    prepareRequest.current?.abort(); voice.reset(); setOpen(false); setProposal(null); setConfirmed(false); setPreparing(false);
  }
  async function start() {
    prepareRequest.current?.abort(); setProposal(null); setConfirmed(false); setPreparing(false);
    await voice.start();
  }
  async function prepare() {
    if (review.ambiguous) return;
    const token = voice.generation.current; const controller = new AbortController(); prepareRequest.current = controller;
    setPreparing(true); setError(""); setProposal(null); setConfirmed(false);
    let next = voiceFallback(review.normalized);
    try {
      const response = await fetch("/api/search/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: review.normalized, scope: "search" }), signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json(); next = guardVoiceProposal(review.normalized, assistantProposalSchema.parse(result.proposal));
    } catch { if (!controller.signal.aborted) next.explanation = "La ayuda de IA no estuvo disponible. Revisa estos criterios preparados a partir de tu texto."; }
    if (voice.generation.current === token && !controller.signal.aborted) {
      try { setProposal({ ...next, search: voiceSearchInput(filters, next) }); }
      catch { setError("Revisa los filtros actuales, especialmente el intervalo de fechas, antes de buscar."); }
      setPreparing(false);
    }
  }
  function apply() {
    if (!proposal || !confirmed) return;
    try { const input = voiceSearchInput(filters, proposal); onApply(input); close(); }
    catch { setError("Revisa los criterios y el intervalo de fechas antes de buscar."); }
  }
  return <Dialog open={open} onOpenChange={value => value ? setOpen(true) : close()}>
    <DialogTrigger asChild><button type="button" className="secondaryButton voiceSearchTrigger" aria-label="Buscar por voz" title="Buscar por voz"><Mic size={20} aria-hidden="true" /><span>Voz</span></button></DialogTrigger>
    <DialogContent title="Buscar por voz" description="Habla, revisa lo que entendió ACE y confirma antes de buscar." size="lg">
      <div className="voiceSearchBody">
        <ol className="voiceSearchSteps" aria-label="Pasos de la búsqueda por voz"><li>Hablar</li><li>Revisar</li><li>Buscar</li></ol>
        {(phase === "ready" || phase === "error") ? <>
          <p>Consultas cortas de hasta {maxSeconds} segundos, en español. Pronuncia despacio los números, años y siglas.</p>
          <div className="voicePrivacy"><strong>Antes de grabar</strong><p>{config?.provider || "El proveedor indicado"} procesará el audio para transcribirlo. ACE no lo guarda en archivos, biblioteca ni historial. La grabación queda en memoria de esta ventana hasta que cierres o vuelvas a grabar; el servidor la procesa solo durante la petición.</p><p>Al preparar los criterios, el texto revisado se enviará al asistente de ACE{config?.assistantProvider ? ` (${config.assistantProvider === "gemini" ? "Google Gemini" : config.assistantProvider === "zai" ? "Z.ai" : "OpenAI"})` : ""}.</p>{config?.providerId === "gemini" ? <p>Google puede conservar registros para control de abuso durante 55 días; otros usos dependen del plan contratado. ACE no ha verificado el plazo total de tu plan. Evita datos personales o confidenciales.</p> : null}{config?.policyUrl ? <a href={config.policyUrl} target="_blank" rel="noreferrer">Consultar la conservación de datos de {config.provider}</a> : null}</div>
          <label className="voiceConsent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Entiendo quién procesará la grabación y el texto revisado.</label>
          <button className="primaryButton" type="button" onClick={() => void start()} disabled={!consent || !config?.available}><Mic size={18} /> Empezar a grabar</button>
          {config && !config.available ? <p role="status">La transcripción no está disponible. La búsqueda escrita sigue funcionando.</p> : !config ? <p role="status">Comprobando disponibilidad…</p> : null}
        </> : null}
        {phase === "permission" ? <p role="status">Acepta el permiso del navegador para empezar. Puedes cancelar sin grabar.</p> : null}
        {phase === "recording" ? <div className="voiceListening"><Mic size={28} /><strong role="status">Escuchando · {seconds} / {maxSeconds} s</strong><p>Al detener, se enviará el audio para transcribir.</p><button className="primaryButton" type="button" onClick={voice.stop}><Square size={16} /> Detener y transcribir</button></div> : null}
        {phase === "processing" ? <p role="status"><LoaderCircle className="spin" size={18} /> Procesando la grabación…</p> : null}
        {phase === "review" ? <>
          <h3>Revisa lo que entendí</h3>
          {audioUrl ? <audio controls preload="metadata" src={audioUrl} aria-label="Escuchar tu grabación" /> : null}
          <label>Transcripción editable<textarea rows={3} maxLength={500} value={text} onChange={event => { prepareRequest.current?.abort(); setPreparing(false); setText(event.target.value); setProposal(null); setConfirmed(false); }} /></label>
          {text !== original ? <details><summary>Transcripción recibida</summary><p>{original}</p></details> : null}
          {uncertain ? <p className="voiceReviewNote">Revisa con atención: la transcripción contiene señales de duda o no se pudo comprobar su calidad. Puedes escucharla y corregirla.</p> : null}
          {review.normalized !== text ? <p className="voiceInterpretation"><strong>Interpretación propuesta:</strong> {review.normalized}</p> : null}
          {review.references.length ? <p><strong>Números y siglas para confirmar:</strong> {review.references.join(" · ")}</p> : null}
          {review.warnings.map(warning => <p className="voiceReviewNote" key={warning}>{warning}</p>)}
          <button className="primaryButton" type="button" disabled={preparing || text.trim().length < 3 || review.normalized.length > 500 || review.ambiguous} onClick={() => void prepare()}>{preparing ? "Preparando criterios…" : "Preparar criterios"}</button>
          {proposal ? <section className="voiceCriteria" aria-label="Criterios para confirmar"><h3>Confirma tu búsqueda</h3><p>{proposal.explanation}</p>
            <label>Tema o referencia<input maxLength={500} value={proposal.search.query} onChange={event => { setProposal({ ...proposal, search: { ...proposal.search, query: event.target.value } }); setConfirmed(false); }} /></label>
            <label>Tipo<select value={proposal.search.filters.documentType ?? ""} onChange={event => { setProposal({ ...proposal, search: { ...proposal.search, filters: { ...proposal.search.filters, documentType: event.target.value } } }); setConfirmed(false); }}><option value="">Conservar filtro actual</option>{OFFICIAL_CORPUS_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <div className="voiceCriteriaNumbers"><label>Año<input type="number" min={1900} max={2200} value={proposal.search.filters.year ?? ""} onChange={event => { setProposal({ ...proposal, search: { ...proposal.search, filters: { ...proposal.search.filters, year: event.target.value ? Number(event.target.value) : undefined } } }); setConfirmed(false); }} /></label><label>Artículo o numeral<input value={proposal.search.filters.article ?? ""} onChange={event => { setProposal({ ...proposal, search: { ...proposal.search, filters: { ...proposal.search.filters, article: event.target.value } } }); setConfirmed(false); }} /></label></div>
            <p>Se conservan tus demás filtros. No se deduce régimen ni vigencia.</p>
            <label className="voiceConsent"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Revisé el texto, los números, el año y las siglas.</label>
            <button className="primaryButton" type="button" disabled={!confirmed} onClick={apply}>Buscar con estos criterios</button>
          </section> : null}
          <button className="secondaryButton" type="button" onClick={() => void start()} disabled={preparing}><RotateCcw size={17} /> Volver a grabar</button>
        </> : null}
        {error ? <p role="alert" className="voiceReviewNote">{error}</p> : null}
        <button className="secondaryButton" type="button" onClick={close}>{phase === "ready" ? "Volver a la búsqueda escrita" : "Cancelar"}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
