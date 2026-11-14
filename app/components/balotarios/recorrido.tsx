"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { barajarPreguntas, nivelBalotario, type IntentoBalotario, type PreguntaBalotario } from "@/lib/balotarios-policy";
import { catalogoBalotarios } from "@/lib/balotarios-catalogo";
import { Pregunta, boton, campo } from "./pregunta";
export const reloj = (s:number) => [Math.floor(s/3600), Math.floor(s%3600/60), s%60].map(n=>String(n).padStart(2,"0")).join(":");
export function Practica({catalogo,repaso,onReset}:{catalogo:typeof catalogoBalotarios;repaso:PreguntaBalotario[]|null;onReset:()=>void}) {
  const [bal,setBal]=useState(1); const [index,setIndex]=useState(0); const [answers,setAnswers]=useState<Record<string,string>>({});
  const [sequence,setSequence]=useState<PreguntaBalotario[]|null>(null); const [reveal,setReveal]=useState(false);
  const source=repaso??catalogo.find(b=>b.balotario===bal)!.preguntas; const qs=sequence??source; const q=qs[index];
  if(!q) return <p className="rounded-xl bg-success-soft p-5 text-success">No hay errores u omisiones que repasar.<button className={`${boton} ml-3`} onClick={onReset}>Volver a colecciones</button></p>;
  return <section className="space-y-4" aria-label="Práctica sin tiempo">
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-panel p-4"><label className="min-w-40 flex-1 text-sm font-medium text-ink">{repaso?"Repaso de errores":"Colección"}<select disabled={!!repaso} value={bal} className={campo} onChange={e=>{setBal(Number(e.target.value));setIndex(0);setSequence(null);setAnswers({});setReveal(false);}}>{catalogo.map(b=><option key={b.balotario} value={b.balotario}>Balotario {b.balotario} · {b.preguntas.length} preguntas</option>)}</select></label><button type="button" className={boton} onClick={()=>{setSequence(barajarPreguntas(source));setIndex(0);setAnswers({});setReveal(false);}}>Mezclar y reiniciar</button>{repaso&&<button className={boton} onClick={onReset}>Todas las preguntas</button>}</div>
    <p className="text-base text-muted">Sin tiempo. Responde para comprobar tu elección; la clave comienza oculta.</p>
    <Pregunta q={q} position={index+1} total={qs.length} answer={answers[q.id]} reveal={reveal||!!answers[q.id]} locked={reveal||!!answers[q.id]} onAnswer={v=>setAnswers(a=>({...a,[q.id]:v}))}/>
    <div className="flex flex-wrap gap-2"><button type="button" className={boton} onClick={()=>setReveal(v=>!v)}>{reveal?"Ocultar clave":"Ver respuesta de esta pregunta"}</button><button type="button" className={boton} onClick={()=>{setAnswers(a=>{const n={...a};delete n[q.id];return n;});setReveal(false);}}><RotateCcw size={16} aria-hidden/>Intentar otra vez</button></div>
    <Navegacion index={index} total={qs.length} onGo={n=>{setIndex(n);setReveal(false);}}/>
  </section>;
}
export function Navegacion({index,total,onGo}:{index:number;total:number;onGo:(n:number)=>void}) {
  return <nav aria-label="Navegar preguntas" className="flex flex-wrap items-center justify-between gap-3"><button type="button" className={boton} disabled={index===0} onClick={()=>onGo(index-1)}><ChevronLeft size={18} aria-hidden/>Anterior</button><span className="text-sm text-muted">{index+1} / {total}</span><button type="button" className={boton} disabled={index===total-1} onClick={()=>onGo(index+1)}>Siguiente<ChevronRight size={18} aria-hidden/></button></nav>;
}
export function Revision({intento:t,onVolver,onRepasar}:{intento:IntentoBalotario;onVolver:()=>void;onRepasar:()=>void}) {
  const [filter,setFilter]=useState("todas"); const [index,setIndex]=useState(0); const r=t.result;
  const qs=t.questions.filter(q=>filter==="todas"||filter==="incorrectas"&&!!t.answers[q.id]&&t.answers[q.id]!==q.correcta||filter==="omitidas"&&!t.answers[q.id]);
  const q=qs[Math.min(index,qs.length-1)];
  return <section className="space-y-4"><button type="button" className={boton} onClick={onVolver}>Volver a Mis resultados</button><div className="rounded-2xl border border-line bg-panel p-5"><h2 className="text-xl font-semibold text-ink">Resultado · Balotario {t.balotario}</h2><p className="mt-3 text-3xl font-semibold text-brand">{r?.correct}/{r?.total} <span className="text-base text-muted">{nivelBalotario(r?.correct??0,r?.total)}</span></p><p className="mt-3 text-base text-muted">{r?.correct} correctas · {r?.incorrect} incorrectas · {r?.omitted} omitidas · {reloj(r?.seconds??0)}</p><p className="mt-2 text-sm text-muted">{t.questions.filter(q=>q.revisada).length} preguntas con revisión de fuente al iniciar este intento.</p><button type="button" className={`${boton} mt-4`} onClick={onRepasar}>Repasar falladas y omitidas</button></div><label className="block text-sm font-medium text-ink">Mostrar preguntas<select className={campo} value={filter} onChange={e=>{setFilter(e.target.value);setIndex(0);}}><option value="todas">Todas</option><option value="incorrectas">Incorrectas</option><option value="omitidas">Sin responder</option></select></label>{q?<><Pregunta q={q} position={Math.min(index,qs.length-1)+1} total={qs.length} answer={t.answers[q.id]} reveal locked onAnswer={()=>{}}/><Navegacion index={Math.min(index,qs.length-1)} total={qs.length} onGo={setIndex}/></>:<p className="rounded-xl bg-success-soft p-5 text-success">No hay preguntas con este filtro.</p>}</section>;
}
