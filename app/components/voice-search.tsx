"use client";

import "./voice-search.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, LoaderCircle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { assistantProposalSchema, type AssistantProposal } from "@/lib/search-assistant";
import { type DocumentSearchFilters, type DocumentSearchInput } from "@/lib/document-search";
import { VOICE_MAX_BYTES, VOICE_MAX_MS, voiceSearchInput, reviewVoiceText, voiceFallback, guardVoiceProposal } from "@/lib/voice-search";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";
import { acquireVoiceStream, voiceCaptureError } from "@/lib/voice-capture";

const recordingTime = () => performance.now();

type Phase = "ready" | "permission" | "recording" | "processing" | "review" | "error";
type Config = { available: boolean; provider: string; providerId: string; policyUrl: string; assistantProvider: string };

export function VoiceSearch({ filters, onApply }: { filters: DocumentSearchFilters; onApply: (input: DocumentSearchInput) => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const context = useRef<AudioContext | null>(null);
  const review = reviewVoiceText(text);

  const release = useCallback(() => {
    generation.current++;
    request.current?.abort();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      try { if (recorder.current.state !== "inactive") recorder.current.stop(); } catch { /* A disconnected device may already have ended recording. */ }
    }
    recorder.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    void context.current?.close().catch(() => {}); context.current = null;
    chunks.current = [];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
  }, []);
  useEffect(() => release, [release]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/search/voice", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(); return response.json() as Promise<Config>;
    }).then(data => { if (!controller.signal.aborted) setConfig(data); }).catch(error => {
      if (error.name !== "AbortError") { setConfig({ available: false, provider: "", providerId: "", policyUrl: "", assistantProvider: "" }); setError("No se pudo comprobar la transcripción. Puedes seguir escribiendo."); }
    });
    return () => controller.abort();
  }, [open]);

  function close() {
    release(); setOpen(false); setPhase("ready"); setText(""); setOriginal(""); setAudioUrl(""); setProposal(null); setError(""); setConsent(false); setConfirmed(false); setPreparing(false); setConfig(null);
  }
  async function start() {
    release(); const token = generation.current;
    setText(""); setOriginal(""); setAudioUrl(""); setProposal(null); setConfirmed(false); setError(""); setSeconds(0); setUncertain(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setPhase("error"); setError("Este navegador no permite grabar aquí. Usa un navegador compatible o escribe tu búsqueda."); return; }
    setPhase("permission");
    let stage: "microphone" | "recorder" = "microphone";
    try {
      const acquired = await acquireVoiceStream(navigator.mediaDevices);
      if (generation.current !== token) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      stage = "recorder";
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error("unsupported");
      const recording = new MediaRecorder(acquired, { mimeType: mime, audioBitsPerSecond: 64_000 });
      recorder.current = recording;
      let size = 0; let heardVoice = 0; let measured = false; let analyser: AnalyserNode | null = null;
      try {
        const audioContext = new AudioContext(); context.current = audioContext;
        void audioContext.resume().catch(() => {});
        analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
        audioContext.createMediaStreamSource(acquired).connect(analyser);
      } catch { /* Recording still works if volume measurement is unavailable. */ }
      const began = recordingTime();
      recording.ondataavailable = event => {
        if (generation.current !== token) return;
        size += event.data.size;
        if (size > VOICE_MAX_BYTES) { release(); setPhase("error"); setError("La grabación es demasiado grande. Repite una consulta más corta."); return; }
        if (event.data.size) chunks.current.push(event.data);
      };
      recording.onerror = () => { if (generation.current === token) { release(); setPhase("error"); setError("Se interrumpió el micrófono. Vuelve a grabar o escribe tu consulta."); } };
      recording.onstop = () => {
        if (timer.current) clearInterval(timer.current); timer.current = null;
        acquired.getTracks().forEach(track => track.stop()); stream.current = null;
        void context.current?.close().catch(() => {}); context.current = null;
        if (generation.current !== token) return;
        const duration = Math.min(VOICE_MAX_MS, Math.round(recordingTime() - began));
        if (duration < 500 || (measured && heardVoice < 2) || !size) { chunks.current = []; setPhase("error"); setError("No se detectó voz suficiente. Acerca el micrófono y vuelve a grabar."); return; }
        const type = mime.split(";")[0];
        const audio = new Blob(chunks.current, { type }); chunks.current = [];
        objectUrl.current = URL.createObjectURL(audio); setAudioUrl(objectUrl.current);
        void transcribe(audio, duration, type, token);
      };
      recording.start(250); setPhase("recording");
      timer.current = setInterval(() => {
        if (generation.current !== token) return;
        const elapsed = recordingTime() - began; setSeconds(Math.min(45, Math.floor(elapsed / 1000)));
        if (analyser && context.current?.state === "running") {
          const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
          measured = true; if (rms > .012) heardVoice++;
        }
        if (elapsed >= VOICE_MAX_MS && recording.state === "recording") recording.stop();
      }, 200);
    } catch (failure) {
      if (generation.current !== token) return;
      release(); setPhase("error");
      setError(voiceCaptureError(failure, stage));
    }
  }
  async function transcribe(audio: Blob, duration: number, type: string, token: number) {
    setPhase("processing"); const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35_000);
    const data = new FormData();
    data.append("audio", audio, `consulta.${type === "audio/mp4" ? "mp4" : type === "audio/ogg" ? "ogg" : "webm"}`);
    data.append("durationMs", String(duration)); data.append("consent", "true"); data.append("provider", config?.providerId || "");
    try {
      const response = await fetch("/api/search/voice", { method: "POST", body: data, signal: controller.signal });
      const result = await response.json().catch(()=>({error:"No se pudo procesar la grabación. Reintenta o escribe tu búsqueda."})); if (!response.ok || typeof result.text!=="string") throw new Error(result.error || "No se obtuvo una transcripción utilizable.");
      if (generation.current !== token) return;
      setText(result.text); setOriginal(result.text); setUncertain(Boolean(result.uncertain) || !result.qualityAssessed); setPhase("review");
    } catch (failure) {
      if (generation.current !== token) return;
      setError(controller.signal.aborted ? "La transcripción tardó demasiado. Reintenta una grabación corta o escribe tu consulta." : failure instanceof Error ? failure.message : "No se pudo transcribir. Puedes escribir tu consulta."); setPhase("error");
    } finally { clearTimeout(timeout); }
  }
  async function prepare() {
    if (review.ambiguous) return;
    const token = generation.current; const controller = new AbortController(); request.current = controller;
    setPreparing(true); setError(""); setProposal(null); setConfirmed(false);
    let next = voiceFallback(review.normalized);
    try {
      const response = await fetch("/api/search/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: review.normalized, scope: "search" }), signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json(); next = guardVoiceProposal(review.normalized, assistantProposalSchema.parse(result.proposal));
    } catch { if (!controller.signal.aborted) next.explanation = "La ayuda de IA no estuvo disponible. Revisa estos criterios preparados a partir de tu texto."; }
    if (generation.current === token && !controller.signal.aborted) {
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
          <p>Consultas cortas de hasta 45 segundos, en español. Pronuncia despacio los números, años y siglas.</p>
          <div className="voicePrivacy"><strong>Antes de grabar</strong><p>{config?.provider || "El proveedor indicado"} procesará el audio para transcribirlo. ACE no lo guarda en archivos, biblioteca ni historial. La grabación queda en memoria de esta ventana hasta que cierres o vuelvas a grabar; el servidor la procesa solo durante la petición.</p><p>Al preparar los criterios, el texto revisado se enviará al asistente de ACE{config?.assistantProvider ? ` (${config.assistantProvider === "gemini" ? "Google Gemini" : config.assistantProvider === "zai" ? "Z.ai" : "OpenAI"})` : ""}.</p>{config?.providerId === "gemini" ? <p>Google puede conservar registros para control de abuso durante 55 días; otros usos dependen del plan contratado. ACE no ha verificado el plazo total de tu plan. Evita datos personales o confidenciales.</p> : null}{config?.policyUrl ? <a href={config.policyUrl} target="_blank" rel="noreferrer">Consultar la conservación de datos de {config.provider}</a> : null}</div>
          <label className="voiceConsent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Entiendo quién procesará la grabación y el texto revisado.</label>
          <button className="primaryButton" type="button" onClick={() => void start()} disabled={!consent || !config?.available}><Mic size={18} /> Empezar a grabar</button>
          {config && !config.available ? <p role="status">La transcripción no está disponible. La búsqueda escrita sigue funcionando.</p> : !config ? <p role="status">Comprobando disponibilidad…</p> : null}
        </> : null}
        {phase === "permission" ? <p role="status">Acepta el permiso del navegador para empezar. Puedes cancelar sin grabar.</p> : null}
        {phase === "recording" ? <div className="voiceListening"><Mic size={28} /><strong role="status">Escuchando · {seconds} / 45 s</strong><p>Al detener, se enviará el audio para transcribir.</p><button className="primaryButton" type="button" onClick={() => recorder.current?.state === "recording" && recorder.current.stop()}><Square size={16} /> Detener y transcribir</button></div> : null}
        {phase === "processing" ? <p role="status"><LoaderCircle className="spin" size={18} /> Procesando la grabación…</p> : null}
        {phase === "review" ? <>
          <h3>Revisa lo que entendí</h3>
          {audioUrl ? <audio controls preload="metadata" src={audioUrl} aria-label="Escuchar tu grabación" /> : null}
          <label>Transcripción editable<textarea rows={3} maxLength={500} value={text} onChange={event => { request.current?.abort(); setPreparing(false); setText(event.target.value); setProposal(null); setConfirmed(false); }} /></label>
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
