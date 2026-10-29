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
 if(/paso a paso|procedimiento|como (?:se |debo |puedo )?(?:tramitar|realizar|presentar|solicitar)|que pasos/.test(text))tasks.push("procedure");
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
