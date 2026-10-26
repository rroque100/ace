"use client";
import {useEffect,useRef,useState} from "react";
import {chatContinuityKey,readChatSnapshot} from "@/lib/chat-continuity";
export function useChatContinuity({owner,session,loading,question,onRestore,preferInitial}:{owner:string;session:string|null;loading:boolean;question:string;onRestore:(text:string)=>void;preferInitial:boolean}) {
 const [notice,setNotice]=useState("");const latest=useRef(question);useEffect(()=>{latest.current=question;},[question]);
 const restore=useRef(onRestore);useEffect(()=>{restore.current=onRestore;},[onRestore]);const previousKey=useRef<string|null>(null);const position=useRef(0);
 useEffect(()=>{
  if(!owner||loading)return;
  const key=chatContinuityKey(owner,session);let storage:Storage;
  try{storage=window.sessionStorage;const value=readChatSnapshot(storage.getItem(key));
   if(!previousKey.current&&value){if(!preferInitial)restore.current(value.question);position.current=value.scroll;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:value.scroll,behavior:"instant"})));queueMicrotask(()=>setNotice(value.question?"Borrador recuperado en esta pestaña.":""));}
   if(previousKey.current&&previousKey.current!==key)storage.removeItem(previousKey.current);
   previousKey.current=key;
  }catch{queueMicrotask(()=>setNotice("Este navegador no pudo conservar el borrador. La conversación guardada seguirá disponible en el historial."));return;}
  const save=()=>{try{storage.setItem(key,JSON.stringify({version:1,updatedAt:Date.now(),question:latest.current,scroll:position.current}));}catch{setNotice("No se pudo conservar el borrador en esta pestaña.");}};
  const scroll=()=>{position.current=window.scrollY;};
  window.addEventListener("scroll",scroll,{passive:true});window.addEventListener("pagehide",save);const timer=window.setInterval(save,1500);
  return()=>{save();clearInterval(timer);window.removeEventListener("scroll",scroll);window.removeEventListener("pagehide",save);};
 },[owner,session,loading,preferInitial]);
 useEffect(()=>{if(!owner||loading||!previousKey.current)return;const timer=setTimeout(()=>{try{sessionStorage.setItem(previousKey.current!,JSON.stringify({version:1,updatedAt:Date.now(),question,scroll:position.current}));}catch{}},250);return()=>clearTimeout(timer);},[owner,loading,question]);
 return {notice,clear:()=>{setNotice("");if(owner)try{sessionStorage.removeItem(chatContinuityKey(owner,session));sessionStorage.removeItem(chatContinuityKey(owner,null));}catch{}latest.current="";position.current=0;}};
}
