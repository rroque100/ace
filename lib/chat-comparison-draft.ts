import {z} from "zod";
import {citedSourceNumbers} from "./chat-source-locations";
const schema=z.object({headers:z.array(z.string().trim().min(1).max(150)).min(2).max(4),rows:z.array(z.object({cells:z.array(z.string().trim().min(1).max(1200)).min(2).max(4),sources:z.array(z.union([z.number().int().positive(),z.string().regex(/^F[1-9]\d*$/).transform(value=>Number(value.slice(1)))])).min(1).max(8)})).min(1).max(12)});
/** Table formatting is built by the server; every header and cell is still audited. */
export function comparisonDraft(raw:string,sourceCount:number) {
 try {
  const parsed=schema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"")));
  const escape=(text:string)=>text.replace(/\|/g," · ").replace(/[\r\n]+/g," ");
  const rows=parsed.rows.filter(row=>row.cells.length===parsed.headers.length&&row.sources.every(source=>source<=sourceCount));
  if(!rows.length)return "No se pudo completar una comparación respaldada con las fuentes recuperadas.";
  return ["**Comparación**",`| ${parsed.headers.map(escape).join(" | ")} |`,`| ${parsed.headers.map(()=>"---").join(" | ")} |`,...rows.map(row=>{
   const present=new Set(citedSourceNumbers(row.cells.join(" "))),extra=[...new Set(row.sources)].filter(source=>!present.has(source));
   return `| ${row.cells.map((cell,index)=>escape(cell)+(index===row.cells.length-1&&extra.length?` ${extra.map(source=>`[F${source}]`).join(" ")}`:"")).join(" | ")} |`;
  })].join("\n");
 }catch{return "No se pudo completar el formato de comparación; no se publicó una tabla incompleta.";}
}
