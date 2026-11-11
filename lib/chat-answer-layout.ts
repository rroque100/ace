import { citedSourceNumbers } from "./chat-source-locations";

export type LayoutClaim = { id: number; text: string; markers: number[] };

/**
 * ¿Es una afirmación «estructural»: un encabezado o una frase de enlace que no afirma nada que las fuentes deban respaldar?
 * Son los títulos en negrita que escribe el modelo («**Reducción de la garantía en obras**», «**Aplicación en el tiempo**») y las
 * frases que solo anuncian lo siguiente («El procedimiento general es el siguiente:»). El auditor los rechaza siempre porque ningún
 * pasaje «respalda» un título, y contados como omitidos volvían «parcial» una respuesta completa (medido en producción el
 * 2026-11-11: las tres preguntas compuestas salían «parcial» por un encabezado). Nunca lo es lo que lleva una cita [F#]: eso afirma.
 */
const SOURCE_LIST_HEADING = /^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:fuentes(?:\s+(?:citadas|consultadas|utilizadas|recuperadas|normativas))?|referencias(?:\s+normativas)?|bibliograf[ií]a|documentos\s+(?:citados|consultados))\s*:?\s*(?:\*\*)?\s*:?\s*$/i;
const MARKER_ONLY_LINE = /^\s*(?:[-*•]|\d+[.)])?\s*(?:\[F\d+\][\s,;]*)+$/;
const SOURCE_DESCRIPTION_LINE = /\b(?:art[ií]culo|p[aá]gina|ley|reglamento|decreto|directiva|opini[oó]n|resoluci[oó]n|acuerdo|n\.?\s*°)/i;

/**
 * Quita la bibliografía que el modelo añade a veces al final («**Fuentes Citadas:**», «* [F1]», «Ley…, Artículo 61, páginas
 * 18-19.»). No afirma nada que comprobar, así que el auditor rechazaba cada línea y la respuesta salía «parcial» con «se omitieron
 * 10 afirmaciones» siendo completa (medido el 2026-11-11: 2 de 14 corridas de una misma pregunta). Tampoco se publicaba: la
 * interfaz ya pone su propia lista «Documentos y páginas citados», con páginas comprobadas en lugar de las que escribe el modelo.
 * Conservadora: solo corta si DESPUÉS del título todo son marcadores o descripciones de fuentes; con prosa detrás no toca nada.
 */
/**
 * Puntuación suelta que el modelo deja dentro de un paréntesis de cita: «(Artículo 113.1;)», «(Artículo 207.1, )». Se veía tal cual
 * en la respuesta publicada (medido en producción el 2026-11-11). Solo quita el signo que queda justo antes del cierre; el resto del
 * paréntesis no cambia, así que no altera ninguna cifra ni referencia.
 */
export function tidyModelPunctuation(answer: string) {
  return answer.replace(/\s*[;,]\s*\)/g, ")");
}

export function stripModelSourceList(answer: string) {
  const lines = answer.split("\n");
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!SOURCE_LIST_HEADING.test(lines[index].trim())) continue;
    const rest = lines.slice(index + 1).map((line) => line.trim()).filter(Boolean);
    // Una descripción de fuente es una sola línea corta que nombra la norma; si trae otra frase («…. La garantía…») ya es prosa.
    const isSourceDescription = (line: string) => line.length <= 300 && SOURCE_DESCRIPTION_LINE.test(line) && !/[.;:]\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(line);
    const onlySources = rest.length > 0 && rest.every((line) => MARKER_ONLY_LINE.test(line) || isSourceDescription(line));
    return onlySources ? lines.slice(0, index).join("\n").trimEnd() : answer;
  }
  return answer;
}

export function isStructuralClaim(text: string) {
  const claim = text.trim();
  if (!claim || /\[F\d/.test(claim)) return false;
  if (/^(?:#{1,6}\s*)?\*\*[^*\n]{1,160}\*\*:?$/.test(claim)) return true;
  if (/^#{1,6}\s+\S[^\n]{0,160}$/.test(claim)) return true;
  return /:$/.test(claim) && !/\d/.test(claim) && claim.length <= 200;
}
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

/** `everything`: todo lo verificado queda en `main` (pregunta de varias partes: ver isMultiPartQuestion). */
export function checkedAnswerSections(answer:string,allowed:Set<number>,options:{everything?:boolean}={}) {
 const blocks=renderCheckedAnswer(answer,allowed).split("\n\n").filter(Boolean);
 if(options.everything)return {main:blocks.join("\n\n"),detail:""};
 let count=blocks[0]?.startsWith("**")&&blocks[0].endsWith("**")?2:1;
 if(/^\s*(?:[-*]|\d+[.)])\s/.test(blocks[count-1]??""))while(count<blocks.length&&/^\s*(?:[-*]|\d+[.)])\s/.test(blocks[count]))count++;
 return {main:blocks.slice(0,count).join("\n\n"),detail:blocks.slice(count).join("\n\n")};
}
