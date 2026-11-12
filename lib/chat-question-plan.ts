import { parseAlternatives } from "./chat-alternatives";
import type { CaseContext } from "./chat-case-context";
import { extractConvocatoria, extractDates, isRegimeComparison } from "./chat-regime";
const plain=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export type QuestionTask="alternatives"|"comparison"|"requirements"|"procedure"|"summary"|"case"|"numeric"|"explanation";
export function isCaseQuestion(question:string,context?:CaseContext) {
 const meaningful=(value?:string)=>Boolean(value?.trim())&&!/^(?:no determinado|no indicada?|no se|desconocid[oa]|pendiente|por confirmar)$/i.test(plain(value!.trim()));
 return meaningful(context?.regime)||meaningful(context?.facts)||meaningful(context?.dates)||meaningful(context?.object)
  || /\b(?:mi|nuestro|este|ese)\s+(?:caso|contrato|procedimiento|proceso|expediente)|\ben mi entidad\b|\b(?:hemos|se ha|se)\s+(?:convocado|suscrito|firmado|adjudicado)|\b(?:suscribimos|firmamos|convocamos)|\bse\s+(?:convoco|firmo|suscribio|adjudico)\b/.test(plain(question));
}
export function planQuestion(question:string,context?:CaseContext) {
 const text=plain(question),tasks:QuestionTask[]=[];
 if(parseAlternatives(question))tasks.push("alternatives");
 if(/\b(?:compara|comparar|diferencias?|contrasta|versus)\b|\bcomparacion\s+(?:entre|de\s+(?:leyes|normas|versiones|documentos|regimenes))/.test(text)||isRegimeComparison(question))tasks.push("comparison");
 if(/requisitos?|documentos? necesito|condiciones? (?:debo|debe)|checklist/.test(text))tasks.push("requirements");
 // También la forma conjugada: «¿cómo se solicita una ampliación de plazo?» no contaba como procedimiento (solo «solicitar»).
 if(/paso a paso|procedimiento|como (?:se |debo |puedo )?(?:tramit|realiz|present|solicit)(?:ar|a|an)(?![a-z])|que pasos/.test(text))tasks.push("procedure");
 if(/resume|resumen|sintetiza|sintesis/.test(text))tasks.push("summary");
 if(isCaseQuestion(question,context))tasks.push("case");
 if(/porcentaje|cuanto|plazo|dias|monto|umbral|limite|\buit\b/.test(text))tasks.push("numeric");
 if(!tasks.length)tasks.push("explanation");
 // No invented expansions, numbers or regime: only subquestions actually written by the user.
 const written=question.match(/[^?¿\n]+\?/g)?.map(part=>part.replace(/^[\s¿]+/,"").trim()).filter(part=>part.length>=12)??[];
 const subqueries=tasks.includes("alternatives")?[]:[...new Set(written)].slice(0,3);
 return {tasks,truncated:written.length>3,subqueries:subqueries.length>1?subqueries:[],scope:tasks.includes("case")?"case" as const:"general" as const};
}
export function adaptiveAnswerInstruction(question:string,context?:CaseContext) {
 const plan=planQuestion(question,context);
 return `Adapta la respuesta a lo que el usuario pide, usando exclusivamente las fuentes disponibles. Tareas orientativas: ${plan.tasks.join(", ")}; puedes combinar formatos si la pregunta lo requiere. La IA debe interpretar el sentido y las negaciones, no limitarse a estas etiquetas. Primero contesta la pregunta; después desarrolla solo lo pertinente. Para requisitos usa lista; para un procedimiento, pasos; para comparación, tabla Markdown compacta sin relleno ni espacios repetidos, con encabezados neutrales y normas identificadas en cada fila; para resumen o explicación, párrafos y secciones breves. Conserva excepciones y condiciones del pasaje. Una fila de tabla debe poder comprobarse íntegramente con sus citas. No pongas conclusiones jurídicas en encabezados sin respaldo. Usa títulos neutrales como Requisitos, Pasos, Comparación, Resumen, Condiciones, Excepciones o Fundamento. Cita cada afirmación sustantiva, incluida cada fila y elemento de lista. No conviertas un texto propuesto en documento validado. Consulta ${plan.scope==="general"?"general: no exijas datos de un caso inexistente; condiciona la aplicación a un caso concreto.":"de caso: distingue hechos declarados de acreditados y pide únicamente los datos determinantes que falten."} Máximo 40 afirmaciones breves; si la solicitud es más amplia, responde por partes y declara su alcance. No afirmes haber revisado toda la biblioteca o comparado íntegramente dos versiones a partir de pasajes recuperados. Si pide comparación completa, diferencia comparación temática de comparación del texto disponible y remite a la herramienta de comparación de ACE.`;
}

export function caseInformationNeeds(question:string,context?:CaseContext) {
 const plan=planQuestion(question,context),text=plain(question);
 if(plan.scope!=="case"||plan.tasks.includes("summary")&&!/aplica|corresponde|procede|regimen/.test(text))return [];
 const absent=(value?:string)=>!value?.trim()||/^(?:no determinado|no indicada?|no se|desconocid[oa]|pendiente|por confirmar|fecha pendiente)$/i.test(plain(value.trim()));
 // Con la fecha de convocatoria el régimen se deduce (Ley 32069 desde el 22.04.2025): no se pide.
 return [absent(context?.regime)&&!/(?:ley|regimen)\s+(?:n[.°º]*\s*)?\d{4,6}/.test(text)&&!extractConvocatoria(question)&&"régimen aplicable",
  // «Junio de 2026» o «el 3 de marzo de 2025» son fechas igual que 12/03/2025: antes solo se
  // reconocía esta última y el chat volvía a pedir la fecha que la pregunta ya traía.
  absent(context?.dates)&&extractDates(question).length===0&&"fechas relevantes",
  absent(context?.object)&&! /\b(?:bienes|servicios|obras|consultoria)\b/.test(text)&&(plan.tasks.includes("requirements")||plan.tasks.includes("numeric"))&&"objeto contractual",
  absent(context?.facts)&&/aplica|corresponde|procede|valido|puedo|debo/.test(text)&&"hechos del caso"].filter(Boolean) as string[];
}

/**
 * ¿La pregunta pide varias cosas a la vez? («¿qué porcentaje debe tener la garantía y cuándo puede reducirse?»,
 * «¿quién asume el costo y qué debe ordenar el supervisor?»). Dos señales: más de una pregunta escrita, o una
 * coordinación («y», «e») seguida de otra interrogación o de un verbo que abre otra cláusula.
 *
 * Existe porque la respuesta publicada pone el primer bloque a la vista y pliega el resto bajo «Ver fundamento y fuentes»:
 * en una pregunta de una sola parte ese resto es elaboración, pero en una compuesta es LA SEGUNDA RESPUESTA, y quedaba escondida
 * (medido en producción el 2026-11-11: garantía y reducción en obras, supervisión y programa acelerado). Conservadora a
 * propósito: «¿qué plazos y condiciones tiene…?» NO es compuesta; un falso positivo solo muestra más texto verificado.
 */
const OPENS_CLAUSE="(?:cu[aá]ndo|cu[aá]l(?:es)?|c[oó]mo|qu[eé]|qui[eé]n(?:es)?|d[oó]nde|cu[aá]nt[oa]s?|en qu[eé]|por qu[eé]|puede[n]?|debe[n]?|procede[n]?|corresponde[n]?|existe[n]?|hay|es posible)(?![a-záéíóúñ])";
const COORDINATED_CLAUSE=new RegExp(`\\b(?:y|e)\\s+${OPENS_CLAUSE}`);
export function isMultiPartQuestion(question:string,context?:CaseContext) {
 if(planQuestion(question,context).subqueries.length>1)return true;
 return COORDINATED_CLAUSE.test(question.toLowerCase());
}

/**
 * Cuántas fuentes recibe la respuesta. Ocho bastan para una pregunta puntual; las de procedimiento, requisitos o varias partes
 * se quedaban cortas: con ocho fragmentos la segunda parte o los pasos finales no tenían fuente y la respuesta salía recortada
 * (medido el 2026-11-11 en «¿cómo se solicita una ampliación de plazo…?» y «¿qué pasa si el contratista se atrasa…?»). Doce y no
 * más: cada fuente viaja también al auditor en cada lote, y más texto alarga la revisión hacia su límite de 25 s.
 */
export function answerSourceLimit(question:string,context?:CaseContext) {
 const plan=planQuestion(question,context);
 const broad=plan.tasks.some(task=>task==="alternatives"||task==="procedure"||task==="requirements")||isMultiPartQuestion(question,context);
 return broad?12:8;
}

const TOPIC_STOP=new Set(["que","qué","cual","cuál","cuales","cuáles","como","cómo","cuando","cuándo","quien","quién","donde","dónde","cuanto","cuánto","cuanta","cuánta","debe","deben","puede","pueden","tiene","tienen","tener","hacer","sobre","para","desde","hasta","segun","según","entre","porque","esta","este","estos","estas","cuál","sucede","pasa","ocurre","procede","corresponde","existe","exige","exigen"]);

/**
 * Las partes de una pregunta compuesta, cada una lista para buscarse sola. «¿Qué porcentaje del monto debe tener la garantía de
 * fiel cumplimiento y cuándo puede reducirse en obras?» → la primera tal cual y «cuándo puede reducirse en obras» con el tema de la
 * primera («garantía fiel cumplimiento…»): sin él, «cuándo puede reducirse» sola no dice QUÉ se reduce y la búsqueda traía
 * cualquier reducción. Las preguntas escritas por separado («¿…? ¿…?») ya llegan partidas (subqueries). Sin partes, [].
 */
export function questionParts(question:string,context?:CaseContext):string[] {
 const plan=planQuestion(question,context);
 if(plan.tasks.includes("alternatives"))return [];
 if(plan.subqueries.length>1)return plan.subqueries;
 const pieces=question.split(new RegExp(`\\s*,?\\s+\\b(?:y|e)\\s+(?=${OPENS_CLAUSE})`,"i"))
  .map(piece=>piece.replace(/^[\s¿]+/,"").replace(/[\s?]+$/,"").trim()).filter(piece=>piece.length>=8).slice(0,3);
 if(pieces.length<2)return [];
 const words=(text:string)=>text.split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>=4&&!TOPIC_STOP.has(word.toLowerCase()));
 const topic=words(pieces[0]).slice(-6);
 return pieces.map((piece,index)=>{
  if(index===0)return piece;
  const own=new Set(words(piece).map(word=>word.toLowerCase()));
  return [piece,...topic.filter(word=>!own.has(word.toLowerCase()))].join(" ");
 });
}
