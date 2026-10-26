"use client";
import {useState} from "react";
import {nextClarification} from "@/lib/chat-experience";
import type {EvidenceReview} from "@/lib/chat-evidence-audit";
import type {CaseContext} from "@/lib/chat-case-context";
export function ChatClarification({review,context,disabled,onApply}:{review?:EvidenceReview;context:CaseContext;disabled:boolean;onApply:(context:CaseContext)=>void}) {
 const field=nextClarification(review);const [value,setValue]=useState("");if(!field)return null;
 return <details className="chatClarification"><summary>Precisar un dato para revisar mi caso</summary><form onSubmit={event=>{event.preventDefault();if(value.trim())onApply({...context,[field.key]:value.trim()});}}><label>{field.label}<input maxLength={field.key==="facts"?6000:field.key==="dates"?1000:field.key==="regime"?200:400} value={value} onChange={event=>setValue(event.target.value)}/></label><small>{field.hint}</small><button className="secondaryButton" disabled={disabled||!value.trim()}>Revisar con este dato</button></form></details>;
}
