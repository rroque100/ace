"use client";

import { CheckCircle2, ClipboardCheck, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

// Panel de traslado de la propuesta IA a la ficha de necesidad.
//
// Vive aparte del modal por dos razones: el modal ya era largo, y este panel es
// la pieza donde se decide qué se escribe en la ficha —conviene poder mirarla y
// probarla sola—.
//
// Regla que sostiene todo el diseño: NADA se traslada sin visto bueno explícito
// de la sección. El traslado PISA lo que el área usuaria redactó, así que la
// aprobación es del usuario, no del modelo.

export type CampoTraslado = {
  api: string;
  label: string;
  /** Valor propuesto, extraído literalmente de la propuesta. */
  valor: string;
  /** Valor que la ficha tiene hoy (vacío si no tiene). */
  actual: string;
  /** true si trasladar reemplazaría un valor ya escrito. */
  pisa: boolean;
};

export type GrupoTraslado = { seccion: string; campos: CampoTraslado[] };

/**
 * Primer número que aparece en un texto, o undefined si no hay ninguno.
 *
 * La extracción devuelve TODO como texto, pero `cantidad` y `plazoEjecucion` son
 * columnas numéricas y su schema las rechaza con "expected number, received
 * string". Se toma el PRIMER grupo de dígitos y no todos: la IA suele devolver
 * el número limpio, pero ante un "Treinta (30) días calendario" concatenar
 * dígitos daría un valor inventado.
 */
export function numeroDesdeTexto(valor: string): number | undefined {
  const m = valor.match(/-?\d[\d.,]*/);
  if (!m) return undefined;
  // Separador de miles fuera; el decimal se conserva.
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// Insignia "reemplaza"/"reemplaza contenido": mismo par de clases en la
// cabecera de sección y en cada campo, solo cambia el texto.
const BADGE_REEMPLAZA = "rounded-full bg-warning/14 px-1.5 py-px text-[10.5px] font-semibold text-warning";

export function TrasladoPanel({
  grupos,
  seccionesOk,
  camposExcluidos,
  aprobados,
  trasladando,
  onToggleSeccion,
  onToggleCampo,
  onTrasladar,
  onDescartar,
}: {
  grupos: GrupoTraslado[];
  seccionesOk: Set<string>;
  camposExcluidos: Set<string>;
  /** Nº de campos que se trasladarían con la selección actual. */
  aprobados: number;
  trasladando: boolean;
  onToggleSeccion: (seccion: string) => void;
  onToggleCampo: (api: string) => void;
  onTrasladar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div className="tw mb-[18px]">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold">
        <ClipboardCheck className="text-accent" size={15} /> Traslado a la ficha · da el visto bueno por sección
      </div>
      <p className="mb-2.5 text-[12px] text-muted">
        Nada se escribe hasta que apruebes la sección. Los campos marcados{" "}
        <strong className="text-warning">reemplazan</strong> lo que ya hay en la ficha.
      </p>

      {grupos.map((grupo) => {
        const aprobada = seccionesOk.has(grupo.seccion);
        const pisaAlguno = grupo.campos.some((c) => c.pisa);
        return (
          <div
            className={cn(
              "mb-2.5 overflow-hidden rounded-lg border",
              aprobada ? "border-success/40 bg-success/6" : "border-muted/18 bg-panel",
            )}
            key={grupo.seccion}
          >
            <label className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[12.5px] font-bold">
              <input checked={aprobada} onChange={() => onToggleSeccion(grupo.seccion)} type="checkbox" />
              <span className="flex-1">{grupo.seccion}</span>
              {pisaAlguno ? <span className={BADGE_REEMPLAZA}>reemplaza contenido</span> : null}
              <span className="font-normal text-muted">
                {grupo.campos.length} campo{grupo.campos.length === 1 ? "" : "s"}
              </span>
            </label>

            {/* Los campos solo se detallan cuando la sección está aprobada: en
                una propuesta completa son ~25 y, todos abiertos a la vez, el
                panel deja de leerse. Plegado, el usuario recorre secciones. */}
            {aprobada
              ? grupo.campos.map((c) => {
                  const excluido = camposExcluidos.has(c.api);
                  return (
                    <div
                      className={cn(
                        "border-t border-muted/12 py-1.5 pl-[30px] pr-2.5",
                        excluido ? "opacity-50" : "opacity-100",
                      )}
                      key={c.api}
                    >
                      <label className="flex cursor-pointer items-center gap-1.5 text-[12px]">
                        <input checked={!excluido} onChange={() => onToggleCampo(c.api)} type="checkbox" />
                        <strong>{c.label}</strong>
                        {c.pisa ? (
                          <span className={BADGE_REEMPLAZA}>reemplaza</span>
                        ) : (
                          <span className="text-[10.5px] text-muted">vacío en la ficha</span>
                        )}
                      </label>
                      {c.pisa ? (
                        <p className="mb-0.5 mt-1 text-[11.5px] text-muted line-through">
                          {c.actual.slice(0, 180)}
                          {c.actual.length > 180 ? "…" : ""}
                        </p>
                      ) : null}
                      <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.45]">
                        {c.valor.slice(0, 400)}
                        {c.valor.length > 400 ? "…" : ""}
                      </p>
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button className="primaryButton compactButton" disabled={trasladando || aprobados === 0} onClick={onTrasladar} type="button">
          {trasladando ? <Loader size={14} /> : <CheckCircle2 size={14} />} Trasladar {aprobados} campo
          {aprobados === 1 ? "" : "s"}
        </button>
        <button className="secondaryButton compactButton" onClick={onDescartar} type="button">
          Descartar
        </button>
        {aprobados === 0 ? (
          <span className="text-[11.5px] text-muted">Aprueba al menos una sección para trasladar.</span>
        ) : null}
      </div>
    </div>
  );
}
