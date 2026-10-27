import {expect,it} from "vitest";
import {preserveSelectedSources,recoverSelectedSources} from "@/lib/chat-source-selection";
import type {LegalSource} from "@/lib/legal-chat";
const source=(documentId:string,chunkId=documentId)=>({documentId,chunkId}) as LegalSource;
it("reserva todas las fuentes iniciales antes de las añadidas y distingue procedencia",()=>{
 const rows=preserveSelectedSources([source("a"),source("b")],[source("x"),source("a")],["a","b"],true,3);
 expect(rows.map(row=>row.documentId)).toEqual(["a","b","x"]);
 expect(rows.map(row=>row.selectionOrigin)).toEqual(["selected","selected","additional"]);
});
it("no amplía sin permiso y no duplica pasajes",()=>{expect(preserveSelectedSources([source("a")],[source("x"),source("a")],["a"],false)).toHaveLength(1);});
it("ocho documentos iniciales no consumen el lugar de las fuentes añadidas",()=>{const ids=Array.from({length:8},(_,i)=>String(i));const selected=ids.flatMap(id=>[source(id,id+"a"),source(id,id+"b")]);const result=preserveSelectedSources(selected,[source("extra")],ids,true);expect(new Set(result.map(row=>row.documentId)).size).toBe(9);expect(result.some(row=>row.documentId==="extra")).toBe(true);});
it("distingue falta de pasajes de fallo y rechaza pasajes de otro documento",async()=>{
 const rows=await recoverSelectedSources(["a","b","c","a"],async id=>{if(id==="c")throw Error("offline");return {sources:id==="a"?[source("a")]:[source("x")]};});
 expect(rows.sources.map(row=>row.documentId)).toEqual(["a"]);expect(rows.missing).toEqual(["b"]);expect(rows.failed).toEqual(["c"]);
});
