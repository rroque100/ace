"use client";
import { useCallback, useEffect, useState } from "react";
import { catalogoBalotarios } from "@/lib/balotarios-catalogo";
import type { IntentoBalotario, PreguntaBalotario } from "@/lib/balotarios-policy";
import { useBalotario } from "./use-balotario";
import { boton, primario } from "./pregunta";
import { Resultados } from "./resultados";
import { RevisionEditorial, type ReporteEditorial } from "./editorial";
import { Practica, Revision } from "./recorrido";
import { Examen } from "./examen";
export type VistaSimulador = "practicar" | "examen" | "resultados";
export function BalotariosOece({ storageScope, isAdmin, vista, onVista, onBanco }: { storageScope: string; isAdmin: boolean; vista: VistaSimulador; onVista: (v:VistaSimulador)=>void; onBanco:(id?:string)=>void }) {
  const remote = useBalotario(storageScope);
  const [catalogo,setCatalogo]=useState(catalogoBalotarios);
  const [catalogError,setCatalogError]=useState("");
  const [reports,setReports]=useState<ReporteEditorial[]>([]);
  const [loadingResult,setLoadingResult]=useState(false);
  const [resultError,setResultError]=useState("");
  const [review,setReview]=useState<IntentoBalotario|null>(null);
  const [repaso,setRepaso]=useState<PreguntaBalotario[]|null>(null);
  const cargarCatalogo=useCallback(async()=>{try{const r=await fetch("/api/balotarios/contenido",{cache:"no-store"});const x=await r.json();if(x.catalogo)setCatalogo(x.catalogo);setReports(x.reports??[]);setCatalogError(x.error??"");}catch{setCatalogError("No se pudieron actualizar las revisiones. Se muestra la colección importada.");}},[]);
  useEffect(()=>{void Promise.resolve().then(cargarCatalogo);},[cargarCatalogo]);
  const verResultados = () => {setReview(null);onVista("resultados");};
  const repasar=(t:IntentoBalotario)=>{setReview(null);setRepaso(t.questions.filter(q=>t.answers[q.id]!==q.correcta));onVista("practicar");};
  const abrirResultado=async(t:IntentoBalotario,repasarErrores=false)=>{
    setLoadingResult(true);setResultError("");
    try {const r=await fetch(`/api/balotarios?id=${encodeURIComponent(t.id)}`,{cache:"no-store"});const x=await r.json();if(!r.ok)throw Error(x.error);if(repasarErrores)repasar(x.attempt);else setReview(x.attempt);}
    catch(e){setResultError((e as Error).message);}finally{setLoadingResult(false);}
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-brand">Balotarios de preparación</p><p className="mt-1 text-sm text-muted">5 colecciones · 360 preguntas · entrenamiento independiente</p></div><button type="button" onClick={()=>onBanco()} className={boton}>Usar banco revisado</button></div>
    {(remote.error || catalogError) && <div role="alert" className="rounded-xl border border-warning bg-warning-soft p-4 text-sm leading-relaxed text-warning"><p>{remote.error || catalogError}</p><button type="button" className={`${boton} mt-3`} onClick={()=>void remote.reload().then(()=>remote.retry())}>Reintentar conexión</button></div>}
    {loadingResult&&<p role="status" className="text-muted">Abriendo el resultado y su versión de preguntas…</p>}{resultError&&<p role="alert" className="text-danger">{resultError}</p>}
    {remote.active?.state==="active" && vista!=="examen" && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft p-4"><p className="font-medium text-ink">Tienes un examen de Balotario {remote.active.balotario} en curso. El tiempo sigue corriendo.</p><button className={primario} onClick={()=>onVista("examen")}>Continuar examen</button></div>}
    {vista==="practicar" && <><Practica key={repaso?.map(q=>q.id).join(",")??"catalogo"} catalogo={catalogo} repaso={repaso} onReset={()=>setRepaso(null)}/>{isAdmin && <RevisionEditorial preguntas={catalogo.flatMap(b=>b.preguntas)} reports={reports} onActualizado={()=>void cargarCatalogo()}/>}</>}
    <div hidden={vista!=="examen"}><Examen remoto={remote} onResultados={verResultados} onRepasar={()=>remote.active&&repasar(remote.active)}/></div>
    {vista==="resultados" && (review ? <Revision intento={review} onVolver={()=>setReview(null)} onRepasar={()=>repasar(review)}/> : <Resultados history={remote.history} onReview={t=>{if(!loadingResult)void abrirResultado(t);}} onBank={id=>onBanco(id)} onPracticeErrors={t=>{if(!loadingResult)void abrirResultado(t,true);}}/>)}
  </div>;
}
