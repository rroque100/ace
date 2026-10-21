"use client";

import { Building2, CheckCircle2, ChevronUp, Circle, Info, Loader2, Plus, Save, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { SaveStatus, type SaveStatusType } from "../configuracion/save-status";
import { EmptyState } from "../configuracion/empty-state";
import { btnPrimary as btnPri, norm, statusBadge } from "../configuracion/ui";
import { TIPOS_DOCUMENTO, tipoDocumentoLabel } from "@/lib/document-number";
import { formatCounterPreview, type Oficina } from "./use-oficinas";
import { useYear } from "@/lib/year-context";
import { useToastHelpers } from "@/lib/toast";

export function NumeracionTab({
  oficinas,
  setOficinas,
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
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const visibles = useMemo(() => {
    const q = norm(query.trim());
    return oficinas.filter((o) => {
      if (!showInactive && !o.activo) return false;
      if (!q) return true;
      return (
        norm(o.nombre).includes(q) ||
        norm(o.sufijo).includes(q) ||
        norm(o.entidad).includes(q)
      );
    });
  }, [oficinas, query, showInactive]);

  if (oficinas.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Aún no hay oficinas registradas"
        description="Primero registra un área en la pestaña Áreas. Después podrás elegir aquí qué documentos emite cada oficina y desde qué número empieza cada uno."
      />
    );
  }

  function handleToggleTipo(oficinaId: string, tipo: string) {
    setOficinas(
      oficinas.map((o) =>
        o.id === oficinaId
          ? {
              ...o,
              counters: o.counters.map((c) =>
                c.tipo === tipo ? { ...c, enabled: !c.enabled } : c,
              ),
            }
          : o,
      ),
    );
  }

  function handlePatchCounter(
    oficinaId: string,
    tipo: string,
    changes: { siguiente?: number; sufijo?: string | null },
  ) {
    setOficinas(
      oficinas.map((o) =>
        o.id === oficinaId
          ? {
              ...o,
              counters: o.counters.map((c) => {
                if (c.tipo !== tipo) return c;
                const next = { ...c, ...changes };
                return {
                  ...next,
                  preview: formatCounterPreview(
                    next.tipo,
                    next.siguiente,
                    o.ancho,
                    next.sufijo?.trim() || o.sufijo,
                  ),
                };
              }),
            }
          : o,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-muted">
          <Info size={14} className="inline -translate-y-px mr-1" />
          El número oficial se arma solo, por ejemplo{" "}
          <code>INFORME N° 001-2026-MDCH/LOG</code>. El año se agrega automáticamente.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-[420px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-8 text-base outline-none focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.15)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar oficina… (ej. logística)"
            aria-label="Buscar oficina"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
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

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-[#f8fafc] px-5 py-10 text-center text-slate-600">
          <Search size={26} />
          <strong className="text-lg">Sin resultados</strong>
          <p className="m-0 max-w-[400px] text-base leading-normal text-slate-500">{query.trim()
              ? `Ninguna oficina coincide con "${query.trim()}". Revisa la ortografía o activa "Mostrar oficinas inactivas".`
              : "No hay oficinas activas. Activa alguna en la pestaña Áreas o marca \"Mostrar oficinas inactivas\"."}</p>
        </div>
      ) : (
        visibles.map((o) => (
          <NumeracionCard
            key={o.id}
            oficina={o}
            toggleTipo={handleToggleTipo}
            patchCounter={handlePatchCounter}
            busyId={busyId}
            setBusyId={setBusyId}
            setError={setError}
            reload={reload}
          />
        ))
      )}
    </div>
  );
}

function NumeracionCard({
  oficina,
  toggleTipo,
  patchCounter,
  busyId,
  setBusyId,
  setError,
  reload,
}: {
  oficina: Oficina;
  toggleTipo: (oficinaId: string, tipo: string) => void;
  patchCounter: (
    oficinaId: string,
    tipo: string,
    changes: { siguiente?: number; sufijo?: string | null },
  ) => void;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  setError: (v: string | null) => void;
  reload: () => Promise<void>;
}) {
  const { year, yearParam } = useYear();
  const { success: toastOk, error: toastErr } = useToastHelpers();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>('idle');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [initialEnabled] = useState<Set<string>>(
    () => new Set(oficina.counters.filter((c) => c.enabled).map((c) => c.tipo)),
  );

  const enabledCount = oficina.counters.filter((c) => c.enabled).length;

  const docs = TIPOS_DOCUMENTO.map((t) => {
    const c = oficina.counters.find((x) => x.tipo === t);
    const enabled = c?.enabled ?? false;
    return { tipo: t, enabled, willLoseNumber: !enabled && initialEnabled.has(t) };
  });
  const visibles = docs.filter((d) => d.enabled || d.willLoseNumber);
  const ocultos = docs.filter((d) => !d.enabled && !d.willLoseNumber);

  function renderDoc(tipo: string) {
    const c = oficina.counters.find((x) => x.tipo === tipo);
    const enabled = c?.enabled ?? false;
    const siguiente = c?.siguiente ?? 1;
    const sufijo = c?.sufijo ?? null;
    const preview = formatCounterPreview(tipo, siguiente, oficina.ancho, sufijo?.trim() || oficina.sufijo);
    const willLoseNumber = !enabled && initialEnabled.has(tipo);
    return (
      <div
        key={tipo}
        className={`flex flex-col gap-2.5 rounded-lg p-3 transition-[border-color,background,box-shadow] duration-150 ease ${enabled ? "border-[1.5px] border-brand bg-[rgba(15,118,110,0.04)] shadow-[0_1px_4px_rgba(15,118,110,0.06)]" : "border border-dashed border-line bg-transparent hover:bg-[#f8fafc] hover:border-slate-300"}`}
      >
        <label className={`flex items-center gap-2 cursor-pointer select-none text-base font-semibold ${enabled ? "text-ink" : "text-muted"}`}>
          <input
            type="checkbox"
            className="sr-only"
            checked={enabled}
            onChange={() => toggleTipo(oficina.id, tipo)}
            aria-label={enabled ? `Desactivar ${tipoDocumentoLabel(tipo)}` : `Activar ${tipoDocumentoLabel(tipo)}`}
          />
          {enabled ? (
            <CheckCircle2 size={17} className="shrink-0 text-brand" />
          ) : (
            <Circle size={17} className="shrink-0 text-muted" />
          )}
          {tipoDocumentoLabel(tipo)}
        </label>

        {enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">Empieza en</span>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-md border border-line px-2 py-1.5 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)] box-border"
                  value={siguiente}
                  onChange={(e) =>
                    patchCounter(oficina.id, tipo, {
                      siguiente: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  aria-label={`Siguiente número de ${tipoDocumentoLabel(tipo)}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">Sigla propia</span>
                <input
                  type="text"
                  className="w-full min-w-0 rounded-md border border-line px-2 py-1.5 text-sm font-mono outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)] box-border"
                  value={sufijo ?? ""}
                  onChange={(e) => patchCounter(oficina.id, tipo, { sufijo: e.target.value })}
                  placeholder={oficina.sufijo || "Ej. MDCH/LOG"}
                  aria-label={`Sigla de ${tipoDocumentoLabel(tipo)}`}
                  title="Sigla propia de este tipo de documento. Si la dejas vacía se usa la sigla general de la oficina."
                />
              </label>
            </div>
            <div className="flex items-start gap-3">
              <span className="overflow-wrap-anywhere rounded-sm bg-[rgba(15,118,110,0.06)] px-2 py-1 text-xs font-medium font-mono text-brand" title="Así saldrá el próximo documento">
                {preview}
              </span>
              <div className="relative w-48 h-64 bg-white border border-line rounded-xl shadow-pop overflow-hidden shrink-0 flex flex-col">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
                  <span className="text-[48px] font-black text-[rgba(0,0,0,0.04)] rotate-[-25deg] tracking-[-0.05em]">EJEMPLO</span>
                </div>
                <div className="px-3 pt-3 pb-1 flex items-start gap-2 border-b border-line/40">
                  <div className="size-6 shrink-0 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">M</div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-ink truncate">MUNICIPALIDAD DISTRITAL</p>
                    <p className="text-[7px] text-muted truncate">San Juan de Lurigancho</p>
                  </div>
                </div>
                <div className="flex-1 px-3 pt-2 flex flex-col">
                  <p className="text-[9px] font-semibold text-muted uppercase tracking-wider mb-0.5">{tipoDocumentoLabel(tipo)}</p>
                  <p className="text-xs font-extrabold text-ink leading-tight">
                    {tipoDocumentoLabel(tipo)} N° {String(siguiente).padStart(4, '0')}-{year}
                  </p>
                  <p className="text-[7px] text-muted mt-auto pb-1">
                    {new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
                  </p>
                </div>
                <div className="absolute bottom-1.5 right-2.5 z-10">
                  <span className="text-[7px] text-muted/50 italic">Vista previa</span>
                </div>
              </div>
            </div>
          </>
        ) : willLoseNumber ? (
          <span className="text-xs leading-snug text-amber-700">
            Al guardar se quitará este tipo y su numeración volverá a empezar en 1 si lo vuelves a
            activar.
          </span>
        ) : (
          <span className="text-xs text-muted">Esta oficina no emite este documento.</span>
        )}
      </div>
    );
  }

  async function save() {
    const enabled = oficina.counters.filter((c) => c.enabled);
    if (enabled.length === 0) {
      setError("Marca al menos un tipo de documento para esta oficina.");
      return;
    }
    setSaving(true);
    setBusyId(oficina.id);
    setError(null);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/configuracion/oficinas/${oficina.id}/numeracion?${yearParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counters: enabled.map((c) => ({
            tipo: c.tipo,
            siguiente: c.siguiente,
            sufijo: c.sufijo?.trim() || null,
          })),
        }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        const text = await res.text();
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        data = { error: `Respuesta no es JSON (status ${res.status})` };
      }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      initialEnabled.clear();
      for (const c of enabled) initialEnabled.add(c.tipo);
      await reload();
      toastOk("Numeración guardada", oficina.nombre);
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar la numeración";
      setError(msg);
      toastErr("No se pudo guardar la numeración", msg);
      setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
      setBusyId(null);
    }
  }

  return (
    <div className={`rounded-xl border border-line bg-panel p-4 shadow-card transition-shadow duration-150 ease hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)] ${oficina.activo ? "" : "opacity-75"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-md font-semibold">{oficina.nombre}</strong>
          {oficina.sufijo ? (
            <div className="mt-0.5 text-sm text-muted">{oficina.sufijo}</div>
          ) : null}
        </div>
        <span className={statusBadge(enabledCount > 0)}>
          {enabledCount} tipo{enabledCount === 1 ? "" : "s"} activado{enabledCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-lg bg-[#f8fafc] p-3">
        <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
          <CheckCircle2 size={14} /> Documentos que emite esta oficina
        </div>
        <p className="m-0 mb-3 max-w-none text-base leading-snug text-muted">
          Activa los tipos que emite. Los que no marques no aparecerán al redactar.
        </p>

        {visibles.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {visibles.map((d) => renderDoc(d.tipo))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Esta oficina aún no emite ningún documento. Añade uno abajo.
          </p>
        )}

        {ocultos.length > 0 ? (
          <>
            {mostrarInactivos ? (
              <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {ocultos.map((d) => renderDoc(d.tipo))}
              </div>
            ) : null}
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 mt-2.5 rounded-md border border-dashed border-line bg-transparent px-2 py-1 text-xs text-muted cursor-pointer hover:text-ink hover:border-brand hover:bg-[rgba(15,118,110,0.05)]`}
              onClick={() => setMostrarInactivos((v) => !v)}
            >
              {mostrarInactivos ? (
                <>
                  <ChevronUp size={13} /> Ocultar los tipos que no emite
                </>
              ) : (
                <>
                  <Plus size={13} /> Añadir otro tipo de documento ({ocultos.length})
                </>
              )}
            </button>
          </>
        ) : null}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <button
          className={btnPri}
          onClick={save}
          type="button"
          disabled={saving || busyId === oficina.id || enabledCount === 0}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
          numeración
        </button>
        <SaveStatus status={saveStatus} />
        <span className="text-sm text-muted">
          Si un tipo de documento no tiene su propia sigla, se usa la sigla general de la oficina.
        </span>
      </div>
    </div>
  );
}
