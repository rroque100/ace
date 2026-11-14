"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Clock, History } from "lucide-react";
import { BalotariosOece } from "./balotarios-oece";
import type { VistaSimulador } from "./balotarios/modulo";
import { boton } from "./balotarios/pregunta";
const ExamWorkspace = dynamic(() => import("./exam-workspace").then(m=>m.ExamWorkspace), { loading:()=> <p role="status" className="p-4 text-muted">Abriendo el banco revisado…</p> });
type Props={isAdmin:boolean;storageScope:string;centerEnabled:boolean};
export function SimuladorShell(props:Props) {
  const [view,setView]=useState<VistaSimulador>("practicar");
  const [bank,setBank]=useState(false); const [openedBank,setOpenedBank]=useState(false);
  const [attempt,setAttempt]=useState<string|undefined>(); const tabs=useRef<HTMLDivElement>(null);
  function go(v:VistaSimulador) {setView(v);setBank(false);const u=new URL(location.href);u.searchParams.set("vista",v);u.searchParams.delete("attempt");u.hash="";history.pushState(null,"",u);}
  useEffect(()=>{
    const read=()=>{const u=new URL(location.href);const v=u.searchParams.get("vista");setView(v==="examen"||v==="resultados"?v:"practicar");const id=u.searchParams.get("attempt");if(id){setAttempt(id);setBank(true);setOpenedBank(true);}else setBank(false);};
    read();window.addEventListener("popstate",read);return()=>window.removeEventListener("popstate",read);
  },[]);
  function openBank(id?:string){setAttempt(id);setBank(true);setOpenedBank(true);}
  const items=[{id:"practicar" as const,label:"Practicar",icon:BookOpen},{id:"examen" as const,label:"Rendir examen",icon:Clock},{id:"resultados" as const,label:"Mis resultados",icon:History}];
  return <div className="tw mx-auto min-w-0 max-w-5xl pb-6">
    <p className="mb-5 max-w-3xl text-base leading-relaxed text-muted">Practica, rinde un examen y revisa tu avance. Elige los cinco Balotarios OECE o las sesiones del banco con fuentes revisadas.</p>
    <div ref={tabs} role="tablist" aria-label="Secciones del simulador" className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-panel p-1" onKeyDown={e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const index=items.findIndex(i=>i.id===view);const n=e.key==="Home"?0:e.key==="End"?2:(index+(e.key==="ArrowRight"?1:2))%3;go(items[n].id);tabs.current?.querySelectorAll<HTMLButtonElement>("button")[n]?.focus();}}>
      {items.map(({id,label,icon:Icon})=><button key={id} id={`tab-${id}`} type="button" role="tab" tabIndex={view===id?0:-1} aria-selected={view===id} aria-controls="panel-simulador" onClick={()=>go(id)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand sm:flex-row sm:gap-2 ${view===id?"bg-brand-soft text-brand-dark":"text-muted hover:text-ink"}`}><Icon size={18} aria-hidden/>{label}</button>)}
    </div>
    <section role="tabpanel" id="panel-simulador" aria-labelledby={`tab-${view}`}>
      <div hidden={bank}><BalotariosOece key={props.storageScope} {...props} vista={view} onVista={go} onBanco={openBank}/></div>
      {openedBank&&<div hidden={!bank} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-info-soft p-4"><p className="text-sm text-info">Banco revisado · sesiones con fuente y revisión editorial</p><button type="button" className={boton} onClick={()=>go(view)}>Volver a Balotarios OECE</button><button type="button" className={boton} onClick={()=>go("resultados")}>Mis resultados de todas las colecciones</button></div><ExamWorkspace {...props} reviewAttemptId={attempt}/></div>}
    </section>
  </div>;
}
