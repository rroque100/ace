"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader, Plus, RotateCcw, Save, Scale, Trash2 } from "lucide-react";
import { SaveStatus, type SaveStatusType } from "./save-status";
import { EmptyState } from "./empty-state";
import { btnPrimary, btnSecondarySm } from "./ui";
import {
  type InstitucionArbitralCatalogo,
  parseCatalogoInstituciones,
  rucCatalogoValido,
  siguienteIdCatalogo,
} from "@/lib/catalogo-instituciones-arbitrales";
import { useToastHelpers } from "@/lib/toast";

export function InstitucionesArbitralesTab() {
  const { success, error: toastError } = useToastHelpers();
  const [instituciones, setInstituciones] = useState<InstitucionArbitralCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardadoRef, setGuardadoRef] = useState<string>("[]");
  const [guardando, setGuardando] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>("idle");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRuc, setNuevoRuc] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/configuracion/instituciones-arbitrales", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrorCarga(d?.error ?? "No se pudieron cargar las instituciones arbitrales.");
        return;
      }
      const lista = parseCatalogoInstituciones(d.instituciones);
      setInstituciones(lista);
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

  const sinGuardar = !cargando && !errorCarga && JSON.stringify(instituciones) !== guardadoRef;
  const rucNuevoInvalido = !rucCatalogoValido(nuevoRuc);

  function agregar() {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      toastError("Escribe el nombre de la institución arbitral.");
      return;
    }
    if (rucNuevoInvalido) {
      toastError("El RUC debe tener 11 dígitos (o dejarse vacío).");
      return;
    }
    setInstituciones((prev) => [
      ...prev,
      { id: siguienteIdCatalogo(prev), nombre, ruc: nuevoRuc.trim() },
    ]);
    setNuevoNombre("");
    setNuevoRuc("");
  }

  function quitar(id: number) {
    setInstituciones((prev) => prev.filter((i) => i.id !== id));
  }

  async function guardar() {
    if (errorCarga) {
      toastError("No se guardó: primero hay que poder leer el catálogo actual.");
      return;
    }
    setSaveStatus("saving");
    setGuardando(true);
    try {
      const r = await fetch("/api/configuracion/instituciones-arbitrales", {
        body: JSON.stringify({ instituciones }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const d = await r.json();
      if (!r.ok) {
        toastError(d.error ?? "No se pudieron guardar las instituciones arbitrales.");
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 5000);
        return;
      }
      const lista = parseCatalogoInstituciones(d.instituciones);
      setInstituciones(lista);
      setGuardadoRef(JSON.stringify(lista));
      success("Instituciones arbitrales guardadas.");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      toastError("No se pudo conectar con el servidor.");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 5000);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-[70ch] text-sm leading-relaxed text-muted">
        Instituciones arbitrales que la entidad admite en el convenio arbitral. Cada una debe
        contar con <strong>inscripción vigente en el REGAJU</strong> (Art. 332.1 del Reglamento).
        Se usan al fijar la solución de controversias del requerimiento.
      </p>

      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
              <Plus size={14} /> Agregar institución arbitral
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  Nombre de la institución arbitral{" "}
                  <em className="text-xs font-normal not-italic text-slate-400">obligatorio</em>
                </span>
                <input
                  className="rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") agregar();
                  }}
                  placeholder="Ej. Centro de Arbitraje de la Cámara de Comercio de Lima"
                  value={nuevoNombre}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  RUC <em className="text-xs font-normal not-italic text-slate-400">opcional</em>
                </span>
                <input
                  className={`rounded-md border bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)] ${
                    rucNuevoInvalido ? "border-amber-400 focus:border-amber-500" : "border-line focus:border-brand"
                  }`}
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(e) => setNuevoRuc(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") agregar();
                  }}
                  placeholder="20123456789"
                  value={nuevoRuc}
                />
                {rucNuevoInvalido ? (
                  <span className="mt-0.5 text-xs text-amber-600">Debe tener 11 dígitos.</span>
                ) : null}
              </label>
            </div>
            <div className="mt-2.5">
              <button className={btnSecondarySm} onClick={agregar} type="button">
                <Plus size={14} /> Agregar a la lista
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
              <Scale size={14} /> Instituciones registradas ({instituciones.length})
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
                  {errorCarga} No se puede guardar hasta leer el catálogo actual, para no borrar lo
                  ya registrado.
                </span>
                <button className={btnSecondarySm} onClick={() => void cargar()} type="button">
                  <RotateCcw size={13} /> Reintentar
                </button>
              </div>
            ) : instituciones.length === 0 ? (
              <EmptyState
                title="No hay instituciones arbitrales registradas"
                description="Agrega arriba las instituciones que la entidad admite en el convenio arbitral."
              />
            ) : (
              <ul className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
                <li className="grid grid-cols-[48px_1fr_140px_auto] items-center gap-2.5 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>Id</span>
                  <span>Institución arbitral</span>
                  <span>RUC</span>
                  <span />
                </li>
                {instituciones.map((i) => (
                  <li
                    key={i.id}
                    className="grid grid-cols-[48px_1fr_140px_auto] items-center gap-2.5 rounded-sm border border-line px-2 py-1.5 text-sm"
                  >
                    <strong className="tabular-nums text-brand-dark">{i.id}</strong>
                    <span className="min-w-0 truncate" title={i.nombre}>
                      {i.nombre}
                    </span>
                    <span className="tabular-nums text-muted">{i.ruc || "—"}</span>
                    <button
                      aria-label={`Quitar ${i.nombre}`}
                      className="flex cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-danger"
                      onClick={() => quitar(i.id)}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            className={btnPrimary}
            disabled={guardando || cargando || Boolean(errorCarga)}
            onClick={guardar}
            title={errorCarga ? "No se pudo leer el catálogo actual; reintenta antes de guardar." : undefined}
            type="button"
          >
            {guardando ? <Loader className="inline animate-spin" size={15} /> : <Save size={15} />} Guardar
          </button>
          <SaveStatus status={saveStatus} />
          <span className="text-sm text-muted">
            {errorCarga ? "Catálogo no disponible" : `${instituciones.length} registradas`}
          </span>
          {sinGuardar ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium leading-normal text-warning">
              <AlertTriangle size={12} aria-hidden /> Sin guardar
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
