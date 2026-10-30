"use client";
import { useMemo,useState,useSyncExternalStore,type CSSProperties } from "react";
import { ArrowLeft,ArrowRight,BookOpen,Minimize2,Minus,Plus,Settings2 } from "lucide-react";
import { legalReadingBlocks,readingPreferences,type ReadingPreferences } from "@/lib/norm-reading";
import "./norm-article-reading.css";
const KEY="ace:norm-reading:1",EVENT="ace:norm-reading";
let memory:string|null=null;
function snapshot(){try{return memory??localStorage.getItem(KEY)??"";}catch{return memory??"";}}
function subscribe(notify:()=>void){
  const storage=()=>{memory=null;notify();};
  window.addEventListener("storage",storage);window.addEventListener(EVENT,notify);
  return()=>{window.removeEventListener("storage",storage);window.removeEventListener(EVENT,notify);};
}
type Adjacent={number:string;select:()=>void}|null;
export function NormArticleReading({content,documentTitle,focus,onFocus,previous,next}:{content:string;documentTitle:string;focus:boolean;onFocus:()=>void;previous:Adjacent;next:Adjacent}){
  const raw=useSyncExternalStore(subscribe,snapshot,()=>"");
  const preferences=useMemo(()=>readingPreferences(raw),[raw]);
  const blocks=useMemo(()=>legalReadingBlocks(content),[content]);
  const [continuous,setContinuous]=useState(false);
  function update(patch:Partial<ReadingPreferences>){
    memory=JSON.stringify({...preferences,...patch});
    try{localStorage.setItem(KEY,memory);}catch{/* Keep preferences in this tab. */}
    window.dispatchEvent(new Event(EVENT));
  }
  return <>
    <div className="normReadingControls tw" role="group" aria-label="Opciones de lectura">
      <div className="normReadingSize" role="group" aria-label="Tamaño del texto">
        <button type="button" aria-label="Reducir tamaño del texto" disabled={preferences.size<=16} onClick={()=>update({size:preferences.size-2})}><Minus size={16} aria-hidden/><span aria-hidden>A</span></button>
        <output aria-live="polite" aria-label="Tamaño actual">{preferences.size} px</output>
        <button type="button" aria-label="Aumentar tamaño del texto" disabled={preferences.size>=24} onClick={()=>update({size:preferences.size+2})}><span aria-hidden>A</span><Plus size={16} aria-hidden/></button>
      </div>
      <label className="normReadingFont"><span>Tipografía</span><select aria-label="Tipografía de lectura" value={preferences.font} onChange={e=>update({font:e.target.value as ReadingPreferences["font"]})}><option value="serif">Libro · Georgia</option><option value="sans">Inter</option></select></label>
      <details className="normReadingSettings"><summary aria-label="Más ajustes de lectura"><Settings2 size={17} aria-hidden/><span>Ajustes</span></summary><div>
        <label>Espaciado<select aria-label="Espaciado de lectura" value={preferences.spacing} onChange={e=>update({spacing:e.target.value as ReadingPreferences["spacing"]})}><option value="comfortable">Cómodo</option><option value="compact">Compacto</option></select></label>
        <label className="normReadingContinuous"><input type="checkbox" checked={continuous} onChange={e=>setContinuous(e.target.checked)}/>Ver texto continuo</label>
        <button type="button" onClick={()=>update({size:18,font:"serif",spacing:"comfortable"})}>Restablecer lectura</button>
      </div></details>
      <button type="button" id="norm-reader-focus" className="normFocusButton" aria-pressed={focus} onClick={onFocus}>{focus?<Minimize2 size={17} aria-hidden/>:<BookOpen size={17} aria-hidden/>}{focus?"Salir de lectura":"Vista de lectura"}</button>
    </div>
    <div className="normReadingSource"><span>Texto del documento</span><p>Comprueba el PDF para citar. La separación visual de párrafos no modifica el texto extraído.</p></div>
    <div className="normReadingProse" data-font={preferences.font} data-spacing={preferences.spacing} style={{"--norm-reader-size":`${preferences.size}px`} as CSSProperties} lang="es" aria-label={`Texto del artículo en ${documentTitle}`}>
      {(continuous?[content]:blocks).map((block,index)=><p key={index}>{block}</p>)}
    </div>
    <nav className="normReadingPagination" aria-label="Recorrer los artículos del índice actual">
      <button type="button" disabled={!previous} onClick={previous?.select}><ArrowLeft size={17} aria-hidden/><span>Anterior{previous?<strong>Artículo {previous.number}</strong>:null}</span></button>
      <button type="button" disabled={!next} onClick={next?.select}><span>Siguiente{next?<strong>Artículo {next.number}</strong>:null}</span><ArrowRight size={17} aria-hidden/></button>
    </nav>
  </>;
}
