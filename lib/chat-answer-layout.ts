import { citedSourceNumbers } from "./chat-source-locations";

export type LayoutClaim = { id: number; text: string; markers: number[] };
type Node = { kind:"heading"; text:string } | { kind:"text"; ids:number[] } | { kind:"table"; headers:string[]; rows:Array<{id:number;cells:string[]}> };
const neutralHeadings=new Set(["respuesta","respuesta directa","fundamento","fundamento legal","explicación","en la práctica","requisitos","pasos","procedimiento","comparación","resumen","condiciones","excepciones","condiciones y excepciones","riesgos","conclusión","aplicación al caso","información faltante y límites","fuentes y vigencia"]);
const separator=(line:string)=>/^\|?[\s:|-]+\|?$/.test(line);
const cells=(line:string)=>line.replace(/^\|/,"").replace(/\|$/,"").split("|").map(cell=>cell.trim());

/** One parser for the reviewer and renderer: no unchecked table headers or headings. */
export function analyzeAnswerLayout(answer:string) {
 const claims:LayoutClaim[]=[],nodes:Node[]=[];
 const add=(text:string)=>{const id=claims.length+1;claims.push({id,text,markers:citedSourceNumbers(text)});return id;};
 const lines=answer.split(/\n+/).map(line=>line.trim()).filter(Boolean);
 for(let index=0;index<lines.length;index++) {
  const line=lines[index];
  if(line.startsWith("|")&&index+1<lines.length&&separator(lines[index+1])) {
   const headers=cells(line),rows:Array<{id:number;cells:string[]}>=[];index++;
   while(index+1<lines.length&&lines[index+1].startsWith("|")&&!separator(lines[index+1])) {
    const row=cells(lines[++index]);
    if(row.length!==headers.length){add(lines[index]);continue;}
    // Header labels are part of EVERY reviewed row, never free-standing assertions.
    const text=row.map((cell,column)=>`${headers[column]}: ${cell}`).join(" | ");
    rows.push({id:add(text),cells:row});
   }
   if(rows.length)nodes.push({kind:"table",headers,rows});
   continue;
  }
  if(separator(line))continue;
  const label=line.replace(/[#*:]/g,"").trim().toLowerCase();
  if(neutralHeadings.has(label)){nodes.push({kind:"heading",text:label[0].toUpperCase()+label.slice(1)});continue;}
  const parts:string[]=[];let start=0;
  for(const match of line.matchAll(/\[F[^\]\n]*\](?:[\s,]*\[F[^\]\n]*\])*/g)) {
   const end=match.index!+match[0].length;parts.push(line.slice(start,end).trim());start=end;
  }
  const remainder=line.slice(start).trim();if(/[\p{L}\p{N}]/u.test(remainder))parts.push(remainder);
  // Unknown headings are reviewed as assertions and rendered as ordinary prose.
  nodes.push({kind:"text",ids:parts.filter(Boolean).map(part=>add(part.replace(/^#{1,6}\s*/,"")))});
 }
 return {claims,nodes};
}

export function renderCheckedAnswer(answer:string,allowed:Set<number>) {
 const {claims,nodes}=analyzeAnswerLayout(answer);const output:string[]=[];let heading:string|null=null;
 const flush=()=>{if(heading&&!/^(?:Respuesta|Respuesta directa)$/i.test(heading))output.push(`**${heading}**`);heading=null;};
 for(const node of nodes) {
  if(node.kind==="heading"){heading=node.text;continue;}
  if(node.kind==="table") {
   const rows=node.rows.filter(row=>allowed.has(row.id));if(!rows.length)continue;flush();
   output.push([`| ${node.headers.join(" | ")} |`,`| ${node.headers.map(()=>"---").join(" | ")} |`,...rows.map(row=>`| ${row.cells.join(" | ")} |`)].join("\n"));
  } else {
   const texts=node.ids.filter(id=>allowed.has(id)).map(id=>claims[id-1].text.replace(/^[.,;\s]+/,""));
   if(texts.length){flush();output.push(texts.join(" "));}
  }
 }
 return output.join("\n\n");
}

export function checkedAnswerSections(answer:string,allowed:Set<number>) {
 const blocks=renderCheckedAnswer(answer,allowed).split("\n\n").filter(Boolean);
 let count=blocks[0]?.startsWith("**")&&blocks[0].endsWith("**")?2:1;
 if(/^\s*(?:[-*]|\d+[.)])\s/.test(blocks[count-1]??""))while(count<blocks.length&&/^\s*(?:[-*]|\d+[.)])\s/.test(blocks[count]))count++;
 return {main:blocks.slice(0,count).join("\n\n"),detail:blocks.slice(count).join("\n\n")};
}
