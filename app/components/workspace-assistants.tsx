"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2, MessageCircle, Search } from "lucide-react";

const SearchAssistant = dynamic(()=>import("./search-assistant").then(m=>m.SearchAssistant), {
  ssr:false, loading:()=> <button className="secondaryButton" disabled><Loader2 size={17} className="animate-spin" aria-hidden/> Abriendo búsqueda…</button>,
});
const MiYoWidget = dynamic(()=>import("./asistente/mi-yo-widget").then(m=>m.MiYoWidget), {
  ssr:false, loading:()=> <div className="aceAssistantWidget workspaceAssistantLauncher"><button disabled aria-label="Abriendo asistente"><Loader2 className="animate-spin" size={22}/></button></div>,
});
export function WorkspaceSearch(props:{ownerId:string;destinations:{href:string;label:string}[]}) {
  const [activated,setActivated]=useState(false);
  return activated ? <SearchAssistant {...props} initialOpen/> : <button className="secondaryButton searchAssistantTrigger" type="button" onClick={()=>setActivated(true)}><Search size={17} aria-hidden/>Buscar en ACE</button>;
}
export function WorkspaceAssistant() {
  const [activated,setActivated]=useState(false);
  return activated ? <MiYoWidget initiallyOpen/> : <div className="aceAssistantWidget workspaceAssistantLauncher"><button type="button" aria-label="Abrir Mi Yo" onClick={()=>setActivated(true)}><MessageCircle size={22} aria-hidden/></button></div>;
}
