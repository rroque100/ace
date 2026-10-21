"use client";

import { useState, useCallback } from "react";
import { FileText, Gavel, ShoppingCart } from "lucide-react";
import { ContratoSieForm } from "./contrato-sie-form";
import { ContratoSieList } from "./contrato-sie-list";
import { ContratoCpForm } from "./contrato-cp-form";
import { ContratoCpList } from "./contrato-cp-list";
import { idPestana, propsPanel, propsPestana, siguientePestana } from "@/lib/pestanas-accesibles";

type Modo = "inicio" | "sie" | "cp" | "mis-contratos";

/** Prefijo de los identificadores de esta lista de pestañas en la página. */
const BASE_CONTRATOS = "contratos";
const MODOS = ["inicio", "sie", "cp", "mis-contratos"] as const;

function Card({ icon: Icon, title, desc, onClick }: { icon: typeof FileText; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", padding: "28px 20px", borderRadius: 12, border: "1.5px solid var(--line, #e2e4ea)", background: "var(--panel, #fff)", cursor: "pointer", minWidth: 200, flex: 1, transition: "box-shadow .2s, border-color .2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand, #0f766e)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(15,118,110,.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line, #e2e4ea)"; e.currentTarget.style.boxShadow = "none"; }}>
      <Icon size={32} style={{ color: "var(--brand, #0f766e)" }} />
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text, #222)" }}>{title}</span>
      <span style={{ fontSize: 11.5, color: "var(--muted, #667)", textAlign: "center", lineHeight: 1.4 }}>{desc}</span>
    </button>
  );
}

export function ContratosWorkspace() {
  const [modo, setModo] = useState<Modo>("inicio");
  const [loadKey, setLoadKey] = useState(0);
  const [contratoCargado, setContratoCargado] = useState<string | null>(null);
  const [contratoCpCargado, setContratoCpCargado] = useState<string | null>(null);

  const handleLoad = useCallback((id: string) => { setContratoCargado(id); setModo("sie"); setLoadKey((k) => k + 1); }, []);
  const handleLoadCp = useCallback((id: string) => { setContratoCpCargado(id); setModo("cp"); setLoadKey((k) => k + 1); }, []);

  const go = (m: Modo) => { setModo(m); setContratoCargado(null); setContratoCpCargado(null); setLoadKey((k) => k + 1); };

  const navStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 999, fontSize: 13, cursor: "pointer",
    border: active ? "1.5px solid var(--brand, #0f766e)" : "1px solid var(--line, #e2e4ea)",
    background: active ? "rgba(15,118,110,0.08)" : "transparent",
    color: active ? "var(--brand, #0f766e)" : "var(--muted, #667)",
    fontWeight: active ? 700 : 500,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        role="tablist"
        aria-label="Tipo de contrato"
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        onKeyDown={(e) => {
          const destino = siguientePestana(MODOS, modo, e.key);
          if (!destino) return;
          e.preventDefault();
          go(destino as Modo);
          // Con índice móvil el foco no viaja solo: hay que llevarlo.
          document.getElementById(idPestana(BASE_CONTRATOS, destino))?.focus();
        }}
      >
        <button type="button" {...propsPestana(BASE_CONTRATOS, "inicio", modo)} style={navStyle(modo === "inicio")} onClick={() => go("inicio")}>Inicio</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "sie", modo)} style={navStyle(modo === "sie")} onClick={() => go("sie")}>Subasta Inversa Electrónica</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "cp", modo)} style={navStyle(modo === "cp")} onClick={() => go("cp")}>Comparación de Precios</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "mis-contratos", modo)} style={navStyle(modo === "mis-contratos")} onClick={() => go("mis-contratos")}>Mis contratos</button>
      </div>

      <div {...propsPanel(BASE_CONTRATOS, modo)}>

      {modo === "inicio" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 0" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>¿Qué tipo de contrato deseas generar?</h3>
            <p style={{ margin: "4px 0", fontSize: 13, color: "var(--muted, #667)" }}>Selecciona el tipo de procedimiento de selección para usar su proforma oficial.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Card icon={Gavel} title="Subasta Inversa Electrónica" desc="Proforma oficial para bienes y servicios comunes. Ley 32069." onClick={() => go("sie")} />
            <Card icon={ShoppingCart} title="Comparación de Precios" desc="Proforma para contrataciones directas por comparación de precios. Ley 32069." onClick={() => go("cp")} />
          </div>
        </div>
      ) : null}

      {modo === "sie" ? <ContratoSieForm key={loadKey} contratoId={contratoCargado} onSaved={() => setContratoCargado(null)} /> : null}
      {modo === "cp" ? <ContratoCpForm key={loadKey} contratoId={contratoCpCargado} onSaved={() => setContratoCpCargado(null)} /> : null}
      {modo === "mis-contratos" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ContratoSieList onLoad={handleLoad} />
          <div style={{ borderTop: "1px solid var(--line, #e2e4ea)", paddingTop: 12 }}>
            <ContratoCpList onLoad={handleLoadCp} />
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
