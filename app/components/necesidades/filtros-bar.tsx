"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import type { DefinicionFiltro } from "../barra-filtros";
import { Select } from "../ui";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros de la lista de Necesidades (versión Tailwind del patrón
 * compartido `BarraFiltros`, pero cohesiva con la nueva UI del módulo). Reutiliza
 * el tipo `DefinicionFiltro` para no duplicar el contrato. Es "tonta": no sabe de
 * qué se filtra, solo pinta y devuelve lo elegido.
 */

function etiquetaDelValor(f: DefinicionFiltro): string {
  return f.opciones.find((o) => o.value === f.valor)?.label ?? f.valor;
}

export function FiltrosBar({
  busqueda,
  onBusqueda,
  placeholderBusqueda,
  filtros,
  resultados,
  inputRef,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  placeholderBusqueda: string;
  filtros: DefinicionFiltro[];
  resultados?: { total: number; hayMas: boolean; sustantivo: [string, string] };
  /** Para enfocar el buscador desde fuera (atajo «/»). */
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const activos = filtros.filter((f) => f.valor);
  const hayFiltros = activos.length > 0 || busqueda.trim().length > 0;

  const limpiarTodo = () => {
    onBusqueda("");
    for (const f of filtros) f.onChange("");
  };

  return (
    <div className="rounded-[14px] border border-line bg-panel p-3 shadow-card">
      {/* Buscador */}
      <div className="group relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted" aria-hidden />
        <input
          ref={inputRef}
          aria-label={placeholderBusqueda}
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder={placeholderBusqueda}
          className={cn(
            "h-11 w-full rounded-[10px] border border-line bg-surface pl-10 pr-10 text-sm text-ink outline-none",
            "transition-[border-color,box-shadow] duration-150",
            "placeholder:text-muted/70 focus:border-brand focus:bg-panel focus:shadow-[var(--shadow-focus)]",
          )}
        />
        {busqueda ? (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            onClick={() => onBusqueda("")}
            className="absolute right-2.5 grid size-7 place-items-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Desplegables: rejilla responsiva 3 → 2 → 1 */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtros.map((f) => (
          <Select
            key={f.id}
            aria-label={f.placeholder}
            value={f.valor}
            onChange={(e) => f.onChange(e.target.value)}
            className={cn("h-10 text-[13px]", f.valor && "border-brand/50 bg-brand-soft font-semibold text-brand")}
          >
            <option value="">{f.placeholder}</option>
            {f.valor && !f.opciones.some((o) => o.value === f.valor) ? (
              <option value={f.valor}>{f.valor}</option>
            ) : null}
            {f.opciones.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.total === undefined ? "" : ` (${o.total})`}
              </option>
            ))}
          </Select>
        ))}
      </div>

      {/* Filtros activos + limpiar */}
      {hayFiltros ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 pr-1 text-[12px] font-semibold text-muted">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filtrando por
          </span>
          {busqueda.trim() ? (
            <ChipActivo etiqueta="Búsqueda" valor={busqueda.trim()} onClear={() => onBusqueda("")} />
          ) : null}
          {activos.map((f) => (
            <ChipActivo key={f.id} etiqueta={f.etiqueta} valor={etiquetaDelValor(f)} onClear={() => f.onChange("")} />
          ))}
          <button
            type="button"
            onClick={limpiarTodo}
            className="ml-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted underline-offset-2 hover:text-danger hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      ) : null}

      {resultados ? (
        <p className="mt-2.5 text-[12px] text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {resultados.total}
            {resultados.hayMas ? "+" : ""}
          </span>{" "}
          {resultados.total === 1 ? resultados.sustantivo[0] : resultados.sustantivo[1]}
          {hayFiltros ? " con los filtros aplicados" : ""}
        </p>
      ) : null}
    </div>
  );
}

function ChipActivo({ etiqueta, valor, onClear }: { etiqueta: string; valor: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      title={`Quitar el filtro de ${etiqueta.toLowerCase()}`}
      className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft py-1 pl-2.5 pr-2 text-[12px] font-medium text-brand transition hover:border-brand/50"
    >
      <span className="font-semibold">{etiqueta}:</span>
      <span className="truncate">{valor}</span>
      <X className="size-3 shrink-0 opacity-70" aria-hidden />
    </button>
  );
}
