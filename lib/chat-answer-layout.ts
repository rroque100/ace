import { citedSourceNumbers } from "./chat-source-locations";

/** `inheritedFrom`: la línea no lleva cita propia y toma la de la frase que la introduce (ver analyzeAnswerLayout). */
export type LayoutClaim = { id: number; text: string; markers: number[]; inheritedFrom?: number };

/**
 * Texto con el que se comprueban las cifras (checkCitationFaithfulness lee los [F#] del texto). Una línea con cita heredada no la
 * lleva escrita: sin añadirla aquí, un «10%» en esa línea se saltaría la comprobación contra su fuente.
 */
export function claimTextForCheck(claim: LayoutClaim) {
  return claim.inheritedFrom ? `${claim.text} ${claim.markers.map((n) => `[F${n}]`).join(" ")}` : claim.text;
}

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
 * También el «; ,» entre dos referencias: «(Artículo 61.2.a; , Artículo 113.1.i)», en casi todas las corridas de la pregunta de la
 * garantía de fiel cumplimiento (2026-11-11). Queda la coma, que es lo que el modelo quería poner.
 */
export function tidyModelPunctuation(answer: string) {
  return answer.replace(/\s*;\s*,/g, ",").replace(/\s*[;,]\s*\)/g, ")");
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
  // La viñeta no cambia lo que es la línea: «*   **Para obras:**» y «1.  **Plazos**:» son rótulos de una lista, igual que sin ella.
  // Sin quitarla, contaban como afirmaciones omitidas y la respuesta salía «parcial» (medido el 2026-11-11 en «¿Qué pasa si el
  // contratista se atrasa…?» y «¿Cómo se solicita una ampliación de plazo…?»).
  const claim = text.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, "");
  if (!claim || /\[F\d/.test(claim)) return false;
  if (/^(?:#{1,6}\s*)?\*\*[^*\n]{1,160}\*\*:?$/.test(claim)) return true;
  if (/^#{1,6}\s+\S[^\n]{0,160}$/.test(claim)) return true;
  // «**Plazos:**» termina en «**», no en «:»: los dos puntos dentro de la negrita también anuncian lo que sigue.
  return /:(?:\*\*)?$/.test(claim) && !/\d/.test(claim) && claim.length <= 200;
}
type Node = { kind:"heading"; text:string } | { kind:"text"; ids:number[] } | { kind:"table"; headers:string[]; rows:Array<{id:number;cells:string[]}> };
// «análisis» y «lista de verificación» son los encabezados de los formatos informe y lista (ver FORMAT_HEADINGS en
// chat-answer-format.ts): sin estar aquí se auditaban como afirmaciones y casi nunca se publicaban.
const neutralHeadings=new Set(["respuesta","respuesta directa","fundamento","fundamento legal","explicación","en la práctica","requisitos","pasos","procedimiento","comparación","resumen","condiciones","excepciones","condiciones y excepciones","riesgos","conclusión","aplicación al caso","información faltante y límites","fuentes y vigencia","análisis","lista de verificación"]);
const separator=(line:string)=>/^\|?[\s:|-]+\|?$/.test(line);
const cells=(line:string)=>line.replace(/^\|/,"").replace(/\|$/,"").split("|").map(cell=>cell.trim());

/** ¿Anuncia lo que sigue? «…fórmula (Artículo 120.1) [F4]:» o «…fórmula: (Artículo 120.1) [F4]», sin contar citas ni paréntesis finales. */
const introducesList=(line:string)=>/:$/.test(line.replace(/\[F[^\]\n]*\]/g," ").replace(/\s+/g," ").trim().replace(/(?:\s*\([^()]*\))+\s*\.?$/,"").replace(/\*\*$/,"").trim());

/** One parser for the reviewer and renderer: no unchecked table headers or headings. */
export function analyzeAnswerLayout(answer:string) {
 const claims:LayoutClaim[]=[],nodes:Node[]=[];
 const add=(text:string)=>{const id=claims.length+1;claims.push({id,text,markers:citedSourceNumbers(text)});return id;};
 const lines=answer.split(/\n+/).map(line=>line.trim()).filter(Boolean);
 // Cita heredada. El modelo escribe «La penalidad diaria se calcula mediante la siguiente fórmula (Artículo 120.1) [F4]:» y debajo
 // la fórmula y los valores de F sin repetir [F4]. Cada línea se auditaba sola, sin cita, y se descartaba: la respuesta salía
 // «parcial» y sin la fórmula (12 de 90 corridas medidas el 2026-11-11). Una línea SIN cita propia que sigue a una frase citada
 // terminada en «:» toma sus marcadores: el auditor la compara con ESA fuente con el mismo rigor (pasaje literal, cifras), y solo
 // se publica si también se publica la frase que la introduce (ver publishEvidence). Continúan la cadena las viñetas, las fórmulas
 // («=») y los rótulos terminados en «:»; un párrafo, un título o una tabla la cortan.
 let chain:{id:number;markers:number[]}|null=null;
 for(let index=0;index<lines.length;index++) {
  const line=lines[index];
  if(line.startsWith("|")&&index+1<lines.length&&separator(lines[index+1])) {
   chain=null;
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
  if(neutralHeadings.has(label)){chain=null;nodes.push({kind:"heading",text:label[0].toUpperCase()+label.slice(1)});continue;}
  const parts:string[]=[];let start=0;
  for(const match of line.matchAll(/\[F[^\]\n]*\](?:[\s,]*\[F[^\]\n]*\])*/g)) {
   const end=match.index!+match[0].length;parts.push(line.slice(start,end).trim());start=end;
  }
  const remainder=line.slice(start).trim();if(/[\p{L}\p{N}]/u.test(remainder))parts.push(remainder);
  // Unknown headings are reviewed as assertions and rendered as ordinary prose.
  // Un título «### Causales de resolución» sin cita queda en negrita y no como texto suelto: sin las almohadillas ni la negrita,
  // isStructuralClaim no lo reconocía como título y contaba como afirmación omitida (la respuesta salía «parcial», medido el
  // 2026-11-11 en «¿En qué casos se puede resolver un contrato?»).
  const heading=(part:string)=>/^#{1,6}\s/.test(part)&&!/\[F\d/.test(part)?`**${part.replace(/^#{1,6}\s*/,"").replace(/\*\*/g,"").trim()}**`:part.replace(/^#{1,6}\s*/,"");
  const ids=parts.filter(Boolean).map(part=>add(heading(part)));
  nodes.push({kind:"text",ids});
  const own=ids.filter(id=>claims[id-1].markers.length);
  const listItem=/^(?:[-*•]|\d+[.)])\s/.test(line);
  if(!own.length) {
   const continues=listItem||/=/.test(line)||ids.every(id=>isStructuralClaim(claims[id-1].text)&&/:(?:\*\*)?$/.test(claims[id-1].text));
   if(chain&&continues)for(const id of ids){claims[id-1].markers=[...chain.markers];claims[id-1].inheritedFrom=chain.id;}
   else chain=null;
  } else if(introducesList(line)) chain={id:own[own.length-1],markers:[...claims[own[own.length-1]-1].markers]};
  else if(!listItem) chain=null;
 }
 return {claims,nodes};
}

/**
 * Conector de enlace al inicio de una frase («Sin embargo,», «No obstante,», «Además,»…). Solo tiene sentido si se publica
 * también la frase a la que responde. Exige la coma (o «Pero») para no tocar «Además del pago…» ni «Así lo dispone…».
 */
const LEADING_CONNECTOR=/^(?:(?:sin embargo|no obstante|por otro lado|por otra parte|en cambio|adem[aá]s|asimismo|igualmente|de igual (?:forma|manera|modo)|del mismo modo|por (?:lo )?tanto|por ello|por eso|por consiguiente|en consecuencia|a su vez)\s*,|pero(?![a-záéíóúñ]))\s*/i;

/**
 * Quita el conector inicial que queda suelto cuando no se publica la frase anterior. Caso real (producción, 2026-11-11):
 * «¿Qué dice el Decreto Supremo 999-2099-EF?» → el modelo escribió «Las fuentes no contienen ese decreto.» y luego «Sin
 * embargo, las fuentes recuperadas incluyen…»; el auditor descartó la primera (no hay pasaje que «respalde» una ausencia) y
 * la respuesta publicada empezaba por «Sin embargo,», contestando a algo que el lector no veía. Solo quita el conector y
 * pone la mayúscula; el resto de la frase, con sus cifras y citas, no cambia.
 */
export function dropDanglingConnector(text:string) {
 const rest=text.replace(LEADING_CONNECTOR,"");
 return rest===text||!rest?text:rest[0].toUpperCase()+rest.slice(1);
}

export function renderCheckedAnswer(answer:string,allowed:Set<number>) {
 const {claims,nodes}=analyzeAnswerLayout(answer);const output:string[]=[];let heading:string|null=null;
 // ¿Se publica la frase a la que responde esta? Los títulos no cuentan: un conector tras un título enlaza con lo anterior.
 const previousShown=(id:number)=>{for(let prev=id-1;prev>=1;prev--){if(isStructuralClaim(claims[prev-1].text))continue;return allowed.has(prev);}return false;};
 const shown=(id:number)=>{const text=claims[id-1].text.replace(/^[.,;\s]+/,"");return previousShown(id)?text:dropDanglingConnector(text);};
 const flush=()=>{if(heading&&!/^(?:Respuesta|Respuesta directa)$/i.test(heading))output.push(`**${heading}**`);heading=null;};
 for(const node of nodes) {
  if(node.kind==="heading"){heading=node.text;continue;}
  if(node.kind==="table") {
   const rows=node.rows.filter(row=>allowed.has(row.id));if(!rows.length)continue;flush();
   output.push([`| ${node.headers.join(" | ")} |`,`| ${node.headers.map(()=>"---").join(" | ")} |`,...rows.map(row=>`| ${row.cells.join(" | ")} |`)].join("\n"));
  } else {
   const texts=node.ids.filter(id=>allowed.has(id)).map(shown);
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
