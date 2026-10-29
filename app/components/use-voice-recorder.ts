"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_LIMITS, VOICE_MAX_BYTES, type VoicePurpose } from "@/lib/voice-search";
import { acquireVoiceStream, voiceCaptureError } from "@/lib/voice-capture";

// Captura y transcripción de voz compartidas por la búsqueda (`VoiceSearch`) y el dictado del chat
// (`VoiceDictation`). Antes vivían dentro de `VoiceSearch`; se extraen para que los dos usen el mismo motor
// y cada uno tenga solo su interfaz. Solo cambia por uso la duración máxima y el tope de texto.

const recordingTime = () => performance.now();
const CONSENT_KEY = "ace-voice-consent";

export type VoicePhase = "ready" | "permission" | "recording" | "processing" | "review" | "error";
export type VoiceConfig = { available: boolean; provider: string; providerId: string; policyUrl: string; assistantProvider: string };

const noConfig: VoiceConfig = { available: false, provider: "", providerId: "", policyUrl: "", assistantProvider: "" };

// Recordar el consentimiento solo en esta pestaña (sessionStorage, nunca localStorage): el dictado del chat se
// repite muchas veces por sesión y pedir la casilla cada vez lo vuelve inusable. Es una comodidad: la casilla
// sigue a la vista y marcada, y el aviso del proveedor se muestra siempre. Si el almacenamiento falla, se
// pregunta como siempre.
const readConsent = (providerId: string) => { try { return sessionStorage.getItem(`${CONSENT_KEY}:${providerId}`) === "1"; } catch { return false; } };
const writeConsent = (providerId: string, value: boolean) => { try { if (value) sessionStorage.setItem(`${CONSENT_KEY}:${providerId}`, "1"); else sessionStorage.removeItem(`${CONSENT_KEY}:${providerId}`); } catch { /* sin almacenamiento: se vuelve a preguntar */ } };

export function useVoiceRecorder({ purpose, open, rememberConsent = false }: { purpose: VoicePurpose; open: boolean; rememberConsent?: boolean }) {
  const limits = VOICE_LIMITS[purpose];
  const [phase, setPhase] = useState<VoicePhase>("ready");
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [error, setError] = useState("");
  const [consent, setConsentState] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [doubtful, setDoubtful] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const context = useRef<AudioContext | null>(null);

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
      if (!response.ok) throw new Error(); return response.json() as Promise<VoiceConfig>;
    }).then(data => {
      if (controller.signal.aborted) return;
      setConfig(data);
      if (rememberConsent && data.providerId && readConsent(data.providerId)) setConsentState(true);
    }).catch(failure => {
      if (failure.name !== "AbortError") { setConfig(noConfig); setError("No se pudo comprobar la transcripción. Puedes seguir escribiendo."); }
    });
    return () => controller.abort();
  }, [open, rememberConsent]);

  function setConsent(value: boolean) {
    setConsentState(value);
    if (rememberConsent && config?.providerId) writeConsent(config.providerId, value);
  }

  /** Vuelve al estado inicial al cerrar. El consentimiento recordado se vuelve a leer al reabrir. */
  const reset = useCallback(() => {
    release();
    setPhase("ready"); setText(""); setOriginal(""); setAudioUrl(""); setError(""); setConsentState(false); setConfig(null); setUncertain(false); setDoubtful(false); setSeconds(0);
  }, [release]);

  const transcribe = useCallback(async (audio: Blob, duration: number, type: string, token: number, providerId: string) => {
    setPhase("processing"); const controller = new AbortController(); request.current = controller;
    // Más audio tarda más en transcribirse: 35 s sobraban para 45 s de voz pero no para 2 minutos.
    const timeout = setTimeout(() => controller.abort(), purpose === "chat" ? 50_000 : 35_000);
    const data = new FormData();
    data.append("audio", audio, `consulta.${type === "audio/mp4" ? "mp4" : type === "audio/ogg" ? "ogg" : "webm"}`);
    data.append("durationMs", String(duration)); data.append("consent", "true"); data.append("provider", providerId); data.append("purpose", purpose);
    try {
      const response = await fetch("/api/search/voice", { method: "POST", body: data, signal: controller.signal });
      const result = await response.json().catch(() => ({ error: "No se pudo procesar la grabación. Reintenta o escribe tu texto." })); if (!response.ok || typeof result.text !== "string") throw new Error(result.error || "No se obtuvo una transcripción utilizable.");
      if (generation.current !== token) return;
      setText(result.text); setOriginal(result.text); setUncertain(Boolean(result.uncertain) || !result.qualityAssessed); setDoubtful(Boolean(result.uncertain)); setPhase("review");
    } catch (failure) {
      if (generation.current !== token) return;
      setError(controller.signal.aborted ? "La transcripción tardó demasiado. Reintenta una grabación más corta o escribe tu texto." : failure instanceof Error ? failure.message : "No se pudo transcribir. Puedes escribir tu texto."); setPhase("error");
    } finally { clearTimeout(timeout); }
  }, [purpose]);

  const start = useCallback(async () => {
    release(); const token = generation.current;
    setText(""); setOriginal(""); setAudioUrl(""); setError(""); setSeconds(0); setUncertain(false); setDoubtful(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setPhase("error"); setError("Este navegador no permite grabar aquí. Usa un navegador compatible o escribe tu texto."); return; }
    const providerId = config?.providerId || "";
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
        if (size > VOICE_MAX_BYTES) { release(); setPhase("error"); setError("La grabación es demasiado grande. Repite una más corta."); return; }
        if (event.data.size) chunks.current.push(event.data);
      };
      recording.onerror = () => { if (generation.current === token) { release(); setPhase("error"); setError("Se interrumpió el micrófono. Vuelve a grabar o escribe tu texto."); } };
      recording.onstop = () => {
        if (timer.current) clearInterval(timer.current); timer.current = null;
        acquired.getTracks().forEach(track => track.stop()); stream.current = null;
        void context.current?.close().catch(() => {}); context.current = null;
        if (generation.current !== token) return;
        const duration = Math.min(limits.maxMs, Math.round(recordingTime() - began));
        if (duration < 500 || (measured && heardVoice < 2) || !size) { chunks.current = []; setPhase("error"); setError("No se detectó voz suficiente. Acerca el micrófono y vuelve a grabar."); return; }
        const type = mime.split(";")[0];
        const audio = new Blob(chunks.current, { type }); chunks.current = [];
        objectUrl.current = URL.createObjectURL(audio); setAudioUrl(objectUrl.current);
        void transcribe(audio, duration, type, token, providerId);
      };
      recording.start(250); setPhase("recording");
      timer.current = setInterval(() => {
        if (generation.current !== token) return;
        const elapsed = recordingTime() - began; setSeconds(Math.min(limits.maxMs / 1000, Math.floor(elapsed / 1000)));
        if (analyser && context.current?.state === "running") {
          const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
          measured = true; if (rms > .012) heardVoice++;
        }
        if (elapsed >= limits.maxMs && recording.state === "recording") recording.stop();
      }, 200);
    } catch (failure) {
      if (generation.current !== token) return;
      release(); setPhase("error");
      setError(voiceCaptureError(failure, stage));
    }
  }, [release, config?.providerId, limits.maxMs, transcribe]);

  const stop = useCallback(() => { if (recorder.current?.state === "recording") recorder.current.stop(); }, []);

  return {
    phase, config, error, setError, consent, setConsent, seconds, maxSeconds: limits.maxMs / 1000, maxChars: limits.maxChars,
    text, setText, original, audioUrl, uncertain, doubtful, start, stop, reset, release, generation, request,
  };
}
