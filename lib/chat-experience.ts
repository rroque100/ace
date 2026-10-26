import {z} from "zod";
import type {EvidenceReview} from "./chat-evidence-audit";
import {planQuestion} from "./chat-question-plan";
export const FEEDBACK_REASONS=[
 {value:"incorrect_citation",label:"Cita incorrecta"},{value:"not_answered",label:"No respondió mi pregunta"},
 {value:"missing_exceptions",label:"Faltan condiciones o excepciones"},{value:"too_long",label:"Demasiado extensa"},{value:"other",label:"Otro motivo"},
] as const;
export const feedbackSchema=z.object({action:z.enum(["save_note","mark_correct","mark_incorrect"]),note:z.string().trim().max(4000).nullish(),reason:z.enum(["incorrect_citation","not_answered","missing_exceptions","too_long","other"]).optional()});
export type FeedbackReason=typeof FEEDBACK_REASONS[number]["value"];
export function contextualFollowups(message:{questionText?:string;assessment?:{evidenceReview?:EvidenceReview};sources?:Array<{article?:string|null;documentTitle:string}>}) {
 const review=message.assessment?.evidenceReview,tasks=planQuestion(message.questionText??"").tasks;
 if(review?.reviewStatus==="failed")return ["Reintenta comprobar la respuesta con las mismas fuentes.","Indica qué parte no pudo comprobarse y cómo puedo revisarla."];
 if(review?.presentation==="empty"||review?.presentation==="literal")return ["Formula una búsqueda para localizar la disposición que responde a mi pregunta.","Distingue lo que consta en las fuentes de lo que todavía falta comprobar."];
 const result:string[]=[];
 if(review?.missing.length&&review.queryScope==="case")result.push(`Explica por qué necesitas precisar ${review.missing[0]} para aplicar la respuesta a mi caso.`);
 if(tasks.includes("comparison"))result.push("Separa las diferencias comprobadas de los puntos que no pudieron compararse.");
 else if(tasks.includes("requirements")||tasks.includes("procedure"))result.push("Organiza lo comprobado en una lista de pasos y responsables; indica si algún responsable no consta.");
 else if(tasks.includes("numeric"))result.push("Explica las condiciones y excepciones de la cifra citada, sin añadir datos no comprobados.");
 else if(tasks.includes("summary"))result.push("Destaca las obligaciones y los límites que aparecen en el documento resumido.");
 const source=message.sources?.find(item=>item.article);
 if(source)result.push(`Explica el artículo ${source.article} de «${source.documentTitle.slice(0,150)}» y su relación con mi pregunta, usando esa fuente.`);
 result.push("Señala qué conclusiones requieren revisión humana antes de aplicarlas.");return [...new Set(result)].slice(0,3);
}
const contextKeys:Record<string,{key:"regime"|"dates"|"object"|"facts";label:string;hint:string}>={
 "régimen aplicable":{key:"regime",label:"¿Qué régimen se indicó para el procedimiento?",hint:"Si no lo sabes, indícalo; no lo deduciremos por la fecha."},
 "fechas relevantes":{key:"dates",label:"¿Cuál es la fecha de convocatoria o el hito relacionado con tu consulta?",hint:"Indica la fecha y a qué actuación corresponde."},
 "objeto contractual":{key:"object",label:"¿Qué se está contratando?",hint:"Describe si son bienes, servicios, obra o consultoría."},
 "hechos del caso":{key:"facts",label:"¿Qué ocurrió en tu caso?",hint:"Describe la actuación o decisión que necesitas revisar."},
};
export function nextClarification(review?:EvidenceReview){return review?.queryScope==="case"?review.missing.map(item=>contextKeys[item]).find(Boolean)??null:null;}
