"use client";

import {
  Building2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Hash,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Oficina } from "./use-oficinas";
import {
  type DryRunResponse,
  type ImportResponse,
  type ImportState,
  ImportModal,
} from "./areas-import-modal";
import { useYear } from "@/lib/year-context";
import { useToastHelpers } from "@/lib/toast";
import { EmptyState } from "../configuracion/empty-state";
import { SaveStatus, type SaveStatusType } from "../configuracion/save-status";
import {
  btnPrimary as btnPri,
  btnSecondary as btnSec,
  inputBase,
  norm,
} from "../configuracion/ui";

const API = "/api/configuracion/oficinas";

export function AreasTab({
  oficinas,
  setOficinas,
  aplicarDelServidor,
  busyId,
  setBusyId,
  error,
  setError,
  reload,
}: {
  oficinas: Oficina[];
  setOficinas: (v: Oficina[]) => void;
  aplicarDelServidor: (v: Oficina[]) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  error: string | null;
  setError: (v: string | null) => void;
  reload: () => Promise<void>;
}) {
  const { yearParam } = useYear();
  const { success: toastOk, error: toastErr } = useToastHelpers();
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>('idle');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      total: oficinas.length,
      activas: oficinas.filter((o) => o.activo).length,
      inactivas: oficinas.filter((o) => !o.activo).length,
      contrataciones: oficinas.filter((o) => o.gestiona_contrataciones).length,
    }),
    [oficinas],
  );

  const visibles = useMemo(() => {
    const q = norm(query.trim());
    return oficinas.filter((o) => {
      if (!showInactive && !o.activo) return false;
      if (!q) return true;
      return norm(o.nombre).includes(q) || norm(o.entidad).includes(q);
    });
  }, [oficinas, query, showInactive]);

  const [drafts, setDrafts] = useState<Oficina[]>([]);
  const isDraft = (id: string) => id.startsWith("draft:");

  function patch(id: string, p: Partial<Oficina>) {
    if (isDraft(id)) {
      setDrafts((ds) => ds.map((o) => (o.id === id ? { ...o, ...p } : o)));
    } else {
      setOficinas(oficinas.map((o) => (o.id === id ? { ...o, ...p } : o)));
    }
  }

  function addOficina() {
    const draft: Oficina = {
      id: `draft:${crypto.randomUUID()}`,
      nombre: "",
      entidad: null,
      ruc: null,
      responsable_nombre: null,
      responsable_cargo: null,
      sufijo: null,
      ancho: 3,
      activo: true,
      membrete: false,
      gestiona_contrataciones: false,
      counters: [],
    };
    setDrafts((ds) => [draft, ...ds]);
    setQuery("");
    setShowInactive(false);
  }

  async function saveOficina(o: Oficina) {
    if (isDraft(o.id)) {
      if (!o.nombre.trim()) {
        setError("El nombre de la oficina es obligatorio.");
        return;
      }
      setSaveStatus('saving');
      setBusyId(o.id);
      setError(null);
      try {
        const res = await fetch(`${API}?${yearParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: o.nombre.trim(), entidad: o.entidad, activo: o.activo }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        aplicarDelServidor(data.oficinas ?? []);
        setDrafts((ds) => ds.filter((d) => d.id !== o.id));
        toastOk("Oficina creada", o.nombre.trim());
        setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo crear";
        setError(msg);
        toastErr("No se pudo crear la oficina", msg);
        setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 5000);
      } finally {
        setBusyId(null);
      }
      return;
    }

    setSaveStatus('saving');
    setBusyId(o.id);
    setError(null);
    try {
      const res = await fetch(`${API}?${yearParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: o.id,
          nombre: o.nombre,
          entidad: o.entidad,
          responsable_nombre: o.responsable_nombre,
          responsable_cargo: o.responsable_cargo,
          ancho: o.ancho,
          activo: o.activo,
          gestiona_contrataciones: o.gestiona_contrataciones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      aplicarDelServidor(data.oficinas ?? []);
      toastOk("Oficina guardada", o.nombre.trim() || undefined);
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      setError(msg);
      toastErr("No se pudo guardar la oficina", msg);
      setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOficina(id: string) {
    if (isDraft(id)) {
      setDrafts((ds) => ds.filter((d) => d.id !== id));
      setConfirmDeleteId(null);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${API}?id=${id}&${yearParam}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      aplicarDelServidor(data.oficinas ?? []);
      toastOk("Oficina eliminada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo eliminar";
      setError(msg);
      toastErr("No se pudo eliminar la oficina", msg);
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  async function onImportFile(file: File, mode: "merge" | "replace") {
    setImportState({ kind: "loading-preview", fileName: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("dryRun", "true");
      const res = await fetch(`${API}/import?${yearParam}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar el archivo");
      setImportState({
        kind: "preview",
        fileName: file.name,
        mode,
        data: data as DryRunResponse,
      });
    } catch (e) {
      setImportState({
        kind: "error",
        message: e instanceof Error ? e.message : "No se pudo leer el archivo",
      });
    }
  }

  async function confirmImport() {
    if (importState.kind !== "preview") return;
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setImportState({ kind: "error", message: "Vuelve a seleccionar el archivo" });
      return;
    }
    setImportState({ kind: "importing", fileName: file.name, mode: importState.mode });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", importState.mode);
      const res = await fetch(`${API}/import?${yearParam}`, { method: "POST", body: fd });
      const data = (await res.json()) as ImportResponse & { error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al importar");
      setImportState({ kind: "done", data });
      await reload();
    } catch (e) {
      setImportState({
        kind: "error",
        message: e instanceof Error ? e.message : "No se pudo importar",
      });
    }
  }

  function closeImportModal() {
    setImportState({ kind: "idle" });
    if (importFileRef.current) importFileRef.current.value = "";
  }

  const renderRow = (o: Oficina) => {
    const draft = isDraft(o.id);
    const expanded = draft || expandedId === o.id;
    const numeracion = o.counters.filter((c) => c.enabled).length;
    return (
      <div
        key={o.id}
        className={`overflow-hidden rounded-lg border bg-white ${draft ? "border-[color-mix(in_srgb,var(--brand)_45%,var(--line))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_20%,transparent)]" : "border-line"} ${o.activo ? "" : "opacity-72"}`}
        data-expanded={expanded}
      >
        <button
          type="button"
          className={`flex w-full items-center gap-3 border-0 bg-transparent px-3.5 py-2.5 text-left font-inherit ${draft ? "cursor-default" : "cursor-pointer hover:bg-[#f8fafc]"}`}
          aria-expanded={expanded}
          onClick={() => {
            if (!draft) setExpandedId((cur) => (cur === o.id ? null : o.id));
          }}
        >
          <span className={`grid w-[34px] h-[34px] shrink-0 place-items-center rounded-md ${o.activo ? "bg-[#eef2f7] text-slate-600" : "bg-[#f1f4f7] text-slate-400"}`} aria-hidden>
            <Building2 size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-ink">
              {o.nombre.trim() || (draft ? "Nueva oficina (escribe el nombre)" : "Sin nombre")}
            </span>
            {o.entidad ? <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted">{o.entidad}</span> : null}
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {draft ? (
                <span className="inline-flex items-center gap-1 rounded-full border-[#fde68a] bg-[#fffbeb] px-2 py-1 text-xs font-[800] leading-none text-amber-700">Sin guardar</span>
              ) : (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-[800] leading-none ${o.activo ? "border-[rgba(15,118,110,0.16)] bg-[#f0fdfa] text-brand" : "border-[#dfe5ea] bg-[#f1f4f7] text-slate-500"}`}>
                  {o.activo ? "Activa" : "Inactiva"}
                </span>
              )}
              {o.gestiona_contrataciones ? (
                <span className="inline-flex items-center gap-1 rounded-full border-[#ecdcc8] bg-[#f7eee3] px-2 py-1 text-xs font-[800] leading-none text-amber-800">
                  <Workflow size={11} aria-hidden /> Contrataciones
                </span>
              ) : null}
              {o.membrete ? (
                <span className="inline-flex items-center gap-1 rounded-full border-[rgba(15,118,110,0.16)] bg-[#f0fdfa] px-2 py-1 text-xs font-[800] leading-none text-brand">
                  <FileSpreadsheet size={11} aria-hidden /> Membrete
                </span>
              ) : null}
              {!draft ? (
                numeracion > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border-[rgba(15,118,110,0.16)] bg-[#f0fdfa] px-2 py-1 text-xs font-[800] leading-none text-brand">
                    <Hash size={11} aria-hidden /> {numeracion} doc{numeracion === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border-[#dfe5ea] bg-[#f1f4f7] px-2 py-1 text-xs font-[800] leading-none text-slate-500">
                    <Hash size={11} aria-hidden /> Sin numeración
                  </span>
                )
              ) : null}
            </span>
          </span>
          {!draft ? <ChevronDown size={18} className={`ml-auto shrink-0 text-muted transition-transform duration-150 ease ${expanded ? "rotate-180" : ""}`} aria-hidden /> : null}
        </button>

        {expanded ? (
          <div className="border-t border-line bg-[#f8fafc] p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Nombre de la oficina <em className="text-xs font-normal text-slate-400 not-italic">obligatorio</em></span>
                <input
                  className={inputBase}
                  value={o.nombre}
                  onChange={(e) => patch(o.id, { nombre: e.target.value })}
                  placeholder="Ej. Oficina de Logistica"
                  autoFocus={draft}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Entidad</span>
                <input
                  className={inputBase}
                  value={o.entidad ?? ""}
                  onChange={(e) => patch(o.id, { entidad: e.target.value })}
                  placeholder="Ej. Municipalidad Distrital de..."
                />
              </label>
            </div>

            <label className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={o.activo}
                onChange={(e) => patch(o.id, { activo: e.target.checked })}
              />
              Oficina activa (aparece al redactar documentos)
            </label>

            {o.gestiona_contrataciones ? (
              <div className="mt-0.5 border-t border-line pt-3.5">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <Workflow size={14} /> Procesos de contratación
                </div>
                <p className="m-0 text-sm text-muted">
                  Esta oficina es la encargada de las contrataciones. Sus procesos de la Ley 32069 se
                  gestionan ahora en <strong>Configuración → Procesos de selección</strong>.
                </p>
              </div>
            ) : null}

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <button
                className={btnPri}
                onClick={() => saveOficina(o)}
                type="button"
                disabled={busyId === o.id}
              >
                {busyId === o.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
              )}{" "}
              {draft ? "Crear oficina" : "Guardar"}
            </button>
            <SaveStatus status={saveStatus} />
              {confirmDeleteId === o.id ? (
                <span className="ml-auto inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-700">
                  ¿Eliminar esta oficina y su numeracion? No se puede deshacer.
                  <button
                    type="button"
                    className={`${btnSec} text-xs font-semibold text-red-700`}
                    onClick={() => deleteOficina(o.id)}
                    disabled={busyId === o.id}
                  >
                    Si, eliminar
                  </button>
                  <button
                    type="button"
                    className={`${btnSec} text-xs font-semibold text-red-700`}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  className={`${btnSec} ml-auto text-[#c0392b]`}
                  type="button"
                  onClick={() => (draft ? deleteOficina(o.id) : setConfirmDeleteId(o.id))}
                  disabled={busyId === o.id}
                >
                  <Trash2 size={16} /> {draft ? "Descartar" : "Eliminar"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2 flex-wrap">
          <a
            className={btnSec}
            href="/api/configuracion/oficinas/template"
            title="Descarga un Excel con las columnas y ejemplos que espera el import"
          >
            <Download size={16} /> Plantilla Excel
          </a>
          <button
            className={btnSec}
            type="button"
            onClick={() => importFileRef.current?.click()}
          >
            <FileSpreadsheet size={16} /> Cargar Excel
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file, "merge");
            }}
          />
          <button
            className={btnPri}
            onClick={addOficina}
            type="button"
            disabled={busyId === "new"}
          >
            {busyId === "new" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}{" "}
            Anadir oficina
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-base text-red-700">
          {error}
        </p>
      ) : null}

      {oficinas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-muted">
            <strong className="text-lg font-bold text-ink">{stats.total}</strong> oficinas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-muted">
            <strong className="text-lg font-bold text-ink">{stats.activas}</strong> activas
          </span>
          {stats.inactivas > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-muted">
              <strong className="text-lg font-bold text-ink">{stats.inactivas}</strong> inactivas
            </span>
          ) : null}
          {stats.contrataciones > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-muted">
              <Workflow size={13} aria-hidden /> <strong className="text-lg font-bold text-ink">{stats.contrataciones}</strong> gestiona contrataciones
            </span>
          ) : null}
        </div>
      ) : null}

      {oficinas.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-[420px]">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-8 text-base outline-none focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar oficina... (ej. logistica)"
              aria-label="Buscar oficina"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar busqueda"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex border-0 bg-transparent p-0.5 text-muted cursor-pointer"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <label className="inline-flex items-center gap-1.5 text-base text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar oficinas inactivas
          </label>
          <span className="ml-auto text-sm text-muted">
            {visibles.length} de {oficinas.length} oficina{oficinas.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      {oficinas.length === 0 && drafts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aún no hay oficinas registradas"
          description='Usa el botón "Añadir oficina" para crear la primera, o importa varias desde un archivo Excel con "Cargar Excel".'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {drafts.map((o) => renderRow(o))}
          {oficinas.length > 0 && visibles.length === 0 ? (
            <p className="text-base text-muted">
              {query.trim()
                ? `Ninguna oficina coincide con "${query.trim()}". Revisa la ortografia o marca "Mostrar oficinas inactivas".`
                : 'No hay oficinas activas. Marca \u00abMostrar oficinas inactivas\u00bb para verlas y reactivarlas.'}
            </p>
          ) : null}
          {visibles.map((o) => renderRow(o))}
        </div>
      )}

      {importState.kind !== "idle" ? (
        <ImportModal
          state={importState}
          onClose={closeImportModal}
          onConfirm={confirmImport}
          onChangeMode={(mode) => {
            if (importState.kind === "preview") {
              setImportState({ ...importState, mode });
            }
          }}
        />
      ) : null}

    </div>
  );
}
