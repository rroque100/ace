"use client";

import { memo, useMemo, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { SeccionBadge } from "./ficha-progreso";
import { markdownAHtmlSeguro } from "@/lib/markdown-seguro";
import { desdeMatrizRiesgos } from "@/lib/matriz-riesgos";
import { objectTypeLabel } from "@/lib/legal-taxonomy";
import { tipoAreaLabel } from "@/lib/necesidad-workflow";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import type { ObjetoFilter } from "@/lib/procesos-seleccion";
import type { Necesidad } from "@/lib/necesidades";

/**
 * La ficha en modo LECTURA: lo guardado, sin controles.
 *
 * Es la otra mitad de `sec-ficha`. La mitad editable no se puede separar todavia
 * —depende de sesenta y tres cosas del componente padre—, pero esta solo lee la
 * necesidad, y plegar una seccion es asunto suyo: se lleva `collapsedSections`.
 *
 * `panelObligatorios` llega ya pintado porque el mismo panel lo usan las dos
 * vistas y vive en el padre. Al ser un nodo cambia en cada render, asi que la
 * memoizacion no muerde todavia; se deja puesta porque cuando la mitad editable
 * salga y ese nodo se estabilice, el corte ya estara hecho.
 */
export const FichaLectura = memo(function FichaLectura({
  camposDeIA,
  necesidad,
  panelObligatorios,
  tipoObj,
}: {
  /** api del campo -> fecha ISO en que se traslado desde la propuesta IA. */
  camposDeIA: ReadonlyMap<string, string>;
  necesidad: Necesidad;
  /** El panel de campos obligatorios, ya pintado por el padre. */
  panelObligatorios: React.ReactNode;
  /** Objeto contractual, para decidir que secciones y campos aplican. */
  tipoObj: ObjetoFilter | null | undefined;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  return (
      <div className="flex flex-col">
        <Row label="Nombre" value={necesidad.nombre} />
        <Row label="Tipo de objeto" value={necesidad.tipo_objeto ? objectTypeLabel(necesidad.tipo_objeto) : null} />
        <Row label="Tipo de área" value={tipoAreaLabel(necesidad.tipo_area)} />
        {panelObligatorios}
        <div className="mt-3 flex flex-col gap-2.5">
          {FICHA_SECCIONES.filter(
            (s) => !s.mostrarPara || !tipoObj || s.mostrarPara.includes(tipoObj),
          ).map((section) => {
            // En la vista previa no se oculta nada que tenga dato guardado:
            // se muestran los campos que aplican al objeto MÁS los que ya
            // tienen valor (p. ej. cargados por importación o IA).
            const campos = section.fields.filter((f) => {
              if (f.oculto) return false;
              if (!f.mostrarPara || !tipoObj || f.mostrarPara.includes(tipoObj)) return true;
              const v = necesidad[f.col];
              return v !== null && v !== undefined && String(v).trim() !== "";
            });
            const filled = campos.filter((f) => {
              const v = necesidad[f.col];
              return v !== null && v !== undefined && String(v).trim() !== "";
            }).length;
            const complete = filled > 0 && filled >= campos.length;
            const isCollapsed = collapsedSections.has(section.title);
            return (
              <div className="overflow-hidden rounded-[12px] border border-line" key={section.title}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 bg-surface px-3.5 py-2.5 text-left text-[13px] font-bold text-ink transition hover:bg-brand-soft/50"
                  onClick={() => {
                    const next = new Set(collapsedSections);
                    if (next.has(section.title)) next.delete(section.title);
                    else next.add(section.title);
                    setCollapsedSections(next);
                  }}
                >
                  {isCollapsed ? <ChevronDown size={14} className="text-muted" /> : <FileText size={14} className="text-brand" />}
                  {section.title}
                  <SeccionBadge
                    className="ml-auto"
                    estado={complete ? "completo" : filled > 0 ? "parcial" : "vacio"}
                    texto={`${filled}/${campos.length}`}
                  />
                </button>
                {!isCollapsed ? (
                  <div className="px-3.5 py-1">
                    {(() => {
                      // Subtítulo del subgrupo (literal legal) una vez por
                      // grupo, antes de su primer campo del grupo.
                      let prevSub: string | undefined;
                      const out: React.ReactNode[] = [];
                      for (const f of campos) {
                        if (f.subgrupo && f.subgrupo !== prevSub) {
                          out.push(
                            <div className="mt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted" key={`sub-${f.subgrupo}`}>
                              {f.subgrupo}
                            </div>,
                          );
                        }
                        prevSub = f.subgrupo;
                        const v = necesidad[f.col];
                        // Valor crudo: Row formatea booleanos como Sí/No y
                        // los vacíos como "—".
                        out.push(
                          <Row
                            deIA={camposDeIA.get(f.api)}
                            key={f.api}
                            label={f.label}
                            renderAsMarkdown={f.api === "gestionRiesgos"}
                            value={typeof v === "boolean" || typeof v === "number" ? v : (v as string | null)}
                          />,
                        );
                      }
                      return out;
                    })()}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Row label="Resumen" value={necesidad.summary} />
      </div>
  );
});

function Row({
  label,
  value,
  deIA,
  renderAsMarkdown,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  /** Fecha ISO del traslado si el valor vino de la propuesta IA. */
  deIA?: string;
  /** Renderiza el valor como Markdown (negritas, tablas, viñetas). */
  renderAsMarkdown?: boolean;
}) {
  const display = (() => {
    if (typeof value === "boolean") {
      return value ? "✅ Sí" : "❌ No";
    }
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
    return "—";
  })();
  const htmlContent = useMemo(() => {
    if (!renderAsMarkdown || display === "—") return null;
    // `renderAsMarkdown` hoy solo lo marca la matriz de riesgos: se muestra desde
    // el encabezado «MATRIZ DE GESTIÓN DE RIESGOS», sin el sustento previo (igual
    // que la vista previa de edición). Para otro contenido sin ese encabezado,
    // `desdeMatrizRiesgos` devuelve el texto entero, así que es inocuo.
    return markdownAHtmlSeguro(desdeMatrizRiesgos(display));
  }, [renderAsMarkdown, display]);
  return (
    <div className="grid grid-cols-[minmax(140px,34%)_1fr] items-start gap-3 border-b border-line/70 py-2 last:border-b-0">
      <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-muted">
        {label}
        {deIA ? (
          <span
            className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-bold text-accent"
            title={`Propuesto por la IA desde el EETT/TDR y aprobado en el traslado el ${new Date(deIA).toLocaleString("es-PE")}. Revísalo antes de firmar.`}
          >
            ✦ IA
          </span>
        ) : null}
      </span>
      {htmlContent ? (
        <div
          className="max-w-none text-[13.5px] leading-relaxed text-ink [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-line [&_th]:border [&_th]:border-line [&_th]:bg-panel [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-[12.5px] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h1]:text-[15px] [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:mb-1.5 [&_em]:italic"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <span className="text-[13.5px] leading-relaxed text-ink">{display}</span>
      )}
    </div>
  );
}
