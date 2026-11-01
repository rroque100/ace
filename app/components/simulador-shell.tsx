"use client";

import { useState } from "react";
import { ExamWorkspace } from "./exam-workspace";
import { BalotariosOece } from "./balotarios-oece";

// Dos vistas dentro del Simulador: el examen gobernado de siempre y el
// cuestionario de estudio de los balotarios. Se mantienen ambas montadas
// (se ocultan con `hidden`) para no perder el cronómetro ni el intento en
// curso del examen al cambiar de pestaña.
type Props = { isAdmin: boolean; storageScope: string; centerEnabled: boolean };

export function SimuladorShell(props: Props) {
  const [vista, setVista] = useState<"examen" | "balotarios">("examen");
  return (
    <div className="tw min-w-0">
      <div role="tablist" aria-label="Secciones del simulador" className="mb-5 flex flex-wrap gap-2">
        <TabBtn activo={vista === "examen"} onClick={() => setVista("examen")}>
          Simulador de examen
        </TabBtn>
        <TabBtn activo={vista === "balotarios"} onClick={() => setVista("balotarios")}>
          Balotarios OECE
        </TabBtn>
      </div>
      <div className={vista === "examen" ? undefined : "hidden"}>
        <ExamWorkspace {...props} />
      </div>
      <div className={vista === "balotarios" ? undefined : "hidden"}>
        <BalotariosOece />
      </div>
    </div>
  );
}

function TabBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
        activo
          ? "border-brand bg-brand-soft text-brand-dark"
          : "border-line bg-panel text-muted hover:border-brand hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
