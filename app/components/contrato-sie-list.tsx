"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, ExternalLink, Search, FileDown } from "lucide-react";

type SavedContract = {
  id: string;
  created_at: string;
  updated_at: string;
  numero_contrato: string;
  nomenclatura: string;
  denominacion: string;
  contratista: string;
  estado: string;
};

export function ContratoSieList({ onLoad }: { onLoad: (id: string) => void }) {
  const [rows, setRows] = useState<SavedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contratos-sie");
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (id: string) => {
    try {
      await fetch(`/api/contratos-sie/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch { /* ignore */ }
    setConfirmarId(null);
  };

  const filtrados = rows.filter(
    (r) =>
      r.nomenclatura.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.denominacion.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.contratista.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Search size={16} />
        <input
          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line, #e2e4ea)", fontSize: 13 }}
          placeholder="Buscar por nomenclatura, denominación o contratista…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--muted, #667)" }}>Cargando…</p>
      ) : filtrados.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted, #667)", fontStyle: "italic" }}>
          {busqueda ? "Sin resultados." : "Aún no has guardado ningún contrato SIE. Completa el formulario y usa Guardar borrador."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtrados.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--line, #e2e4ea)", background: "var(--panel, #fff)",
              }}
            >
              <FileText size={18} style={{ flexShrink: 0, color: "var(--brand, #0f766e)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.nomenclatura || r.denominacion || "(sin nombre)"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted, #667)" }}>
                  {r.contratista ? `${r.contratista} · ` : ""}
                  {new Date(r.updated_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  <span style={{ fontWeight: r.estado === "generado" ? 600 : 400 }}>{r.estado === "generado" ? "Generado" : "Borrador"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Cargar contrato"
                  onClick={() => onLoad(r.id)}
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--brand, #0f766e)", padding: 4, display: "flex" }}
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  type="button"
                  title="Generar DOCX"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/contratos-sie/${r.id}`);
                      if (!res.ok) return;
                      const full = await res.json();
                      if (!full.data) return;
                      const genRes = await fetch("/api/contratos-sie/generar", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          formato: "docx",
                          numeroContrato: full.numero_contrato || undefined,
                          ...full.data,
                        }),
                      });
                      if (!genRes.ok) return;
                      const blob = await genRes.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `contrato-sie.docx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch { /* ignore */ }
                  }}
                  style={{ background: "transparent", border: 0, cursor: "pointer", color: "#0f766e", padding: 4, display: "flex" }}
                >
                  <FileDown size={16} />
                </button>
                {confirmarId === r.id ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => eliminar(r.id)}
                      style={{ background: "#c0392b", color: "#fff", border: 0, borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarId(null)}
                      style={{ background: "transparent", border: 0, fontSize: 11, cursor: "pointer", color: "var(--muted, #667)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => setConfirmarId(r.id)}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "#c0392b", padding: 4, display: "flex" }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
