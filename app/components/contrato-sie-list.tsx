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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Search size={16} />
        <input
          className="flex-1 rounded-sm border border-line px-2.5 py-1.5 text-[13px]"
          placeholder="Buscar por nomenclatura, denominación o contratista…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Cargando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-[13px] italic text-muted">
          {busqueda ? "Sin resultados." : "Aún no has guardado ningún contrato SIE. Completa el formulario y usa Guardar borrador."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtrados.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2.5 rounded-md border border-line bg-panel px-3 py-2"
            >
              <FileText size={18} className="shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-ink">
                  {r.nomenclatura || r.denominacion || "(sin nombre)"}
                </div>
                <div className="text-[11.5px] text-muted">
                  {r.contratista ? `${r.contratista} · ` : ""}
                  {new Date(r.updated_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  <span className={r.estado === "generado" ? "font-semibold" : "font-normal"}>{r.estado === "generado" ? "Generado" : "Borrador"}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Cargar contrato"
                  onClick={() => onLoad(r.id)}
                  className="flex p-1 text-brand"
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
                  className="flex p-1 text-brand"
                >
                  <FileDown size={16} />
                </button>
                {confirmarId === r.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => eliminar(r.id)}
                      className="rounded bg-danger px-2 py-0.5 text-[11px] text-white"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarId(null)}
                      className="text-[11px] text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => setConfirmarId(r.id)}
                    className="flex p-1 text-danger"
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
