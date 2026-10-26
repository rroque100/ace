import {supabaseRest} from "./supabase-server";
import {loadNormativeRows} from "./normative-server";
import {documentaryDates} from "./search-document-metadata";
export type TextUnit={id:string;text:string;pageStart:number|null;pageEnd:number|null};
export type TextChange={before:TextUnit[];after:TextUnit[]};
const key=(unit:TextUnit)=>unit.text.replace(/\s+/g," ").trim();
/** Ordered unique anchors. Unmatched regions are reported in full, never discarded. */
export function compareTextUnits(a:TextUnit[],b:TextUnit[]) {
 const changes:TextChange[]=[];let unchanged=0;
 const ranges= [{a0:0,a1:a.length,b0:0,b1:b.length}];
 while(ranges.length){const range=ranges.pop()!;let {a0,a1,b0,b1}=range;
  while(a0<a1&&b0<b1&&key(a[a0])===key(b[b0])){unchanged++;a0++;b0++;}
  while(a0<a1&&b0<b1&&key(a[a1-1])===key(b[b1-1])){unchanged++;a1--;b1--;}
  if(a0===a1&&b0===b1)continue;
  const mapA=new Map<string,number[]>(),mapB=new Map<string,number[]>();
  for(let i=a0;i<a1;i++)mapA.set(key(a[i]),[...(mapA.get(key(a[i]))??[]),i]);
  for(let i=b0;i<b1;i++)mapB.set(key(b[i]),[...(mapB.get(key(b[i]))??[]),i]);
  const pairs=[...mapA].filter(([text,positions])=>positions.length===1&&mapB.get(text)?.length===1).map(([text,positions])=>[positions[0],mapB.get(text)![0]]).sort((x,y)=>x[0]-y[0]);
  if(!pairs.length){changes.push({before:a.slice(a0,a1),after:b.slice(b0,b1)});continue;}
  // Longest increasing sequence of B positions gives non-crossing anchors.
  const tails:number[]=[], previous:number[]=Array(pairs.length).fill(-1);
  pairs.forEach((pair,i)=>{let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>1;if(pairs[tails[mid]][1]<pair[1])lo=mid+1;else hi=mid;}previous[i]=lo?tails[lo-1]:-1;tails[lo]=i;});
  const anchors:number[][]=[];for(let i=tails.at(-1)??-1;i>=0;i=previous[i])anchors.push(pairs[i]);anchors.reverse();
  const pieces:Array<{a0:number;a1:number;b0:number;b1:number}>=[];
  for(const [x,y] of anchors){pieces.push({a0,a1:x,b0,b1:y});unchanged++;a0=x+1;b0=y+1;}pieces.push({a0,a1,b0,b1});
  ranges.push(...pieces.reverse());
 }
 return {changes,unchanged};
}
async function readDocument(id:string) {
 const [doc]=await supabaseRest<Array<{id:string;title:string;metadata:Record<string,unknown>}>>(`documents?id=eq.${id}&es_institucional=eq.true&status=eq.indexed&select=id,title,metadata`);
 if(!doc)throw Error("Selecciona dos documentos institucionales indexados.");
 const chunks=await loadNormativeRows<{id:string;content:string;chunk_index:number;page_start:number|null;page_end:number|null}>(`document_chunks?document_id=eq.${id}&select=id,content,chunk_index,page_start,page_end`);
 chunks.sort((a,b)=>a.chunk_index-b.chunk_index||a.id.localeCompare(b.id));
 if(!chunks.length)throw Error("Uno de los documentos no tiene texto extraído disponible.");
 const units=chunks.map(row=>({id:row.id,text:row.content,pageStart:row.page_start,pageEnd:row.page_end}));
 return {id:doc.id,title:doc.title,version:documentaryDates(doc.metadata).version,units};
}
export async function compareDocumentTexts(aId:string,bId:string) {
 if(aId===bId)throw Error("Selecciona dos documentos distintos.");
 const [a,b]=await Promise.all([readDocument(aId),readDocument(bId)]);
 if([...a.units,...b.units].reduce((sum,unit)=>sum+unit.text.length,0)>1500000)throw Error("El texto supera el límite de comparación de esta solicitud. No se comparó una selección parcial.");
 const diff=compareTextUnits(a.units,b.units);
 const result={kind:"extracted-text" as const,scope:"Todo el texto indexado disponible de ambos documentos; no certifica que la extracción cubra todo el PDF.",completeAvailableText:true,a:{id:a.id,title:a.title,version:a.version,units:a.units.length},b:{id:b.id,title:b.title,version:b.version,units:b.units.length},unchangedUnits:diff.unchanged,changes:diff.changes,warnings:["La alineación se realiza por bloques de texto, no declara efectos jurídicos ni equivalencia de artículos.","Encabezados, OCR y diferencias de fragmentación pueden producir diferencias técnicas. Comprueba el PDF."]};
 if(Buffer.byteLength(JSON.stringify(result))>3500000)throw Error("Las diferencias superan el límite de respuesta. No se publicó una comparación incompleta.");
 return result;
}
