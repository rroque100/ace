"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Loader, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { SaveStatus, type SaveStatusType } from "./save-status";
import { EmptyState } from "./empty-state";
import { btnPrimary, btnSecondary, btnSecondarySm } from "./ui";
import { type Feriado, feriadosNacionalesFijos, parseFeriados } from "@/lib/feriados";
import { getFeriadosOficiales } from "@/lib/feriados-oficiales/index";
import { invalidateFeriados } from "../use-feriados";
import { useToastHelpers } from "@/lib/toast";
import { useYear } from "@/lib/year-context";
import { CalculadoraPlazos } from "../calculadora-plazos";

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function diaSemana(fechaISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaISO);
  if (!m) return "";
  return DIAS_SEMANA[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()] ?? "";
}

export function FeriadosTab() {
  const { year } = useYear();
  const { success, error: toastError } = useToastHelpers();
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardadoRef, setGuardadoRef] = useState<string>("[]");
  const [guardando, setGuardando] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>('idle');
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importNuevos, setImportNuevos] = useState<Feriado[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/configuracion/feriados", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrorCarga(d?.error ?? "No se pudieron cargar los feriados.");
        return;
      }
      const lista = parseFeriados(d.feriados);
      setFeriados(lista);
      setGuardadoRef(JSON.stringify(lista));
      setErrorCarga(null);
    } catch {
      setErrorCarga("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const sinGuardar = !cargando && !errorCarga && JSON.stringify(feriados) !== guardadoRef;

  const porAnio = useMemo(() => {
    const map = new Map<string, Feriado[]>();
    for (const f of feriados) {
      const anio = f.fecha.slice(0, 4);
      const lista = map.get(anio) ?? [];
      lista.push(f);
      map.set(anio, lista);
    }
    return [...map.entries()];
  }, [feriados]);

  function agregar() {
    const fecha = nuevaFecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      toastError("Elige una fecha válida.");
      return;
    }
    setFeriados((prev) =>
      [...prev, { fecha, nombre: nuevoNombre.trim() }].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    );
    setNuevaFecha("");
    setNuevoNombre("");
  }

  function quitar(fecha: string) {
    setFeriados((prev) => prev.filter((f) => f.fecha !== fecha));
  }

  function cargarNacionales() {
    const nacionales = feriadosNacionalesFijos(year);
    setFeriados((prev) => {
      const existentes = new Set(prev.map((f) => f.fecha));
      const nuevos = nacionales.filter((f) => !existentes.has(f.fecha));
      return [...prev, ...nuevos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
  }

  async function guardar() {
    if (errorCarga) {
      toastError("No se guardó: primero hay que poder leer los feriados actuales.");
      return;
    }
    setSaveStatus('saving');
    setGuardando(true);
    try {
      const r = await fetch("/api/configuracion/feriados", {
        body: JSON.stringify({ feriados }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const d = await r.json();
      if (!r.ok) {
        toastError(d.error ?? "No se pudieron guardar los feriados.");
        setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 5000);
        return;
      }
      const lista = parseFeriados(d.feriados);
      setFeriados(lista);
      setGuardadoRef(JSON.stringify(lista));
      invalidateFeriados();
      success("Feriados guardados.");
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      toastError("No se pudo conectar con el servidor.");
      setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-muted">
          Completa los <strong>variables</strong> (Semana Santa) y los días no laborables por
          decreto: cambian cada año.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className={btnSecondary}
            onClick={cargarNacionales}
            type="button"
          >
            <CalendarDays size={16} /> Cargar feriados nacionales de {year}
          </button>
          <button
            onClick={() => {
              const oficiales = getFeriadosOficiales(String(year));
              const existentes = new Set(feriados.map(f => f.fecha));
              const nuevos = oficiales.filter(f => !existentes.has(f.fecha));
              if (nuevos.length === 0) return;
              setImportNuevos(nuevos.map(f => ({
                fecha: f.fecha,
                nombre: f.nombre,
              })));
              setShowImportConfirm(true);
            }}
            className={btnSecondarySm}
            type="button"
          >
            <CalendarDays size={13} /> Importar feriados oficiales {year}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
              <Plus size={14} /> Agregar feriado
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Fecha <em className="text-xs font-normal text-slate-400 not-italic">obligatorio</em></span>
                <input
                  className="rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  type="date"
                  value={nuevaFecha}
                />
                {feriados.some(f => f.fecha === nuevaFecha) && (
                  <p className="text-xs text-amber-600 mt-1">
                    Ya existe un feriado en esta fecha: «{feriados.find(f => f.fecha === nuevaFecha)?.nombre ?? ""}».
                    Puedes añadirlo de todas formas.
                  </p>
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">Nombre (opcional)</span>
                <input
                  className="rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej. Jueves Santo"
                  value={nuevoNombre}
                />
              </label>
            </div>
            <div className="mt-2.5">
              <button
                className={btnSecondarySm}
                onClick={agregar}
                type="button"
              >
                <Plus size={14} /> Agregar a la lista
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
              <CalendarDays size={14} /> Feriados registrados ({feriados.length})
            </div>
            {cargando ? (
              <p className="m-0 text-sm text-muted">
                <Loader className="inline animate-spin" size={14} /> Cargando…
              </p>
            ) : errorCarga ? (
              <div
                className="flex flex-wrap items-center gap-2 rounded-sm border border-[rgba(217,119,6,0.4)] bg-[rgba(217,119,6,0.12)] px-3 py-2.5 text-sm leading-snug text-ink"
                role="alert"
              >
                <AlertTriangle className="shrink-0 text-warning" size={14} aria-hidden />
                <span className="min-w-[220px] flex-1">
                  {errorCarga} No se puede guardar hasta leer la lista actual, para no borrar los
                  feriados ya registrados.
                </span>
                <button
                  className={btnSecondarySm}
                  onClick={() => void cargar()}
                  type="button"
                >
                  <RotateCcw size={13} /> Reintentar
                </button>
              </div>
            ) : feriados.length === 0 ? (
              <EmptyState
                title="No hay feriados registrados"
                description="Agrega feriados manualmente arriba o importa los feriados oficiales del año."
              />
            ) : (
              porAnio.map(([anio, items]) => (
                <div key={anio}>
                  <div className="mb-1.5 mt-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {anio} <span className="rounded-full bg-[#eef2f7] px-1.5 text-xs text-slate-600">{items.length}</span>
                  </div>
                  <ul className="m-0 mb-2 flex list-none flex-col gap-1 p-0 max-h-80 overflow-y-auto">
                    {items.map((f) => (
                      <li
                        key={f.fecha}
                        className="grid grid-cols-[96px_1fr_auto] items-center gap-2.5 rounded-sm border border-line px-2 py-1 text-sm"
                      >
                        <strong>{f.fecha}</strong>
                        <span className="text-muted">
                          <span className="mr-1.5 inline-block min-w-[26px] text-xs font-bold uppercase text-brand-dark">{diaSemana(f.fecha)}</span>
                          {f.nombre || "—"}
                        </span>
                        <button
                          aria-label={`Quitar ${f.fecha}`}
                          className="flex cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-danger"
                          onClick={() => quitar(f.fecha)}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            className={btnPrimary}
            disabled={guardando || cargando || Boolean(errorCarga)}
            onClick={guardar}
            title={errorCarga ? "No se pudo leer la lista actual; reintenta antes de guardar." : undefined}
            type="button"
          >
          {guardando ? <Loader className="inline animate-spin" size={15} /> : <Save size={15} />} Guardar feriados
        </button>
        <SaveStatus status={saveStatus} />
          <span className="text-sm text-muted">{errorCarga ? "Lista no disponible" : `${feriados.length} registrados`}</span>
          {sinGuardar ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium leading-normal text-warning">
              <AlertTriangle size={12} aria-hidden /> Sin guardar
            </span>
          ) : null}
        </div>
      </div>

      <CalculadoraPlazos />

      {showImportConfirm && importNuevos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowImportConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink mb-2">Importar feriados oficiales</h3>
            <p className="text-sm text-muted mb-3">Se importarán {importNuevos.length} feriado(s):</p>
            <ul className="text-sm text-ink mb-4 max-h-40 overflow-y-auto space-y-1">
              {importNuevos.map(f => (
                <li key={f.fecha} className="flex gap-2">
                  <span className="font-medium">{f.fecha}</span>
                  <span className="text-muted">{f.nombre}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowImportConfirm(false); setImportNuevos([]); }}
                className="px-3 py-1.5 text-sm rounded-md border border-line bg-white text-ink hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setFeriados(prev => [...prev, ...importNuevos]);
                  setShowImportConfirm(false);
                  setImportNuevos([]);
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-brand text-white hover:bg-brand-dark"
              >
                Importar {importNuevos.length} feriados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
