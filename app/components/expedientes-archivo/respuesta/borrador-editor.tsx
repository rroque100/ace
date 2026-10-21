"use client";

import { BookOpen, FileSignature, Info, Loader2, Save, Sparkles, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { enviarFeedbackRespuesta } from "@/lib/expedientes-archivo-actions";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_SPIN,
  expBtnClass,
} from "../estilos";
import { cn } from "@/lib/utils";

type Props = {
  antecedentes: Array<{ anio: number | null; excerpt: string; expedienteId: string; serie: string | null; title: string; ubicacion: string }>;
  baseLegal: Array<{ referencia: string; texto: string }>;
  cuerpo: string;
  genUsage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  // Contexto para la evaluacion del borrador (feedback por oficina).
  intencion: string;
  oficinaId: string;
  refining: boolean;
  savingRespuesta: boolean;
  setBaseLegal: (v: Array<{ referencia: string; texto: string }>) => void;
  setCuerpo: (v: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
  tipoDocumento: string;
  onRefine: (instruccion: string) => Promise<void>;
  onSave: () => void;
};

// Ajustes de un clic sobre el borrador (refinamiento conversacional).
const AJUSTES_RAPIDOS: Array<{ label: string; instruccion: string }> = [
  { label: "Mejorar redacción", instruccion: "Mejora la redacción: fluidez, conectores, precisión y elegancia institucional, conservando el contenido, los datos y las citas legales." },
  { label: "Más corto", instruccion: "Haz el documento más corto y directo, conservando los datos y citas legales." },
  { label: "Más formal", instruccion: "Eleva la formalidad del lenguaje al registro institucional protocolar." },
  { label: "Lenguaje sencillo", instruccion: "Simplifica el lenguaje para que un ciudadano sin formación legal lo entienda, sin perder precisión." },
  { label: "Más detallado", instruccion: "Amplía el desarrollo con más detalle y fundamentación, sin inventar hechos ni normas nuevas." },
];

// Seccion 3: Borrador - cuerpo editable + ajustes con IA + base legal + antecedentes
export function BorradorEditor({
  antecedentes,
  baseLegal,
  cuerpo,
  genUsage,
  intencion,
  oficinaId,
  refining,
  savingRespuesta,
  setCuerpo,
  showToast,
  tipoDocumento,
  onRefine,
  onSave,
}: Props) {
  const total = genUsage?.inputTokens ?? 0;
  const cost = genUsage?.estimatedCostUsd ?? 0;
  const [instruccion, setInstruccion] = useState("");
  // Evaluacion del borrador: like/dislike que alimenta al generador de la oficina.
  const [rated, setRated] = useState<"like" | "dislike" | null>(null);
  const [sendingRating, setSendingRating] = useState(false);
  const [askComment, setAskComment] = useState(false);
  const [comentario, setComentario] = useState("");

  async function applyCustom() {
    const t = instruccion.trim();
    if (t.length < 3) {
      showToast("Escribe el cambio que quieres, ej. «agrega un párrafo sobre el plazo».", "warning");
      return;
    }
    await onRefine(t);
    setInstruccion("");
  }

  async function sendFeedback(rating: "like" | "dislike", comment?: string) {
    setSendingRating(true);
    try {
      await enviarFeedbackRespuesta({
        oficinaId: oficinaId || undefined,
        tipoDocumento,
        rating,
        comentario: comment?.trim() || undefined,
        cuerpo,
        intencion: intencion.trim() || undefined,
      });
      setRated(rating);
      setAskComment(false);
      setComentario("");
      showToast(
        rating === "like"
          ? "Gracias: este borrador servirá de ejemplo para futuros documentos de tu oficina."
          : "Gracias: la observación se usará para mejorar la redacción de tu oficina.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar la evaluación", "error");
    } finally {
      setSendingRating(false);
    }
  }

  return (
    <div className={cn("tw", EXP_FORM_SECTION, "mt-4")}>
      <div className={EXP_FORM_SECTION_HEADER}>
        <h3 className={EXP_FORM_SECTION_TITLE}>
          <FileSignature size={16} /> Borrador
          <span className={EXP_FORM_SECTION_HINT}>Edita antes de guardar</span>
        </h3>
        {genUsage ? (
          <span className={cn(EXP_HELP_TEXT, "mt-0")} title="Tokens de IA consumidos">
            <Sparkles size={12} /> {total.toLocaleString("es-PE")} tokens
            {cost > 0 ? ` · ~$${cost.toFixed(4)}` : ""}
          </span>
        ) : null}
      </div>

      <div className={EXP_FIELD}>
        <textarea
          className={EXP_FIELD_CONTROL}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={14}
          placeholder="Aqui aparecera el cuerpo generado por la IA. Podras editarlo antes de guardar."
        />
        <small className="mt-0.5 block text-[11px] text-exp-muted">
          {cuerpo.length.toLocaleString("es-PE")} caracteres.
        </small>
      </div>

      {/* Ajustes con IA: aplica SOLO el cambio pedido, sin regenerar de cero.
          Mismo lenguaje visual que el preview de extraccion (Subir) y la
          respuesta de la IA (Buscar): barra superior en degradado, icono
          en insignia con pulso — es el otro momento en que la IA trabaja
          por ti dentro de este modulo. */}
      {cuerpo.trim() ? (
        <div className="relative mb-3 flex flex-col gap-2 overflow-hidden rounded-exp border border-exp-brand/30 bg-[linear-gradient(135deg,var(--color-exp-brand-soft)_0%,var(--color-exp-panel)_65%)] p-2.5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--color-exp-brand)_0%,#5eead4_50%,var(--color-exp-brand)_100%)] before:content-['']">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-exp-brand text-white">
              <Wand2 size={12} className="animate-exp-pulse" />
            </span>
            Ajustar con IA
            <span className="font-normal text-exp-muted">
              — cambia solo lo que pidas, sin rehacer el resto
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {AJUSTES_RAPIDOS.map((a) => (
              <button
                key={a.label}
                type="button"
                className={expBtnClass("ghost", "small")}
                disabled={refining}
                onClick={() => void onRefine(a.instruccion)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              className={cn(EXP_FIELD_CONTROL, "flex-1")}
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !refining) void applyCustom();
              }}
              placeholder="Pide un cambio… ej. «agrega un párrafo indicando el plazo de 5 días»"
              disabled={refining}
            />
            <button
              type="button"
              className={expBtnClass("ghost")}
              onClick={() => void applyCustom()}
              disabled={refining}
            >
              {refining ? <Loader2 size={15} className={EXP_SPIN} /> : <Sparkles size={15} />}{" "}
              {refining ? "Aplicando…" : "Aplicar"}
            </button>
          </div>

          {/* Evaluacion del borrador: alimenta la redaccion futura de la oficina */}
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-exp-line pt-2">
            <span className="text-xs text-exp-muted">
              ¿La redacción está bien? Tu evaluación enseña a la IA de tu oficina:
            </span>
            {/* `!` (important) porque la sobrescritura vive en el call site, por
                encima de expBtnClass("ghost") — no hay una lista base local
                donde separar "activo" de "inactivo" en ramas mutuamente
                excluyentes. Sin el `!`, Tailwind v4 podría generar el
                border/bg transparente del ghost DESPUÉS del color de estado
                (orden de descubrimiento, no fijo) y ganarle la cascada. */}
            <button
              type="button"
              className={cn(
                expBtnClass("ghost", "small"),
                rated === "like" && "!border-exp-success !bg-exp-success-soft !text-[#065f46]",
              )}
              disabled={sendingRating || rated === "like"}
              onClick={() => void sendFeedback("like")}
              title="Marcar como redacción correcta (servirá de ejemplo)"
            >
              <ThumbsUp size={13} /> {rated === "like" ? "Marcada correcta" : "Correcta"}
            </button>
            <button
              type="button"
              className={cn(
                expBtnClass("ghost", "small"),
                rated === "dislike" && "!border-exp-danger !bg-exp-danger-soft !text-[#991b1b]",
              )}
              disabled={sendingRating || rated === "dislike"}
              onClick={() => setAskComment((v) => !v)}
              title="Marcar como redacción incorrecta e indicar qué mejorar"
            >
              <ThumbsDown size={13} /> {rated === "dislike" ? "Marcada incorrecta" : "Incorrecta"}
            </button>
            {sendingRating ? <Loader2 size={14} className={EXP_SPIN} /> : null}
          </div>
          {askComment && rated !== "dislike" ? (
            <div className="flex gap-1.5">
              <input
                className={cn(EXP_FIELD_CONTROL, "flex-1")}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sendingRating) void sendFeedback("dislike", comentario);
                }}
                placeholder="¿Qué estuvo mal? ej. «demasiado extenso», «no cita la norma correcta»…"
                disabled={sendingRating}
              />
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={() => void sendFeedback("dislike", comentario)}
                disabled={sendingRating}
              >
                Enviar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {baseLegal.length > 0 ? (
        <div className={EXP_FIELD}>
          <SectionHeader
            icon={<BookOpen size={14} />}
            title={`Base legal consultada (${baseLegal.length})`}
          />
          <div className="mb-2 flex items-start gap-1.5 rounded-md border border-[#bae6fd] bg-[#f0f9ff] px-2.5 py-1.5 text-[11px] text-[#0c4a6e]">
            <Info size={13} className="mt-px shrink-0" />
            <span>
              Esta base legal se uso para redactar el cuerpo.{" "}
              <strong>No aparecera en el documento descargado</strong>.
            </span>
          </div>
          <ul className="m-0 pl-[18px] text-sm text-exp-muted">
            {baseLegal.map((s, i) => (
              <li key={i} className="mb-1">
                <strong>{s.referencia}</strong>: {s.texto}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {antecedentes.length > 0 ? (
        <div className={EXP_FIELD}>
          <SectionHeader
            icon={<BookOpen size={14} />}
            title="Expedientes relacionados de la biblioteca (búsqueda opcional)"
          />
          <ul className="m-0 pl-[18px] text-sm text-exp-muted">
            {antecedentes.map((a) => (
              <li key={a.expedienteId} className="mb-1">
                <strong>{a.title}</strong>
                {a.serie ? ` (${a.serie})` : ""}
                {a.anio ? `, ${a.anio}` : ""} · {a.ubicacion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(expBtnClass("primary"), "mt-3")}
        onClick={onSave}
        disabled={savingRespuesta}
      >
        {savingRespuesta ? <Loader2 size={16} className={EXP_SPIN} /> : <Save size={16} />}{" "}
        {savingRespuesta ? "Guardando..." : "Guardar y numerar"}
      </button>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-exp-brand">{icon}</span>
      <strong className="text-[13px]">{title}</strong>
    </div>
  );
}
