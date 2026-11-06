"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, Download, FileText, LoaderCircle, Search, Trash2 } from "lucide-react";

type ContratoRow = {
  id: string;
  created_at: string;
  updated_at: string;
  numero_contrato: string;
  nomenclatura: string;
  denominacion: string;
  contratista: string;
  estado: string;
  data: Record<string, unknown>;
};

export function ContratoCpList({ onLoad }: { onLoad: (id: string) => void }) {
  const [rows, setRows] = useState<ContratoRow[]>([]);
  const [buscando, setBuscando] = useState("");
  const [cargando, setCargando] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/contratos-cp");
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setError("No se pudieron cargar los contratos."); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = useCallback(async (id: string) => {
    if (!window.confirm("¿Eliminar este contrato definitivamente?")) return;
    setEliminando(id);
    try {
      const res = await fetch(`/api/contratos-cp/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch { setError("No se pudo eliminar."); }
    setEliminando(null);
  }, []);

  const descargarDocx = useCallback(async (id: string) => {
    setGenerando(id);
    try {
      const res = await fetch(`/api/contratos-cp/${id}`);
      if (!res.ok) throw new Error("Error al obtener datos");
      const saved = await res.json();
      const d = saved.data;
      if (!d) throw new Error("Sin datos");

      const gen = await fetch("/api/contratos-cp/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato: "docx",
          numeroContrato: saved.numero_contrato || undefined,
          proceso: d.proceso,
          postor: d.postor,
          contrato: d.contrato,
        }),
      });
      if (!gen.ok) throw new Error("Error al generar");
      const blob = await gen.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `contrato-cp-${saved.numero_contrato || id}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError("No se pudo descargar."); }
    setGenerando(null);
  }, []);

  const filtrados = rows.filter((r) =>
    !buscando || r.nomenclatura.toLowerCase().includes(buscando.toLowerCase()) ||
    r.denominacion.toLowerCase().includes(buscando.toLowerCase()) ||
    r.contratista.toLowerCase().includes(buscando.toLowerCase()) ||
    r.numero_contrato.toLowerCase().includes(buscando.toLowerCase())
  );

  // Estilos en línea migrados a utilidades. No se envuelve en `.tw`: este
  // componente aún usa clases compartidas (toolPanelHeader, secondaryButton,
  // formMessage…) que el reset de `.tw` rompería; por eso los bordes llevan
  // `border-solid` y los campos `box-border` explícitos (lo que `.tw` daría).
  return (
    <div className="flex flex-col gap-3">
      <div className="toolPanelHeader">
        <div>
          <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Contratos guardados</p>
          <h2>Mis contratos · Comparación de Precios</h2>
        </div>
        <Database size={22} />
      </div>

      {error ? <p className="formMessage errorText">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Search size={15} className="text-muted" />
        <input className="w-full box-border rounded-md border border-solid border-line px-[9px] py-[7px] text-[13px]" placeholder="Buscar por nomenclatura, denominación o contratista…" value={buscando} onChange={(e) => setBuscando(e.target.value)} />
      </div>

      {cargando ? (
        <div className="p-5 text-center text-[13px] text-muted">
          <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={18} /> Cargando…
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-[13px] italic text-muted">
          {buscando ? "Sin resultados." : "Aún no has guardado ningún contrato de Comparación de Precios."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtrados.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-solid border-line bg-panel px-3.5 py-2.5">
              <FileText size={16} className="shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">
                  {r.nomenclatura || r.denominacion || "(sin título)"}
                </div>
                <div className="flex flex-wrap gap-3 text-[11.5px] text-muted">
                  <span>{r.contratista || "—"}</span>
                  <span>{r.numero_contrato || "s/n"}</span>
                  <span className="capitalize">{r.estado}</span>
                  <span>{new Date(r.updated_at).toLocaleDateString("es-PE")}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="secondaryButton px-2 py-1 text-xs" onClick={() => onLoad(r.id)} title="Cargar en el formulario">
                  <Database size={13} /> Cargar
                </button>
                <button type="button" className="secondaryButton px-2 py-1 text-xs" disabled={generando === r.id} onClick={() => descargarDocx(r.id)} title="Descargar DOCX">
                  {generando === r.id ? <LoaderCircle className="animate-[spin_0.9s_linear_infinite]" size={13} /> : <Download size={13} />} DOCX
                </button>
                <button type="button" className="secondaryButton px-2 py-1 text-xs text-danger" disabled={eliminando === r.id} onClick={() => eliminar(r.id)} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
