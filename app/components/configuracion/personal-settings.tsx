"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader, Search, Upload, Users } from "lucide-react";
import type { Personal } from "@/lib/personal";
import { useToastHelpers } from "@/lib/toast";

type DryRun = {
  total: number;
  activos: number;
  inactivos: number;
  omitidas: number;
  muestra: Personal[];
};

type ListResponse = { personal: Personal[]; total?: number; sinTabla?: boolean; error?: string };

/**
 * Pestaña "Personal" de Configuración: carga el padrón de servidores desde el
 * .xls del SIGA y deja buscarlo. El padrón alimenta luego el selector de personas
 * de Necesidades y Expedientes (elegir en vez de teclear nombre + DNI + cargo).
 *
 * La carga es en dos tiempos —revisar y confirmar— para no escribir 800 filas sin
 * que el admin vea antes cuántas activas/inactivas trae el archivo.
 */
export function PersonalSettings({ section }: { section: "personal" | null }) {
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const fileRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<"merge" | "replace">("replace");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [total, setTotal] = useState<number | null>(null);
  const [sinTabla, setSinTabla] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Personal[]>([]);
  const [buscando, setBuscando] = useState(false);

  const recargarTotal = useCallback(async () => {
    try {
      const r = await fetch("/api/configuracion/personal?withTotal=1&limit=1", { cache: "no-store" });
      const d = (await r.json()) as ListResponse;
      setSinTabla(Boolean(d.sinTabla));
      setTotal(typeof d.total === "number" ? d.total : (d.personal?.length ?? 0));
    } catch {
      /* sin conteo: el indicador queda a la espera */
    }
  }, []);

  useEffect(() => {
    if (section === "personal") void recargarTotal();
  }, [section, recargarTotal]);

  // Búsqueda contra el padrón, con un pequeño retardo para no pedir en cada tecla.
  useEffect(() => {
    if (section !== "personal") return;
    let vivo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (q.trim()) params.set("q", q.trim());
        const r = await fetch(`/api/configuracion/personal?${params.toString()}`, { cache: "no-store" });
        const d = (await r.json()) as ListResponse;
        if (!vivo) return;
        setSinTabla(Boolean(d.sinTabla));
        setResultados(d.personal ?? []);
      } catch {
        if (vivo) setResultados([]);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q, section]);

  if (section !== "personal") return null;

  function limpiarArchivo() {
    setDryRun(null);
    setNombreArchivo("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function revisar() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toastError("Sin archivo", "Elige el archivo personal.xls primero.");
      return;
    }
    setNombreArchivo(file.name);
    setRevisando(true);
    setDryRun(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", modo);
      fd.append("dryRun", "true");
      const r = await fetch("/api/configuracion/personal/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        toastError("No se pudo leer el archivo", d.error ?? "Revisa el formato del .xls.");
        return;
      }
      setDryRun(d as DryRun);
    } catch {
      toastError("Error", "No se pudo conectar con el servidor.");
    } finally {
      setRevisando(false);
    }
  }

  async function confirmar() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", modo);
      const r = await fetch("/api/configuracion/personal/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        toastError("No se pudo cargar el padrón", d.error ?? "Inténtalo de nuevo.");
        return;
      }
      const s = d.summary ?? {};
      toastSuccess(
        "Padrón cargado",
        `${s.total ?? 0} persona(s): ${s.activos ?? 0} activa(s)` +
          (s.eliminados ? `, ${s.eliminados} retirada(s)` : ""),
      );
      limpiarArchivo();
      await recargarTotal();
      setQ((v) => v); // relanza la búsqueda para refrescar la tabla
    } catch {
      toastError("Error", "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid gap-5">
      {sinTabla ? (
        <p className="flex items-start gap-2 px-3 py-2.5 rounded-sm border border-warning text-sm leading-[1.45] text-ink bg-warning-soft">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            La tabla del padrón aún no existe en la base de datos. Ejecuta{" "}
            <code className="px-1 rounded bg-panel border border-line">docs/supabase/personal.sql</code>{" "}
            en el editor SQL de Supabase y vuelve a cargar el archivo.
          </span>
        </p>
      ) : null}

      {/* Carga del archivo */}
      <section className="grid gap-3 p-4 border border-line rounded-lg bg-panel shadow-card">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-brand" aria-hidden />
          <h3 className="text-[14px] font-semibold text-ink m-0">Cargar padrón (personal.xls)</h3>
        </div>
        <p className="text-[12px] leading-[1.5] text-muted m-0 max-w-[70ch]">
          Sube el archivo <strong>personal.xls</strong> que exporta el SIGA. Estas personas se podrán
          elegir después —por nombre, DNI, código o unidad— al designar evaluadores, nombrar al
          responsable del área usuaria o firmar documentos, sin teclearlas a mano.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={(e) => {
              setDryRun(null);
              setNombreArchivo(e.target.files?.[0]?.name ?? "");
            }}
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-line file:bg-surface file:text-ink file:cursor-pointer file:text-sm"
          />
          {nombreArchivo ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <FileSpreadsheet size={13} aria-hidden /> {nombreArchivo}
            </span>
          ) : null}
        </div>

        <fieldset className="grid gap-1.5 m-0 p-0 border-0">
          <legend className="text-xs font-semibold text-muted uppercase tracking-wide p-0 mb-0.5">
            Modo de carga
          </legend>
          <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="modo-personal"
              checked={modo === "replace"}
              onChange={() => setModo("replace")}
              className="mt-0.5"
            />
            <span>
              <strong>Reemplazar</strong> — el archivo es el padrón completo: actualiza a los que
              vienen y retira a los que ya no figuran. <span className="text-muted">(recomendado)</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="modo-personal"
              checked={modo === "merge"}
              onChange={() => setModo("merge")}
              className="mt-0.5"
            />
            <span>
              <strong>Combinar</strong> — añade y actualiza, pero no retira a nadie que no venga en el
              archivo.
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={revisar}
            disabled={revisando || cargando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-surface text-ink text-sm font-medium cursor-pointer hover:bg-brand-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {revisando ? <Loader size={13} className="animate-spin" /> : <Search size={13} />}
            Revisar archivo
          </button>
          {dryRun ? (
            <button
              type="button"
              onClick={confirmar}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand/40 bg-brand text-white text-sm font-semibold cursor-pointer hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargando ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirmar carga
            </button>
          ) : null}
        </div>

        {dryRun ? (
          <div className="grid gap-2 p-3 rounded-md border border-line bg-surface">
            <p className="text-sm text-ink m-0">
              El archivo trae <strong>{dryRun.total}</strong> persona(s):{" "}
              <span className="text-success font-medium">{dryRun.activos} activa(s)</span> y{" "}
              {dryRun.inactivos} inactiva(s).
              {dryRun.omitidas ? ` Se omiten ${dryRun.omitidas} fila(s) sin código.` : ""}
              {modo === "replace"
                ? " Al confirmar, se reemplazará el padrón completo."
                : " Al confirmar, se añadirán/actualizarán sin retirar a nadie."}
            </p>
            {dryRun.muestra?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px] border-collapse">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 pr-3 font-semibold">Nombre</th>
                      <th className="py-1 pr-3 font-semibold">DNI</th>
                      <th className="py-1 pr-3 font-semibold">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRun.muestra.map((p) => (
                      <tr key={p.codigo} className="border-t border-line/60">
                        <td className="py-1 pr-3 text-ink">{p.nombreCompleto}</td>
                        <td className="py-1 pr-3 text-muted tabular-nums">{p.documento ?? "—"}</td>
                        <td className="py-1 pr-3 text-muted">{p.unidad ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted mt-1 m-0">Muestra de las primeras filas.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Padrón cargado + búsqueda */}
      <section className="grid gap-3 p-4 border border-line rounded-lg bg-panel shadow-card">
        <div className="flex items-center gap-2 flex-wrap">
          <Users size={16} className="text-brand" aria-hidden />
          <h3 className="text-[14px] font-semibold text-ink m-0">Padrón cargado</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-[9px] py-0.5 text-xs font-medium ml-auto tabular-nums ${
              (total ?? 0) > 0 ? "bg-brand-soft text-muted" : "bg-warning-soft text-warning"
            }`}
          >
            {total === null ? "…" : `${total} persona(s)`}
          </span>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, DNI, código o unidad…"
            className="w-full pl-8 pr-3 py-2 rounded-md border border-line bg-surface text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand/50"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 pr-3 font-semibold">Nombre</th>
                <th className="py-1.5 pr-3 font-semibold">DNI</th>
                <th className="py-1.5 pr-3 font-semibold">Unidad</th>
                <th className="py-1.5 pr-3 font-semibold">Profesión</th>
                <th className="py-1.5 pr-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((p) => (
                <tr key={p.codigo} className="border-t border-line/60">
                  <td className="py-1.5 pr-3 text-ink">{p.nombreCompleto}</td>
                  <td className="py-1.5 pr-3 text-muted tabular-nums">{p.documento ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted">{p.unidad ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted">{p.profesion ?? "—"}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                        (p.estado ?? "").toUpperCase() === "A"
                          ? "bg-success-soft text-success"
                          : "bg-line/60 text-muted"
                      }`}
                    >
                      {(p.estado ?? "").toUpperCase() === "A" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {buscando ? (
          <p className="flex items-center gap-1.5 text-[12px] text-muted m-0">
            <Loader size={13} className="animate-spin" /> Buscando…
          </p>
        ) : !resultados.length && !sinTabla ? (
          <p className="text-[12px] text-muted m-0">
            {q.trim() ? "Sin coincidencias." : "Aún no hay personas cargadas. Sube el archivo arriba."}
          </p>
        ) : resultados.length === 50 ? (
          <p className="text-xs text-muted m-0">
            Se muestran las primeras 50 coincidencias. Afina la búsqueda para ver otras.
          </p>
        ) : null}
      </section>
    </div>
  );
}
