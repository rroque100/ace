"use client";

import "./voice-search.css";
import { useRef, useState } from "react";
import { Mic, Square, LoaderCircle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { reviewVoiceText } from "@/lib/voice-search";
import { useVoiceRecorder } from "./use-voice-recorder";

// Dictado para el chat: voz → texto revisable → se INSERTA en la caja, nunca se envía solo. La revisión es
// la barrera contra una cifra mal entendida (un «artículo 113.1» o un año equivocados darían una respuesta que
// cita la norma errónea con apariencia de autoridad), así que quien dicta siempre ve y puede corregir el texto
// antes de pulsar «Enviar». Comparte captura y transcripción con la búsqueda por voz (use-voice-recorder).

export function VoiceDictation({ onInsert, onAfterInsert, disabled = false, compact = false, maxChars: room, insertLabel = "Insertar en la pregunta", title = "Dictar la pregunta", description = "Habla, revisa el texto y se añadirá a tu pregunta. No se envía hasta que tú lo decidas." }: {
  onInsert: (text: string) => void;
  /** Se llama cuando el diálogo ya se cerró tras insertar: ahí se puede devolver el foco a la caja. */
  onAfterInsert?: () => void;
  /** Botón pequeño para ponerlo junto al nombre de un campo, en vez del botón grande del compositor. */
  compact?: boolean;
  /** Caracteres que aún caben en el destino. Si lo dictado no cabe, no se inserta (no se recorta en silencio). */
  maxChars?: number;
  insertLabel?: string;
  disabled?: boolean;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const voice = useVoiceRecorder({ purpose: "chat", open, rememberConsent: true });
  const { phase, config, error, consent, setConsent, seconds, maxSeconds, maxChars, text, setText, original, audioUrl, doubtful } = voice;
  const review = reviewVoiceText(text);
  const normalized = review.normalized.trim();
  const full = room !== undefined && room < 3;
  const tooLong = room !== undefined && normalized.length > room;
  const usable = text.trim().length >= 3 && !tooLong;
  const inserted = useRef(false);

  function close() { voice.reset(); setOpen(false); }
  function insert() {
    if (!usable) return;
    onInsert(normalized);
    inserted.current = true;
    close();
  }

  return <Dialog open={open} onOpenChange={value => value ? setOpen(true) : close()}>
    <DialogTrigger asChild><button type="button" className={compact ? "secondaryButton voiceDictationInline" : "secondaryButton voiceSearchTrigger"} aria-label={title} title={full ? "El campo está lleno" : title} disabled={disabled || full}><Mic size={compact ? 16 : 20} aria-hidden="true" /><span>Dictar</span></button></DialogTrigger>
    <DialogContent title={title} description={description} size="lg" onCloseAutoFocus={event => { if (!inserted.current) return; inserted.current = false; event.preventDefault(); onAfterInsert?.(); }}>
      <div className="voiceSearchBody">
        <ol className="voiceSearchSteps" aria-label="Pasos del dictado"><li>Hablar</li><li>Revisar</li><li>Insertar</li></ol>
        {(phase === "ready" || phase === "error") ? <>
          <p>Hasta {maxSeconds / 60} minutos, en español. Pronuncia despacio los números, años y siglas, y revisa el texto antes de insertarlo.</p>
          <div className="voicePrivacy"><strong>Antes de grabar</strong><p>{config?.provider || "El proveedor indicado"} procesará el audio para transcribirlo. ACE no lo guarda en archivos, biblioteca ni historial. La grabación queda en memoria de esta ventana hasta que cierres o vuelvas a grabar; el servidor la procesa solo durante la petición.</p>{config?.providerId.startsWith("gemini") ? <p>Google puede conservar registros para control de abuso durante 55 días; otros usos dependen del plan contratado. ACE no ha verificado el plazo total de tu plan. Evita datos personales o confidenciales: lo que dictes sobre un caso también viaja en el audio.</p> : null}{config?.fallbackProvider ? <p>Si Gemini agota su crédito o cuota, ACE enviará esta solicitud a través de OpenCode. Consulta sus condiciones de tratamiento y conservación del audio antes de continuar. <a href={config.fallbackPolicyUrl} target="_blank" rel="noreferrer">Política de OpenCode</a></p> : null}{config?.policyUrl ? <a href={config.policyUrl} target="_blank" rel="noreferrer">Consultar la conservación de datos de {config.provider}</a> : null}</div>
          <label className="voiceConsent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Entiendo quién procesará la grabación. Se recordará en esta pestaña hasta que la cierres.</label>
          <button className="primaryButton" type="button" onClick={() => void voice.start()} disabled={!consent || !config?.available}><Mic size={18} /> Empezar a grabar</button>
          {config && !config.available ? <p role="status">El dictado no está disponible. Puedes escribir tu pregunta.</p> : !config ? <p role="status">Comprobando disponibilidad…</p> : null}
        </> : null}
        {phase === "permission" ? <p role="status">Acepta el permiso del navegador para empezar. Puedes cancelar sin grabar.</p> : null}
        {phase === "recording" ? <div className="voiceListening"><Mic size={28} /><strong role="status">Escuchando · {seconds} / {maxSeconds} s</strong><p>Al detener, se enviará el audio para transcribir.</p><button className="primaryButton" type="button" onClick={voice.stop}><Square size={16} /> Detener y transcribir</button></div> : null}
        {phase === "processing" ? <p role="status"><LoaderCircle className="spin" size={18} /> Procesando la grabación…</p> : null}
        {phase === "review" ? <>
          <h3>Revisa lo que entendí</h3>
          {audioUrl ? <audio controls preload="metadata" src={audioUrl} aria-label="Escuchar tu grabación" /> : null}
          <label>Texto dictado<textarea rows={5} maxLength={maxChars} value={text} onChange={event => setText(event.target.value)} /></label>
          {text !== original ? <details><summary>Transcripción recibida</summary><p>{original}</p></details> : null}
          <p className="voiceReviewNote">Comprueba los números, años, artículos y siglas: de ellos depende qué norma se cita en la respuesta.</p>
          {doubtful ? <p className="voiceReviewNote">El reconocimiento marcó dudas en esta grabación. Escúchala y corrige el texto si hace falta.</p> : null}
          {review.normalized !== text ? <p className="voiceInterpretation"><strong>Se insertará con esta interpretación:</strong> {review.normalized}</p> : null}
          {review.references.length ? <p><strong>Números y siglas para confirmar:</strong> {review.references.join(" · ")}</p> : null}
          {review.warnings.map(warning => <p className="voiceReviewNote" key={warning}>{warning}</p>)}
          {tooLong ? <p className="voiceReviewNote">Lo dictado ocupa {normalized.length} caracteres y en este campo caben {room}. Acórtalo para poder insertarlo.</p> : null}
          <button className="primaryButton" type="button" disabled={!usable} onClick={insert}>{insertLabel}</button>
          <button className="secondaryButton" type="button" onClick={() => void voice.start()}><RotateCcw size={17} /> Volver a grabar</button>
        </> : null}
        {error ? <p role="alert" className="voiceReviewNote">{error}</p> : null}
        <button className="secondaryButton" type="button" onClick={close}>{phase === "ready" ? "Volver a escribir" : "Cancelar"}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
