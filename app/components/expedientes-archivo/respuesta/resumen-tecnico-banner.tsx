"use client";

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Scale,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { AnalisisTecnico } from "@/lib/expedientes-archivo-actions";
import { EXP_ICON_BUTTON } from "../estilos";
import { cn } from "@/lib/utils";

type Props = {
  analisis: AnalisisTecnico | null;
  onDismiss?: () => void;
};

// Banner principal del resumen tecnico del PDF.
// Se muestra PROMINENTE en la parte superior de la pestana Responder.
// El objetivo es que el usuario tenga claro de que se trata el documento
// que subio, sin tener que hacer scroll ni buscar.
export function ResumenTecnicoBanner({ analisis, onDismiss }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (!analisis) return null;

  // Si el analisis no tiene contenido util, no mostrar nada.
  const hasContent = Boolean(
    analisis.materia || analisis.puntosClave || analisis.tipoDocumento,
  );
  if (!hasContent) return null;

  return (
    <section
      role="region"
      aria-label="Resumen tecnico del documento PDF"
      className="tw mb-4 rounded-[10px] border border-[#7dd3fc] border-l-4 border-l-[#0ea5e9] bg-[linear-gradient(180deg,#f0f9ff_0%,#e0f2fe_100%)] p-3.5 shadow-[0_1px_2px_rgba(14,165,233,0.05)]"
    >
      {/* Cabecera: tipo + materia + boton colapsar */}
      <div className={cn("flex items-start gap-2.5", collapsed ? "mb-0" : "mb-3")}>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0ea5e9] text-white">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[#0c4a6e]">
            Resumen tecnico del PDF
          </div>
          {analisis.tipoDocumento ? (
            <div className="mb-0.5 text-[15px] font-bold leading-[1.3] text-[#0c4a6e]">
              {analisis.tipoDocumento}
            </div>
          ) : null}
          {analisis.materia ? (
            <div className="text-[13px] leading-snug text-exp-ink">{analisis.materia}</div>
          ) : null}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={EXP_ICON_BUTTON}
            aria-label={collapsed ? "Expandir resumen" : "Colapsar resumen"}
            title={collapsed ? "Expandir resumen" : "Colapsar resumen"}
          >
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className={EXP_ICON_BUTTON}
              aria-label="Cerrar resumen"
              title="Cerrar resumen"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="grid grid-cols-2 gap-2.5 text-xs leading-relaxed text-exp-ink">
          {analisis.partes ? (
            <ResumenItem icon={<FileText size={13} />} label="Partes" value={analisis.partes} />
          ) : null}
          {analisis.normativaIdentificada ? (
            <ResumenItem
              icon={<Scale size={13} />}
              label="Normativa que aplica"
              value={analisis.normativaIdentificada}
            />
          ) : null}
        </div>
      ) : null}

      {!collapsed && analisis.puntosClave ? (
        <div className="mt-2.5 rounded-lg border border-[#bae6fd] bg-white p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.3px] text-[#0c4a6e]">
            <CheckCircle2 size={13} /> Puntos clave a responder
          </div>
          <div className="whitespace-pre-wrap text-[13px] leading-[1.55] text-exp-ink">
            {analisis.puntosClave}
          </div>
        </div>
      ) : null}

      {!collapsed &&
      analisis.consultasSugeridas &&
      analisis.consultasSugeridas.length > 0 ? (
        <div className="mt-2.5 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.3px] text-[#92400e]">
            <Lightbulb size={13} /> Consultas sugeridas para la biblioteca
          </div>
          <ul className="m-0 pl-[18px] text-xs leading-relaxed text-[#78350f]">
            {analisis.consultasSugeridas.map((q, i) => (
              <li key={i} className="mb-0.5">
                {q}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[#fef3c7] px-2 py-1.5 text-[11px] text-[#92400e]">
            <AlertCircle size={12} className="shrink-0" />
            <span>
              Pega estas consultas en la <strong>Biblioteca de normativa</strong>{" "}
              (boton “Biblioteca” abajo). Si no aparece, puedes activar la
              busqueda en internet en la generacion.
            </span>
          </div>
        </div>
      ) : null}

      {!collapsed && analisis.tipoRespuestaEsperada ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5 text-[11px] text-[#0c4a6e]">
          <span className="font-semibold">Tipo de respuesta sugerido:</span>
          <span className="rounded bg-[#0ea5e9] px-2 py-0.5 font-bold text-white">
            {analisis.tipoRespuestaEsperada}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function ResumenItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.3px] text-[#0c4a6e]">
        {icon}
        {label}
      </div>
      <div className="text-exp-ink">{value}</div>
    </div>
  );
}
