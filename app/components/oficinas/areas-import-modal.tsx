"use client";

import { FileSpreadsheet, FileUp, Loader2 } from "lucide-react";
import { ModalShell } from "../modal-shell";
import { btnPrimary as btnPri, btnSecondary as btnSec } from "../configuracion/ui";

// ── Tipos compartidos ──────────────────────────────────────────────────────

export type PreviewRow = {
  _row: number;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  activo: boolean;
};

export type PreviewError = { row: number; error: string };

export type DryRunResponse = {
  dryRun: true;
  preview: PreviewRow[];
  errors: PreviewError[];
  total: number;
  mode: string;
  detectedFormat?: "siaf" | "simple";
  cachedEntidad?: string | null;
  cachedRuc?: string | null;
};

export type ImportResponse = {
  ok: boolean;
  mode: string;
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    errors: PreviewError[];
  };
};

export type ImportState =
  | { kind: "idle" }
  | { kind: "loading-preview"; fileName: string }
  | { kind: "preview"; fileName: string; mode: "merge" | "replace"; data: DryRunResponse }
  | { kind: "importing"; fileName: string; mode: "merge" | "replace" }
  | { kind: "done"; data: ImportResponse }
  | { kind: "error"; message: string };

// ── Componentes ────────────────────────────────────────────────────────────

export function ImportModal({
  state,
  onClose,
  onConfirm,
  onChangeMode,
}: {
  state: ImportState;
  onClose: () => void;
  onConfirm: () => void;
  onChangeMode: (mode: "merge" | "replace") => void;
}) {
  // Escape, foco atrapado y bloqueo de scroll los aporta ModalShell (Radix).
  return (
    <ModalShell
      acciones={
        state.kind === "preview" ? (
          <>
            <button type="button" className={btnSec} onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className={btnPri} onClick={onConfirm}>
              <FileUp size={14} /> Confirmar importación
            </button>
          </>
        ) : state.kind === "done" || state.kind === "error" ? (
          <button type="button" className={btnPri} onClick={onClose}>
            Cerrar
          </button>
        ) : null
      }
      claseTarjeta="importOficinasModal"
      onClose={onClose}
      titulo={
        <>
          <FileSpreadsheet size={18} /> Carga masiva de oficinas
        </>
      }
    >
        {state.kind === "loading-preview" ? (
          <p className="text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Analizando{" "}
            <strong>{state.fileName}</strong>…
          </p>
        ) : null}

        {state.kind === "error" ? (
          <div className="flex items-center gap-2 rounded-[var(--radio-sm)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2.5 text-sm leading-snug text-[color-mix(in_srgb,var(--danger)_85%,var(--ink))]" role="alert">
            <strong>Error:</strong> {state.message}
          </div>
        ) : null}

        {state.kind === "preview" ? <PreviewView state={state} onChangeMode={onChangeMode} /> : null}

        {state.kind === "importing" ? (
          <p className="text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Importando oficinas de{" "}
            <strong>{state.fileName}</strong>…
          </p>
        ) : null}

        {state.kind === "done" ? (
          <div className="flex items-center gap-2 rounded-[var(--radio-sm)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-success-soft px-3 py-2.5 text-sm leading-snug text-[color-mix(in_srgb,var(--success)_80%,var(--ink))]">
            <strong>Importación completa.</strong> Creadas: {state.data.summary.created}{" "}
            · Actualizadas: {state.data.summary.updated} · Con error:{" "}
            {state.data.summary.failed}
          </div>
        ) : null}
    </ModalShell>
  );
}

function PreviewView({
  state,
  onChangeMode,
}: {
  state: { kind: "preview"; fileName: string; mode: "merge" | "replace"; data: DryRunResponse };
  onChangeMode: (mode: "merge" | "replace") => void;
}) {
  const { data, mode, fileName } = state;
  const ok = data.preview;
  const errs = data.errors;
  return (
    <div>
      <p className="m-0 text-sm text-muted">
        <strong>{fileName}</strong>: {data.total} fila{data.total === 1 ? "" : "s"} válida
        {data.total === 1 ? "" : "s"}
        {errs.length > 0 ? ` · ${errs.length} con error` : ""}
        {data.detectedFormat ? (
          <>
            {" · "}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                data.detectedFormat === "siaf"
                  ? "bg-brand-soft text-brand-dark"
                  : "bg-success-soft text-success"
              }`}
            >
              Formato {data.detectedFormat === "siaf" ? "SIAF/MEF" : "simple"}
            </span>
          </>
        ) : null}
      </p>

      {data.detectedFormat === "siaf" && (data.cachedEntidad || data.cachedRuc) ? (
        <div className="mb-3 rounded-sm bg-brand-soft px-2 py-2 text-xs text-brand-dark">
          <strong>Entidad detectada (de la fila tipo 1):</strong>{" "}
          {data.cachedEntidad ?? "—"}
          {data.cachedRuc ? ` · RUC ${data.cachedRuc}` : ""}
        </div>
      ) : null}

      <fieldset className="mb-3 rounded-md border border-line p-3">
        <legend className="px-1.5 text-xs font-semibold">
          Modo de importación
        </legend>
        <label className="mb-1.5 block text-sm">
          <input
            type="radio"
            name="importMode"
            checked={mode === "merge"}
            onChange={() => onChangeMode("merge")}
          />{" "}
          <strong>Fusionar (merge)</strong> — Crea nuevas oficinas y actualiza las
          existentes (mismo nombre).
        </label>
        <label className="block text-sm">
          <input
            type="radio"
            name="importMode"
            checked={mode === "replace"}
            onChange={() => onChangeMode("replace")}
          />{" "}
          <strong>Reemplazar (replace)</strong> — Elimina TODAS las oficinas actuales y
          carga las del archivo.
        </label>
      </fieldset>

      {errs.length > 0 ? (
        <div className="mb-3 rounded-sm bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-2.5 py-2 text-sm text-[color-mix(in_srgb,var(--accent)_88%,var(--ink))]">
          <strong>{errs.length} fila(s) con error (se omitirán al importar):</strong>
          <ul className="m-1.5 mt-1.5 pl-[18px]">
            {errs.slice(0, 8).map((e) => (
              <li key={e.row}>
                Fila {e.row}: {e.error}
              </li>
            ))}
            {errs.length > 8 ? <li>…y {errs.length - 8} más</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="max-h-80 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 bg-[var(--bg,#f8fafc)]">
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold w-6"></th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">#</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Nombre</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Entidad</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">RUC</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Responsable</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Cargo</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Sufijo</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Ancho</th>
              <th className="border-b border-line px-2.5 py-2 text-left font-semibold">Activo</th>
            </tr>
          </thead>
          <tbody>
            {ok.map((r) => {
              const errorFila = errs.find(e => e.row === r._row);
              return (
                  <tr key={r._row} className={`${errorFila ? 'bg-red-50' : r._row % 2 === 0 ? 'bg-muted/20' : ''} border-t border-line`}>
                    {errorFila ? (
                      <td className="py-2 px-2 w-6">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold"
                          title={errorFila.error}
                        >!</span>
                      </td>
                    ) : (
                      <td className="py-2 px-2 w-6"></td>
                    )}
                    <td className="px-2.5 py-2 align-top">{r._row}</td>
                    <td className="px-2.5 py-2 align-top">
                      <strong>{r.nombre}</strong>
                    </td>
                    <td className="px-2.5 py-2 align-top">{r.entidad ?? "—"}</td>
                    <td className="px-2.5 py-2 align-top">{r.ruc ?? "—"}</td>
                    <td className="px-2.5 py-2 align-top">{r.responsable_nombre ?? "—"}</td>
                    <td className="px-2.5 py-2 align-top">{r.responsable_cargo ?? "—"}</td>
                    <td className="px-2.5 py-2 align-top">{r.sufijo ?? "—"}</td>
                    <td className="px-2.5 py-2 align-top">{r.ancho}</td>
                    <td className="px-2.5 py-2 align-top">{r.activo ? "Sí" : "No"}</td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
