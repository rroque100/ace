"use client";
import dynamic from "next/dynamic";
import { buttonClasses } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { S } from "./workspace-assistants-estilos";
import { C } from "@/app/components/estilos-comunes";

const SearchAssistant = dynamic(()=>import("./search-assistant").then(m=>m.SearchAssistant), {
  ssr:false, loading:()=> <button className={buttonClasses({ variant: "secondary" })} disabled><Loader2 size={17} className="animate-spin" aria-hidden/> Abriendo búsqueda…</button>,
});
const MiYoWidget = dynamic(()=>import("./asistente/mi-yo-widget").then(m=>m.MiYoWidget), {
  ssr:false, loading:()=> <div className={S.aceAssistantWidget_workspaceAssistantLauncher}><button disabled aria-label="Abriendo asistente"><Loader2 className="animate-spin" size={22}/></button></div>,
});
export function WorkspaceSearch(props:{ownerId:string;destinations:{href:string;label:string}[]}) {
  const [activated,setActivated]=useState(false);
  return activated ? <SearchAssistant {...props} initialOpen/> : <button className={cn(buttonClasses({ variant: "secondary" }), C.searchAssistantTrigger)} type="button" onClick={()=>setActivated(true)}><Search size={17} aria-hidden/>Buscar en ACE</button>;
}
export function WorkspaceAssistant() {
  const [activated,setActivated]=useState(false);
  return activated ? <MiYoWidget initiallyOpen/> : <div className={S.aceAssistantWidget_workspaceAssistantLauncher}><button type="button" aria-label="Abrir Mi Yo" onClick={()=>setActivated(true)}><MessageCircle size={22} aria-hidden/></button></div>;
}
