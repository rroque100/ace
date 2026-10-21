"use client";

import {
  Building2,
  CheckCircle2,
  Eye,
  FileUp,
  Loader2,
  Lock,
  ScrollText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Oficina } from "./use-oficinas";
import { ConfirmDialog } from "../confirm-dialog";
import { useToastHelpers } from "@/lib/toast";
import {
  btnSecondary as btnSec,
  btnSecondarySm as btnSecSm,
  norm,
  statusBadge,
} from "../configuracion/ui";

const API = "/api/configuracion/oficinas";

const MAX_BYTES = 100 * 1024 * 1024;

export function MembreteTab({
  oficinas,
  busyId,
  setBusyId,
  setError,
  reload,
}: {
  oficinas: Oficina[];
  setOficinas: (v: Oficina[]) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  setError: (v: string | null) => void;
  reload: () => Promise<void>;
}) {
  const { success: toastOk, error: toastErr } = useToastHelpers();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [query, setQuery] = useState("");
  const [previsualizando, setPrevisualizando] = useState<Set<string>>(new Set());

  function alternarPreview(id: string) {
    setPrevisualizando((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibles = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return oficinas;
    return oficinas.filter((o) => norm(o.nombre).includes(q) || norm(o.entidad).includes(q));
  }, [oficinas, query]);
  const [pendingDelete, setPendingDelete] = useState<Oficina | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  if (oficinas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-[#f8fafc] px-5 py-10 text-center text-slate-600">
        <Building2 size={28} />
        <strong className="text-lg">Aún no hay oficinas registradas</strong>
        <p className="m-0 max-w-[400px] text-sm leading-normal text-slate-500">Primero crea un área en la pestaña <strong>Áreas</strong>. Luego podrás subir aquí la hoja membretada (PDF) que se usa de fondo al exportar las respuestas.</p>
      </div>
    );
  }

  async function uploadMembrete(id: string, file: File | null | undefined) {
    if (!file) return;
    const esPdf = file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name));
    if (!esPdf) {
      setError("La hoja membretada debe ser un PDF.");
      toastErr("Formato no válido", "La hoja membretada debe ser un PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`El archivo pesa ${mb} MB y el máximo es 100 MB.`);
      toastErr("Archivo demasiado grande", `Pesa ${mb} MB; el máximo es 100 MB.`);
      return;
    }
    setBusyId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("oficinaId", id);
      const res = await fetch(`${API}/membrete`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reload();
      setRefreshKey((k) => k + 1);
      toastOk("Hoja membretada subida");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir la hoja membretada";
      setError(msg);
      toastErr("No se pudo subir", msg);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMembrete(id: string) {
    setPendingDelete(null);
    setBusyId(id);
    try {
      const res = await fetch(`${API}/membrete?oficinaId=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reload();
      setRefreshKey((k) => k + 1);
      toastOk("Hoja membretada eliminada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo eliminar la hoja membretada";
      setError(msg);
      toastErr("No se pudo eliminar", msg);
    } finally {
      setBusyId(null);
    }
  }

  function onDrop(id: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadMembrete(id, file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-muted">
          <ScrollText size={14} className="inline -translate-y-px mr-1" />
          Un PDF por oficina. Tamaño máximo: 100 MB.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-[420px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            aria-label="Buscar oficina"
            className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-8 text-sm outline-none focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar oficina… (ej. logística)"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex border-0 bg-transparent p-0.5 text-muted cursor-pointer"
              onClick={() => setQuery("")}
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        <span className="text-sm text-muted">
          {visibles.length} de {oficinas.length}
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted">Ninguna oficina coincide con &laquo;{query}&raquo;.</p>
      ) : null}

      {visibles.map((o) => {
        const busy = busyId === o.id;
        const previewAbierta = previsualizando.has(o.id);
        return (
          <div key={o.id} className={`rounded-xl border border-line bg-panel p-4 shadow-card transition-shadow duration-150 ease hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)] ${o.membrete ? "" : "opacity-75"}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-sm font-[650]">{o.nombre}</strong>
                <div className="mt-0.5 text-xs text-muted">
                  {o.entidad ?? "Sin entidad"}
                  {o.sufijo ? ` · ${o.sufijo}` : ""}
                </div>
              </div>
              {o.membrete ? (
                <span className={statusBadge(true)}>
                  <CheckCircle2 size={13} /> Membrete cargado
                </span>
              ) : (
                <span className={statusBadge(false)}>
                  <Lock size={12} /> Sin membrete
                </span>
              )}
            </div>

            {o.membrete ? (
              <div className="my-2.5 flex flex-col items-start gap-2">
                <button
                  aria-expanded={previewAbierta}
                  className={btnSecSm}
                  onClick={() => alternarPreview(o.id)}
                  type="button"
                >
                  <Eye size={14} /> {previewAbierta ? "Ocultar" : "Ver"} membrete
                </button>
                {previewAbierta ? (
                  <div
                    className="h-[240px] lg:h-[320px] w-full overflow-hidden rounded-lg border border-line bg-[#f8fafc] cursor-pointer"
                    onClick={() => setZoomedId(o.id)}
                  >
                    <embed
                      key={refreshKey}
                      src={`${API}/membrete?oficinaId=${o.id}&v=${refreshKey}#toolbar=0&navpanes=0`}
                      type="application/pdf"
                      className="block h-full w-full border-0 pointer-events-none"
                      title={`Hoja membretada de ${o.nombre}`}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-line px-4 py-6 text-center text-sm text-muted cursor-pointer transition-[border-color,background,color] duration-150 ease hover:border-brand hover:bg-[#f0fdfa] hover:text-brand-dark ${o.membrete ? "flex-row gap-2.5 py-3.5" : ""}`}
              data-drag={dragOverId === o.id}
              role="button"
              aria-label={`${o.membrete ? "Reemplazar" : "Subir"} la hoja membretada de ${o.nombre}`}
              tabIndex={0}
              onClick={() => fileRefs.current[o.id]?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRefs.current[o.id]?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(o.id);
              }}
              onDragLeave={() => setDragOverId((cur) => (cur === o.id ? null : cur))}
              onDrop={(e) => onDrop(o.id, e)}
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileUp size={o.membrete ? 16 : 22} />
              )}
              <span>
                {busy
                  ? "Subiendo…"
                  : o.membrete
                    ? "Arrastra un PDF aquí para reemplazarlo, o haz clic"
                    : "Arrastra el PDF membretado aquí o haz clic para elegirlo"}
              </span>
            </div>

            <input
              ref={(el) => {
                fileRefs.current[o.id] = el;
              }}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                void uploadMembrete(o.id, e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {o.membrete ? (
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <a
                  className="inline-flex items-center justify-center gap-2 min-h-[38px] rounded-lg border-0 bg-brand px-4 text-sm font-bold text-white cursor-pointer transition-all duration-150 ease hover:bg-brand-dark hover:-translate-y-px"
                  href={`${API}/membrete?oficinaId=${o.id}&v=${refreshKey}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileUp size={14} className="rotate-180" /> Ver a pantalla completa
                </a>
                <button
                  className={btnSec}
                  type="button"
                  onClick={() => setPendingDelete(o)}
                  disabled={busy}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            ) : null}

            {zoomedId === o.id && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-8" onClick={() => setZoomedId(null)}>
                <div className="max-w-3xl max-h-[90vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                  <object
                    data={`${API}/membrete?oficinaId=${o.id}&v=${refreshKey}#toolbar=1&navpanes=1`}
                    type="application/pdf"
                    className="w-[600px] h-[80vh]"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar hoja membretada"
        message={
          pendingDelete
            ? `Se quitara la hoja membretada de "${pendingDelete.nombre}". Los documentos que exportes despues saldran sin fondo hasta que subas una nueva. Esta accion no se puede deshacer.`
            : ""
        }
        tone="danger"
        confirmLabel="Si, eliminar"
        onConfirm={() => {
          if (pendingDelete) void deleteMembrete(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
