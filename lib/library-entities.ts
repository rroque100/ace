/** Extract explicitly labelled entities only. A label is evidence of a name, never proof of its RUC. */
export function detectLibraryEntity(text:string,type:string){
 const head=text.slice(0,10000);const match=head.match(/\b(Solicitante|Consultante|Entidad(?:\s+Contratante)?)\s*:\s*([\s\S]{3,350}?)(?=\s+(?:Asunto|Referencia|Objeto|Proceso|Procedimiento)\s*:|\n|$)/i);
 if(!match)return null;const ruc=match[2].match(/\bRUC\s*[:N.°º-]*\s*(\d{11})\b/i)?.[1]??null;
 const name=match[2].replace(/\bRUC\s*[:N.°º-]*\s*\d{11}\b/i,"").replace(/\s+/g," ").trim();if(name.length<3||name.length>250)return null;
 const key=type==="opinion"||/solicitante|consultante/i.test(match[1])?"requestingEntity":"contractingEntity";
 return {key,name,ruc,rawEvidence:match[0]};
}
