import type { LegalSource } from "./legal-chat";

export async function recoverSelectedSources(ids:string[], retrieve:(id:string)=>Promise<{sources:LegalSource[]}>) {
  const unique=[...new Set(ids)];
  const results=await Promise.allSettled(unique.map(retrieve));
  const sources:LegalSource[]=[]; const missing:string[]=[]; const failed:string[]=[];
  results.forEach((result,index)=>{
    if(result.status==="rejected") {failed.push(unique[index]);return;}
    const own=result.value.sources.filter(source=>source.documentId===unique[index]);
    if(!own.length)missing.push(unique[index]);
    sources.push(...own);
  });
  return {sources,missing,failed};
}

/** Reserve one recovered passage per selected document before adding other evidence. */
export function preserveSelectedSources(selected:LegalSource[], additional:LegalSource[], ids:string[], expand:boolean, limit=16):LegalSource[] {
  const wanted=new Set(ids); const result:LegalSource[]=[]; const chunks=new Set<string>();
  if(wanted.size>limit)throw Error("La selección supera el límite de fuentes; no se omitirá silenciosamente un documento.");
  const add=(source:LegalSource)=>{if(chunks.has(source.chunkId)||result.length>=limit)return;chunks.add(source.chunkId);result.push({...source,selectionOrigin:wanted.has(source.documentId)?"selected":"additional"});};
  for(const id of wanted){const source=selected.find(row=>row.documentId===id);if(source)add(source);}
  const pool=expand?[...additional.filter(source=>!wanted.has(source.documentId)),...selected,...additional]:[...selected,...additional];
  for(const source of pool)if(expand||wanted.has(source.documentId))add(source);
  return result;
}
