"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { documentSearchRequestSchema, type DocumentSearchInput } from "@/lib/document-search";
import { assistantProposalSchema, type AssistantProposal } from "@/lib/search-assistant";
import { searchSessionKey } from "@/lib/document-search-session";
import { OFFICIAL_CORPUS_TYPES } from "@/lib/official-corpus";

export function SearchAssistant({ownerId, onApply, destinations}: {ownerId:string; onApply?:(input:DocumentSearchInput)=>void; destinations?:{href:string;label:string}[]}) {
  const router=useRouter();
  const [open,setOpen]=useState(false), [text,setText]=useState("");
  const [proposal,setProposal]=useState<AssistantProposal|null>(null), [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function suggest() {
    setBusy(true);setError("");setProposal(null);
    try {
      const response=await fetch("/api/search/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,scope:onApply?"search":"global"})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || "No se pudo preparar la búsqueda.");
      setProposal(assistantProposalSchema.parse(data.proposal));
    } catch(e) {setError(e instanceof Error?e.message:"Vuelve a intentarlo.");} finally {setBusy(false);}
  }
  async function apply() {
    if(!proposal) return;
    const checked=documentSearchRequestSchema.safeParse(proposal.search);
    if(!checked.success) {setError("Revisa la consulta y los filtros antes de continuar.");return;}
    if(proposal.destination==="/busqueda") {
      if(onApply) onApply(checked.data);
      else {
        try { sessionStorage.setItem(searchSessionKey(ownerId,""),JSON.stringify({version:1,savedAt:Date.now(),input:checked.data,selected:[],scroll:0})); }
        catch {setError("No se pudo conservar la búsqueda en este navegador. Abre Búsqueda documental e inténtalo allí.");return;}
        window.dispatchEvent(new CustomEvent("ace:search-request",{detail:checked.data}));router.push("/busqueda");
      }
    } else if(proposal.destination==="/chat") {
      setBusy(true);
      try {
        const response=await fetch("/api/search/handoff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:text,filters:{}})});
        const data=await response.json();if(!response.ok) throw new Error(data.error || "No se pudo abrir la consulta.");
        router.push(`/chat?sessionId=${encodeURIComponent(data.sessionId)}`);
      } catch(e) {setError(e instanceof Error?e.message:"Reintenta.");setBusy(false);return;}
      setBusy(false);
    } else router.push(proposal.destination);
    setOpen(false);
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="secondaryButton searchAssistantTrigger">{onApply?<Sparkles size={17}/>:<Search size={17}/>} {onApply?"Ayúdame a buscar":"Buscar en ACE"}</button></DialogTrigger>
    <DialogContent title={onApply?"Ayúdame a buscar":"Buscar en ACE"} description="Describe lo que necesitas. Revisa la propuesta antes de continuar.">
      <div className="searchAssistantBody">
        <label htmlFor={onApply?"search-help-text":"global-help-text"}>¿Qué necesitas encontrar?</label>
        <textarea id={onApply?"search-help-text":"global-help-text"} rows={3} maxLength={500} value={text} onChange={e=>{setText(e.target.value);setProposal(null);}} placeholder={onApply?"Por ejemplo: opiniones de 2026 sobre garantías":"Por ejemplo: encontrar mis consultas guardadas"}/>
        <button className="primaryButton" type="button" onClick={()=>void suggest()} disabled={busy||text.trim().length<3}>{busy?"Preparando…":"Preparar propuesta"}</button>
        {error?<p role="alert">{error}</p>:null}
        {proposal?<section className="searchAssistantProposal" aria-live="polite">
          <strong>Propuesta para revisar</strong><p>{proposal.explanation}</p>
          {proposal.clarification?<p>{proposal.clarification} Puedes añadirlo arriba y preparar otra propuesta.</p>:null}
          {!onApply?<label>Destino<select value={proposal.destination} onChange={e=>setProposal({...proposal,destination:e.target.value as AssistantProposal["destination"]})}>{["/busqueda","/chat","/normas","/guardado","/historial","/archivo"].map(href=><option key={href} value={href}>{destinations?.find(item=>item.href===href)?.label ?? href.slice(1)}</option>)}</select></label>:null}
          {proposal.destination==="/busqueda"?<>
            <label>Consulta editable<input value={proposal.search.query} maxLength={500} onChange={e=>setProposal({...proposal,search:{...proposal.search,query:e.target.value}})}/></label>
            <label>Cómo buscar<select value={proposal.search.mode} onChange={e=>setProposal({...proposal,search:{...proposal.search,mode:e.target.value as DocumentSearchInput["mode"]}})}><option value="literal">Frase exacta o número</option><option value="all_words">Todas estas palabras</option><option value="semantic">Por significado</option></select></label>
            <label>Tipo<select value={proposal.search.filters.documentType ?? ""} onChange={e=>setProposal({...proposal,search:{...proposal.search,filters:{...proposal.search.filters,documentType:e.target.value}}})}><option value="">Todos los tipos</option>{OFFICIAL_CORPUS_TYPES.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label>Año expresamente indicado<input type="number" min={1900} max={2200} value={proposal.search.filters.year ?? ""} onChange={e=>setProposal({...proposal,search:{...proposal.search,filters:{...proposal.search.filters,year:e.target.value?Number(e.target.value):undefined}}})}/></label>
            <label>Artículo<input value={proposal.search.filters.article ?? ""} onChange={e=>setProposal({...proposal,search:{...proposal.search,filters:{...proposal.search.filters,article:e.target.value}}})}/></label>
            <p>Se reemplazarán los criterios actuales por esta propuesta. El régimen y la vigencia no se deducen automáticamente.</p>
          </>:<p>{proposal.destination==="/chat"?"Se abrirá una consulta privada con tu texto. La IA podrá consultar el corpus disponible.":"Se abrirá la sección elegida; tu texto no se añadirá a la dirección."}</p>}
          <button className="primaryButton" type="button" disabled={busy} onClick={()=>void apply()}>{proposal.destination==="/busqueda"?"Buscar con estos criterios":"Abrir esta sección"}</button>
        </section>:null}
        {!onApply?<nav aria-label="Accesos directos">{destinations?.map(item=><button className="secondaryButton" type="button" key={item.href} onClick={()=>{setOpen(false);router.push(item.href);}}>{item.label}</button>)}</nav>:null}
      </div>
    </DialogContent>
  </Dialog>;
}
