"use client";

import { Building2, ChevronDown, ChevronRight, FileSignature, Hash, Library, Loader2, Mic, MicOff, Settings, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../confirm-dialog";
import { BibliotecaSelector } from "./biblioteca-selector";
import type { AdjuntoResult, OficinaOption } from "@/lib/expedientes-archivo-actions";
import { DOC_TIPOS, type DocTipo } from "@/lib/expedientes-archivo-actions";
import { tipoDocumentoLabel } from "@/lib/document-number";
import { PLANTILLAS_RESPUESTA } from "@/lib/respuesta-plantillas";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_SPIN,
  expBtnClass,
  expMessageClass,
} from "../estilos";
import { cn } from "@/lib/utils";

type Props = {
  adjuntos: AdjuntoResult[];
  asunto: string;
  clearBorrador: () => void;
  cuerpo: string;
  destinoNumero: string;
  intencion: string;
  isAdminOficinas: boolean;
  length: "concisa" | "media" | "detallada";
  normativaIds: string[];
  oficina: OficinaOption | null;
  oficinaId: string;
  oficinas: OficinaOption[];
  onChangeOficina: (nextId: string) => { hasBody: boolean; previousId: string };
  remitenteDoc: string;
  setAdjuntos: (v: AdjuntoResult[]) => void;
  setIncludeAntecedentes: (v: boolean) => void;
  setIntencion: (v: string) => void;
  setLength: (v: "concisa" | "media" | "detallada") => void;
  setNormativaIds: (v: string[]) => void;
  setTipoDocumento: (v: DocTipo) => void;
  setTone: (v: "cercano" | "formal" | "tecnico") => void;
  setRemitenteDoc: (v: string) => void;
  setAsunto: (v: string) => void;
  includeAntecedentes: boolean;
  tipoDocumento: DocTipo;
  tone: "cercano" | "formal" | "tecnico";
  totalActivas: number;
  userEntity: string | null;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
  // Emitido a handleGenerate en el padre
  onGenerate: () => void;
  generating: boolean;
};

// Seccion 2: Tu respuesta - oficina + tipo + intencion + normativa + generar
export function ConfiguracionRespuesta({
  adjuntos,
  asunto,
  clearBorrador,
  cuerpo,
  destinoNumero,
  intencion,
  isAdminOficinas,
  length,
  normativaIds,
  oficina,
  oficinaId,
  oficinas,
  onChangeOficina,
  remitenteDoc,
  setAdjuntos,
  setIncludeAntecedentes,
  setIntencion,
  setLength,
  setNormativaIds,
  setTipoDocumento,
  setTone,
  setRemitenteDoc,
  setAsunto,
  includeAntecedentes,
  tipoDocumento,
  tone,
  totalActivas,
  userEntity,
  showToast,
  onGenerate,
  generating,
}: Props) {
  const [confirmCambioOficina, setConfirmCambioOficina] = useState<{
    onConfirm: () => void;
  } | null>(null);
  // Opciones avanzadas (normativa, tono, extension, archivo) plegadas por
  // defecto: el usuario no tecnico genera sin tocarlas.
  const [mostrarApoyos, setMostrarApoyos] = useState(false);

  // Tipos que emite la oficina seleccionada (Configuracion → Numeracion).
  const tiposDisponibles: readonly DocTipo[] =
    oficina && oficina.tipos.length > 0 ? oficina.tipos : DOC_TIPOS;

  // Si el tipo seleccionado no lo emite esta oficina, saltar al primero valido.
  useEffect(() => {
    if (!tiposDisponibles.includes(tipoDocumento)) {
      setTipoDocumento(tiposDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oficinaId, tiposDisponibles.join("|")]);

  // Si hay borrador, se confirma ANTES de aplicar el cambio: asi "cancelar"
  // de verdad no cambia nada (antes la oficina ya habia cambiado).
  function handleSelectOficina(nextId: string) {
    if (nextId === oficinaId) return;
    if (cuerpo.trim()) {
      setConfirmCambioOficina({
        onConfirm: () => {
          onChangeOficina(nextId);
          clearBorrador();
          showToast("Oficina cambiada y borrador limpiado.", "info");
          setConfirmCambioOficina(null);
        },
      });
      return;
    }
    onChangeOficina(nextId);
  }

  return (
    <div className={cn("tw", EXP_FORM_SECTION, "mt-4")}>
      <div className={EXP_FORM_SECTION_HEADER}>
        <h3 className={EXP_FORM_SECTION_TITLE}>
          <FileSignature size={16} /> Tu respuesta
          <span className={EXP_FORM_SECTION_HINT}>
            Oficina emisora, tipo y que quieres responder
          </span>
        </h3>
      </div>

      {oficinas.length === 0 ? (
        <div className={cn(expMessageClass("info"), "mb-3 mt-0")} role="status">
          <Building2 size={16} />
          {isAdminOficinas ? (
            <span>
              No hay oficinas activas. Crea la primera en{" "}
              <strong>Configuracion → Oficinas y numeracion → Areas</strong>.
            </span>
          ) : (
            <span>
              No tienes una oficina asignada. Tu entidad es{" "}
              <strong>{userEntity ?? "(sin entidad)"}</strong>. Pidele al
              administrador que cree la oficina con esa entidad o que te vincule.
              {totalActivas > 0
                ? ` Hay ${totalActivas} oficina(s) activa(s) en el sistema.`
                : ""}
            </span>
          )}
        </div>
      ) : isAdminOficinas && totalActivas > oficinas.length ? (
        <div className={cn(expMessageClass("info"), "mb-3 mt-0")} role="status">
          <Building2 size={16} />
          <span>
            Eres administrador: ves <strong>{oficinas.length}</strong> oficina(s)
            de tu entidad. Hay <strong>{totalActivas}</strong> activas en total.
          </span>
        </div>
      ) : null}

      <Grupo
        titulo="¿Quién emite el documento?"
        hint="Oficina, tipo de documento y número que le tocará"
      >
      <div className="grid grid-cols-3 gap-3">
        <div className={EXP_FIELD}>
          <label className={cn(EXP_FIELD_LABEL, "flex items-center gap-1.5")} htmlFor="resp-oficina">
            <Building2 size={12} /> Oficina emisora
          </label>
          <select
            id="resp-oficina"
            className={EXP_FIELD_CONTROL}
            value={oficinaId}
            onChange={(e) => handleSelectOficina(e.target.value)}
          >
            {oficinas.length === 0 ? <option value="">— Sin oficinas —</option> : null}
            {oficinas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL} htmlFor="resp-tipo">Tipo de documento</label>
          <select
            id="resp-tipo"
            className={EXP_FIELD_CONTROL}
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as DocTipo)}
          >
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>
                {tipoDocumentoLabel(t)}
              </option>
            ))}
          </select>
          <small className="text-[11px] text-exp-muted">
            Solo los tipos que emite esta oficina (Configuración → Numeración).
          </small>
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL}>Nº a asignar</label>
          <input
            className={EXP_FIELD_CONTROL}
            value={destinoNumero || "Configura la numeracion (admin)"}
            readOnly
          />
          <small className="text-[11px] font-medium text-exp-brand">
            {destinoNumero ? `Preview: ${destinoNumero}` : "Configura en Configuracion → Numeracion"}
          </small>
        </div>
      </div>

      {oficina ? (
        <>
          <span className={cn(EXP_HELP_TEXT, "mt-1")}>
            Responsable: <strong>{oficina.responsableNombre || "—"}</strong>
            {oficina.responsableCargo ? ` · ${oficina.responsableCargo}` : ""}
            {oficina.tieneMembrete ? " · ✓ hoja membretada" : " · sin hoja membretada"}
            {" "}(no se imprime: el documento queda con espacio para firma y sello)
          </span>
          {!oficina.tieneMembrete || !destinoNumero ? (
            <div className={cn(expMessageClass("warning"), "mb-0 mt-1.5")} role="status">
              <Settings size={14} />
              <span>
                {!oficina.tieneMembrete && !destinoNumero
                  ? "Esta oficina no tiene hoja membretada ni numeración configurada. El PDF saldrá en blanco y el Nº será genérico."
                  : !oficina.tieneMembrete
                    ? "Esta oficina no tiene hoja membretada. El PDF saldrá sin membrete."
                    : "Esta oficina no tiene numeración configurada. El Nº del documento será genérico."}
                {" "}Configúralo en <strong>Configuración → Oficinas y numeración</strong>.
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      </Grupo>

      <Grupo
        titulo="¿Qué vas a responder?"
        hint="Elige un caso típico o cuéntale a la IA con tus palabras"
      >
      {/* Plantillas de casos frecuentes: 1 clic pre-llena la intencion */}
      <div className={cn(EXP_FIELD, "mt-2")}>
        <label className={EXP_FIELD_LABEL} htmlFor="resp-plantilla">
          Caso frecuente <span className="font-normal text-exp-muted">(opcional, pre-llena lo demás)</span>
        </label>
        <select
          id="resp-plantilla"
          className={EXP_FIELD_CONTROL}
          value=""
          onChange={(e) => {
            const p = PLANTILLAS_RESPUESTA.find((x) => x.id === e.target.value);
            if (!p) return;
            setIntencion(p.intencion);
            if (tiposDisponibles.includes(p.tipoSugerido)) {
              setTipoDocumento(p.tipoSugerido);
            }
            showToast(
              "Plantilla aplicada: completa los datos entre [CORCHETES] y genera.",
              "info",
            );
          }}
        >
          <option value="">— Elegir un caso típico… —</option>
          {PLANTILLAS_RESPUESTA.map((p) => (
            <option key={p.id} value={p.id} title={p.descripcion}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(EXP_FIELD, "mt-2")}>
        <label className={cn(EXP_FIELD_LABEL, "flex items-center gap-2")} htmlFor="resp-intencion">
          ¿Que quieres responder?
          <DictadoButton
            onTexto={(t) => setIntencion(intencion ? `${intencion.trim()} ${t}` : t)}
            showToast={showToast}
          />
        </label>
        <textarea
          id="resp-intencion"
          className={EXP_FIELD_CONTROL}
          value={intencion}
          onChange={(e) => setIntencion(e.target.value)}
          rows={5}
          placeholder="Ej. Comunicar que la solicitud de licencia procede, otorgar plazo de 5 dias para subsanar, etc. La IA lo convierte en el cuerpo formal. También puedes dictarlo con el micrófono."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL} htmlFor="resp-rem">Dirigido a</label>
          <input
            id="resp-rem"
            className={EXP_FIELD_CONTROL}
            value={remitenteDoc}
            onChange={(e) => setRemitenteDoc(e.target.value)}
            placeholder="Destinatario de la respuesta"
          />
        </div>
        <div className={EXP_FIELD}>
          <label className={EXP_FIELD_LABEL} htmlFor="resp-asunto">Asunto</label>
          <input
            id="resp-asunto"
            className={EXP_FIELD_CONTROL}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Sumilla"
          />
        </div>
      </div>
      </Grupo>

      {/* Opciones avanzadas plegadas: normativa de apoyo, estilo y archivo.
          El usuario no técnico puede generar sin abrirlas nunca. */}
      <div className="mt-3 overflow-hidden rounded-exp border border-exp-line">
        <button
          type="button"
          onClick={() => setMostrarApoyos((v) => !v)}
          aria-expanded={mostrarApoyos}
          className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2.5 text-left text-[13px] font-semibold text-inherit"
        >
          {mostrarApoyos ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          Normativa de apoyo y estilo
          <span className="text-xs font-normal text-exp-muted">
            (opcional) —{" "}
            {[
              normativaIds.length > 0 ? `${normativaIds.length} norma(s)` : null,
              adjuntos.length > 0 ? `${adjuntos.length} adjunto(s)` : null,
              includeAntecedentes ? "con expedientes del archivo" : null,
              tone !== "formal" ? `tono ${tone}` : null,
              length !== "media" ? `extensión ${length}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "por defecto: normativa automática, tono formal"}
          </span>
        </button>

        {mostrarApoyos ? (
          <div className="px-3 pb-3">
            <BibliotecaSelector
              normativaIds={normativaIds}
              adjuntosIds={adjuntos.map((a) => a.documentId)}
              onChange={setNormativaIds}
              onAdjuntosChange={setAdjuntos}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL} htmlFor="resp-tone">Tono</label>
                <select
                  id="resp-tone"
                  className={EXP_FIELD_CONTROL}
                  value={tone}
                  onChange={(e) => setTone(e.target.value as "cercano" | "formal" | "tecnico")}
                >
                  <option value="formal">Formal e institucional</option>
                  <option value="cercano">Cercano y didactico</option>
                  <option value="tecnico">Tecnico-juridico</option>
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL} htmlFor="resp-length">Extension</label>
                <select
                  id="resp-length"
                  className={EXP_FIELD_CONTROL}
                  value={length}
                  onChange={(e) => setLength(e.target.value as "concisa" | "media" | "detallada")}
                >
                  <option value="concisa">Concisa</option>
                  <option value="media">Media</option>
                  <option value="detallada">Detallada</option>
                </select>
              </div>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] leading-snug text-exp-muted [&_strong]:text-exp-ink">
              <input
                type="checkbox"
                checked={includeAntecedentes}
                onChange={(e) => setIncludeAntecedentes(e.target.checked)}
                className="mt-0.5 accent-exp-brand"
              />
              <span>
                <Library size={13} /> Buscar además <strong>expedientes relacionados</strong> en la
                biblioteca del archivo (pestaña Subir). El antecedente principal siempre es el PDF
                que cargaste arriba.
              </span>
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={cn(expBtnClass("primary"), "mt-3")}
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? <Loader2 size={16} className={EXP_SPIN} /> : <Sparkles size={16} />}{" "}
        {generating ? "Generando cuerpo..." : "Generar cuerpo del documento"}
      </button>
      <span className={EXP_HELP_TEXT}>
        <Hash size={12} /> La IA redacta el cuerpo a partir de tu intencion, fundamentado en normativa
        {includeAntecedentes ? " y antecedentes" : ""}.
      </span>

      {confirmCambioOficina ? (
        <ConfirmDialog
          open={true}
          title="¿Cambiar la oficina emisora?"
          message="El borrador actual fue generado para esta oficina. Al cambiar de oficina se limpiara el borrador y el correlativo se reiniciara. ¿Quieres continuar?"
          tone="warning"
          confirmLabel="Cambiar y limpiar"
          cancelLabel="Quedarme en esta oficina"
          onConfirm={confirmCambioOficina.onConfirm}
          onCancel={() => setConfirmCambioOficina(null)}
        />
      ) : null}
    </div>
  );
}

// ── Grupo visual de campos con titulo en lenguaje llano ─────────────────
function Grupo({
  titulo,
  hint,
  children,
}: {
  titulo: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-exp border border-exp-line px-3 pb-3 pt-2.5">
      <div className="mb-2">
        <strong className="text-[13px]">{titulo}</strong>
        {hint ? (
          <span className="ml-2 text-xs text-exp-muted">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ── Dictado por voz (Web Speech API, es-PE) ─────────────────────────────
// Las secretarias dictan más rápido de lo que tipean. Si el navegador no
// soporta reconocimiento de voz, el botón no se muestra.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function DictadoButton({
  onTexto,
  showToast,
}: {
  onTexto: (texto: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const Ctor = getSpeechRecognition();
  if (!Ctor) return null;

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function start() {
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = "es-PE";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i]?.[0]?.transcript?.trim();
          if (transcript) onTexto(transcript);
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed") {
          showToast("Permite el acceso al micrófono para dictar.", "warning");
        }
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      showToast("Dictado activo: habla y tu texto aparecerá abajo.", "info");
    } catch {
      setListening(false);
      showToast("No se pudo iniciar el dictado en este navegador.", "warning");
    }
  }

  return (
    <button
      type="button"
      // `!` porque la sobrescritura vive en el call site, por encima de
      // expBtnClass("secondary") — ver el mismo comentario en borrador-editor.tsx.
      className={cn(
        expBtnClass("secondary", "small"),
        listening && "!border-[#fecaca] !bg-exp-danger-soft !text-[#991b1b]",
      )}
      onClick={() => (listening ? stop() : start())}
      title={listening ? "Detener dictado" : "Dictar con el micrófono"}
      aria-pressed={listening}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
      {listening ? "Detener" : "Dictar"}
    </button>
  );
}
