"use client";

import { memo } from "react";
import { RefreshCw, Download, Replace, Trash2, FileText, MapPin } from "lucide-react";
import type { TablaExpedientesProps } from "./types";
import {
  EXP_EMPTY,
  EXP_EMPTY_DESC,
  EXP_EMPTY_ICON,
  EXP_EMPTY_TITLE,
  EXP_ICON_BUTTON,
  EXP_ICON_BUTTON_DANGER,
  EXP_LIST_ITEM_ACTIONS,
  EXP_SPIN,
  EXP_TABLE,
  EXP_TABLE_TBODY,
  EXP_TABLE_TD,
  EXP_TABLE_TH,
  EXP_TABLE_THEAD,
  EXP_TABLE_WRAP,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={expStatusClass(status)} data-status={status}>
      {label}
    </span>
  );
}

// Componente a nivel de módulo (no dentro del render) para no resetear estado
// en cada render — react-hooks/static-components.
function SortBtn({
  col,
  children,
  sortBy,
  sortDir,
  onSort,
}: {
  col: string;
  children: React.ReactNode;
  sortBy: string;
  sortDir: string;
  onSort: (col: string) => void;
}) {
  const arrow = sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    // Sin tipografía propia a propósito: hereda font/color del <th> padre
    // (reset .tw button { font: inherit; color: inherit } en tailwind.css),
    // igual que hacía `.expTableSortBtn` heredando de `.expTable th`.
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 border-0 bg-transparent p-0 transition-colors duration-[120ms] ease-linear hover:text-exp-ink",
        sortBy === col && "text-exp-brand",
      )}
      onClick={() => onSort(col)}
    >
      {children}
      {arrow}
    </button>
  );
}

export const TablaExpedientes = memo(function TablaExpedientes({
  exps,
  canManage,
  selectedIds,
  onToggle,
  onSelectAll,
  onOpen,
  onDelete,
  onDownload,
  onReplace,
  sortBy,
  sortDir,
  onSort,
  reindexingId,
  deletingId,
  reindex,
  formatBytes,
  statusLabel,
}: TablaExpedientesProps) {
  return (
    <div className={cn("tw", EXP_TABLE_WRAP)}>
      <table className={EXP_TABLE}>
        <thead className={EXP_TABLE_THEAD}>
          <tr>
            {canManage ? (
              <th className={cn(EXP_TABLE_TH, "w-9")}>
                <input
                  type="checkbox"
                  checked={exps.length > 0 && exps.every((e) => selectedIds.has(e.id))}
                  onChange={onSelectAll}
                  aria-label="Seleccionar todos"
                />
              </th>
            ) : null}
            <th className={EXP_TABLE_TH}>
              <SortBtn col="title" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Título
              </SortBtn>
            </th>
            <th className={EXP_TABLE_TH}>
              <SortBtn col="anio" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Año
              </SortBtn>
            </th>
            <th className={EXP_TABLE_TH}>Ubicación</th>
            <th className={EXP_TABLE_TH}>
              <SortBtn col="file_size" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Tamaño
              </SortBtn>
            </th>
            <th className={EXP_TABLE_TH}>
              <SortBtn col="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                Estado
              </SortBtn>
            </th>
            {canManage ? <th className={cn(EXP_TABLE_TH, "w-[140px]")}>Acciones</th> : null}
          </tr>
        </thead>
        <tbody className={EXP_TABLE_TBODY}>
          {exps.map((exp) => (
            <tr
              key={exp.id}
              className={cn(
                "transition-colors duration-[120ms] ease-linear",
                selectedIds.has(exp.id) ? "bg-exp-brand-soft hover:bg-exp-brand-soft" : "hover:bg-exp-line-soft",
              )}
            >
              {canManage ? (
                <td className={EXP_TABLE_TD}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(exp.id)}
                    onChange={() => onToggle(exp.id)}
                    aria-label={`Seleccionar ${exp.title}`}
                  />
                </td>
              ) : null}
              <td className={EXP_TABLE_TD}>
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 text-left text-[13px] font-bold text-exp-ink transition-colors duration-[120ms] ease-linear hover:text-exp-brand"
                  onClick={() => onOpen(exp)}
                >
                  {exp.title}
                </button>
                <div className="mt-0.5 text-[11px] text-exp-muted">
                  {exp.anio ? `${exp.anio}` : ""}
                  {exp.oficina ? ` · ${exp.oficina}` : ""}
                </div>
              </td>
              <td className={EXP_TABLE_TD}>{exp.anio ?? "—"}</td>
              <td className={EXP_TABLE_TD}>
                <span className="inline-flex items-center font-mono text-xs text-exp-warning [&>svg]:mr-1">
                  <MapPin size={11} />
                  {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </span>
              </td>
              <td className={EXP_TABLE_TD}>{formatBytes(exp.file_size)}</td>
              <td className={EXP_TABLE_TD}>
                <StatusBadge status={exp.status} label={statusLabel(exp.status)} />
              </td>
              {canManage ? (
                <td className={EXP_TABLE_TD}>
                  <div className={EXP_LIST_ITEM_ACTIONS} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => void reindex(exp.id)}
                      disabled={reindexingId === exp.id}
                      className={EXP_ICON_BUTTON}
                      title="Reindexar"
                      aria-label="Reindexar"
                    >
                      <RefreshCw
                        size={14}
                        className={reindexingId === exp.id ? EXP_SPIN : ""}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(exp)}
                      className={EXP_ICON_BUTTON}
                      title="Descargar"
                      aria-label="Descargar"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReplace(exp)}
                      className={EXP_ICON_BUTTON}
                      title="Reemplazar PDF"
                      aria-label="Reemplazar PDF"
                    >
                      <Replace size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(exp)}
                      disabled={reindexingId === exp.id || deletingId === exp.id}
                      className={cn(EXP_ICON_BUTTON, EXP_ICON_BUTTON_DANGER)}
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {exps.length === 0 ? (
        <div className={cn(EXP_EMPTY, "rounded-none border-0")}>
          <div className={EXP_EMPTY_ICON}>
            <FileText size={24} />
          </div>
          <h3 className={EXP_EMPTY_TITLE}>Sin resultados</h3>
          <p className={EXP_EMPTY_DESC}>
            No hay expedientes que coincidan con los filtros aplicados.
          </p>
        </div>
      ) : null}
    </div>
  );
});
