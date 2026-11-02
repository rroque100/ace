"use client";
import {WorkNotesPanel} from "./work-notes-panel";

import { useState, useCallback } from "react";
import { FileText, Gavel, ShoppingCart } from "lucide-react";
import { ContratoSieForm } from "./contrato-sie-form";
import { ContratoSieList } from "./contrato-sie-list";
import { ContratoCpForm } from "./contrato-cp-form";
import { ContratoCpList } from "./contrato-cp-list";
import { idPestana, propsPanel, propsPestana, siguientePestana } from "@/lib/pestanas-accesibles";
import { cn } from "@/lib/utils";

type Modo = "inicio" | "sie" | "cp" | "mis-contratos";

/** Prefijo de los identificadores de esta lista de pestañas en la página. */
const BASE_CONTRATOS = "contratos";
const MODOS = ["inicio", "sie", "cp", "mis-contratos"] as const;

function Card({ icon: Icon, title, desc, onClick }: { icon: typeof FileText; title: string; desc: string; onClick: () => void }) {
  return (
    // El hover (borde marca + sombra) era un par de onMouseEnter/Leave en línea;
    // ahora son utilidades hover:. El título usaba var(--text) —token inexistente,
    // así que caía al gris fijo y se perdía en modo oscuro—; pasa a text-ink.
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[200px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-line bg-panel px-5 py-7 transition-[box-shadow,border-color] duration-200 hover:border-brand hover:shadow-[0_2px_12px_rgba(15,118,110,0.12)]"
    >
      <Icon size={32} className="text-brand" />
      <span className="text-sm font-bold text-ink">{title}</span>
      <span className="text-center text-[11.5px] leading-[1.4] text-muted">{desc}</span>
    </button>
  );
}

const PESTANA_BASE = "cursor-pointer rounded-full px-4 py-2 text-[13px]";
function clasePestana(active: boolean): string {
  return cn(
    PESTANA_BASE,
    active
      ? "border-[1.5px] border-brand bg-brand/[0.08] font-bold text-brand"
      : "border border-line font-medium text-muted",
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

  return (
    // `.tw` (el reset acotado) se aplica SOLO a los subárboles ya migrados
    // —pestañas, Inicio y la lista SIE—, no al root: los formularios SIE/CP y la
    // lista CP todavía usan estilos legacy y el reset de bordes/botones de `.tw`
    // los rompería. Se migran en un paso posterior y entonces subirá a la raíz.
    <div className="flex flex-col gap-3.5">
      <div
        role="tablist"
        aria-label="Tipo de contrato"
        className="tw flex flex-wrap gap-1.5"
        onKeyDown={(e) => {
          const destino = siguientePestana(MODOS, modo, e.key);
          if (!destino) return;
          e.preventDefault();
          go(destino as Modo);
          // Con índice móvil el foco no viaja solo: hay que llevarlo.
          document.getElementById(idPestana(BASE_CONTRATOS, destino))?.focus();
        }}
      >
        <button type="button" {...propsPestana(BASE_CONTRATOS, "inicio", modo)} className={clasePestana(modo === "inicio")} onClick={() => go("inicio")}>Inicio</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "sie", modo)} className={clasePestana(modo === "sie")} onClick={() => go("sie")}>Subasta Inversa Electrónica</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "cp", modo)} className={clasePestana(modo === "cp")} onClick={() => go("cp")}>Comparación de Precios</button>
        <button type="button" {...propsPestana(BASE_CONTRATOS, "mis-contratos", modo)} className={clasePestana(modo === "mis-contratos")} onClick={() => go("mis-contratos")}>Mis contratos</button>
      </div>

      <div {...propsPanel(BASE_CONTRATOS, modo)}>

      {modo === "inicio" ? (
        <div className="tw flex flex-col gap-4 py-3">
          <div>
            <h3 className="m-0 text-base font-bold text-ink">¿Qué tipo de contrato deseas generar?</h3>
            <p className="my-1 text-[13px] text-muted">Selecciona el tipo de procedimiento de selección para usar su proforma oficial.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Card icon={Gavel} title="Subasta Inversa Electrónica" desc="Proforma oficial para bienes y servicios comunes. Ley 32069." onClick={() => go("sie")} />
            <Card icon={ShoppingCart} title="Comparación de Precios" desc="Proforma para contrataciones directas por comparación de precios. Ley 32069." onClick={() => go("cp")} />
          </div>
        </div>
      ) : null}

      {modo === "sie" ? <WorkNotesPanel targetType="contrato_sie" targetId={contratoCargado}/> : <WorkNotesPanel targetType="contrato_cp" targetId={contratoCpCargado}/>}
      {modo === "sie" ? <ContratoSieForm key={loadKey} contratoId={contratoCargado} onSaved={() => setContratoCargado(null)} /> : null}
      {modo === "cp" ? <ContratoCpForm key={loadKey} contratoId={contratoCpCargado} onSaved={() => setContratoCpCargado(null)} /> : null}
      {modo === "mis-contratos" ? (
        <div className="flex flex-col gap-3">
          <div className="tw"><ContratoSieList onLoad={handleLoad} /></div>
          {/* cp-list todavía es legacy (no migrado): fuera de .tw y con el
              divisor en línea para no necesitar el reset. Pendiente de migrar. */}
          <div style={{ borderTop: "1px solid var(--line, #e2e4ea)", paddingTop: 12 }}>
            <ContratoCpList onLoad={handleLoadCp} />
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
