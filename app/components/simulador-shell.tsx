"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Library, History } from "lucide-react";
import { BalotariosOece } from "./balotarios-oece";
import type { VistaSimulador } from "./balotarios/modulo";
import { leerNavegacion, urlNavegacion, type NavegacionSimulador, type SeccionSimulador } from "@/lib/simulador-navegacion";
import { ResumenDelBanco } from "./simulador-resumen";

const ExamWorkspace = dynamic(() => import("./exam-workspace").then(m => m.ExamWorkspace), { loading: () => <p role="status" className="p-4 text-muted">Abriendo el banco de preguntas…</p> });
const sections = [
  { id: "balotarios", label: "Balotarios OECE", icon: BookOpen },
  { id: "banco", label: "Banco de preguntas", icon: Library },
  { id: "historial", label: "Historial", icon: History },
] as const;
type Props = { isAdmin: boolean; storageScope: string; centerEnabled: boolean };

export function SimuladorShell(props: Props) {
  const [nav, setNav] = useState<NavegacionSimulador>({ seccion: "balotarios", modo: "practicar" });
  const [openedBank, setOpenedBank] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      const next = leerNavegacion(new URL(location.href).searchParams);
      setNav(next);
      if (next.seccion === "banco") setOpenedBank(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function navigate(next: NavegacionSimulador) {
    setNav(next);
    if (next.seccion === "banco") setOpenedBank(true);
    history.pushState(null, "", urlNavegacion(new URL(location.href), next));
  }
  function section(seccion: SeccionSimulador) { navigate({ seccion, modo: nav.modo }); }
  function go(vista: VistaSimulador) {
    navigate({ seccion: vista === "resultados" ? "historial" : "balotarios", modo: vista === "resultados" ? nav.modo : vista });
  }
  function openBank(attempt?: string) { navigate({ seccion: "banco", modo: nav.modo, attempt }); }

  return <div className="tw mx-auto min-w-0 max-w-5xl space-y-6 pb-6">
    <p className="max-w-3xl text-base leading-relaxed text-muted">Elige una colección para practicar o rendir un examen. Consulta tus intentos en Historial.</p>
    <div ref={tabs} role="tablist" aria-label="Secciones del simulador" className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-panel p-1" onKeyDown={e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const index = sections.findIndex(i => i.id === nav.seccion);
      const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3;
      section(sections[next].id);
      tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    }}>
      {sections.map(({ id, label, icon: Icon }) => <button key={id} id={`tab-${id}`} type="button" role="tab" tabIndex={nav.seccion === id ? 0 : -1} aria-selected={nav.seccion === id} aria-controls="panel-simulador" onClick={() => section(id)} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-12 sm:flex-row sm:gap-2 ${nav.seccion === id ? "bg-brand-soft text-brand-dark" : "text-muted hover:text-ink"}`}><Icon size={18} className="shrink-0" aria-hidden /><span>{label}</span></button>)}
    </div>
    <section role="tabpanel" id="panel-simulador" aria-labelledby={`tab-${nav.seccion}`}>
      <div hidden={nav.seccion === "banco"}><BalotariosOece key={props.storageScope} {...props} vista={nav.seccion === "historial" ? "resultados" : nav.modo} onVista={go} onBanco={openBank} /></div>
      {openedBank && <div hidden={nav.seccion !== "banco"} className="space-y-6"><ResumenDelBanco activo={nav.seccion === "banco"} /><ExamWorkspace {...props} reviewAttemptId={nav.attempt} /></div>}
    </section>
  </div>;
}
