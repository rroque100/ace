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

  const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 9px", borderRadius: 8, border: "1px solid var(--line, #e2e4ea)", fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Contratos guardados</p>
          <h2>Mis contratos · Comparación de Precios</h2>
        </div>
        <Database size={22} />
      </div>

      {error ? <p className="formMessage errorText">{error}</p> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Search size={15} style={{ color: "var(--muted, #667)" }} />
        <input style={inputStyle} placeholder="Buscar por nomenclatura, denominación o contratista…" value={buscando} onChange={(e) => setBuscando(e.target.value)} />
      </div>

      {cargando ? (
        <div style={{ textAlign: "center", padding: 20, color: "var(--muted, #667)", fontSize: 13 }}>
          <LoaderCircle className="spinIcon" size={18} /> Cargando…
        </div>
      ) : filtrados.length === 0 ? (
        <p style={{ color: "var(--muted, #667)", fontSize: 13, fontStyle: "italic" }}>
          {buscando ? "Sin resultados." : "Aún no has guardado ningún contrato de Comparación de Precios."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtrados.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--line, #e2e4ea)", background: "var(--panel, #fff)" }}>
              <FileText size={16} style={{ color: "var(--brand, #0f766e)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.nomenclatura || r.denominacion || "(sin título)"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted, #667)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>{r.contratista || "—"}</span>
                  <span>{r.numero_contrato || "s/n"}</span>
                  <span style={{ textTransform: "capitalize" }}>{r.estado}</span>
                  <span>{new Date(r.updated_at).toLocaleDateString("es-PE")}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button type="button" className="secondaryButton" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => onLoad(r.id)} title="Cargar en el formulario">
                  <Database size={13} /> Cargar
                </button>
                <button type="button" className="secondaryButton" style={{ padding: "4px 8px", fontSize: 12 }} disabled={generando === r.id} onClick={() => descargarDocx(r.id)} title="Descargar DOCX">
                  {generando === r.id ? <LoaderCircle className="spinIcon" size={13} /> : <Download size={13} />} DOCX
                </button>
                <button type="button" className="secondaryButton" style={{ padding: "4px 8px", fontSize: 12, color: "#c0392b" }} disabled={eliminando === r.id} onClick={() => eliminar(r.id)} title="Eliminar">
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
