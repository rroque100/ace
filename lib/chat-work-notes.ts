import {z} from "zod";
import {citedSourceNumbers} from "./chat-source-locations";
export const workTargetSchema=z.enum(["necesidad","expediente","contrato_sie","contrato_cp"]);
export type WorkTarget=z.infer<typeof workTargetSchema>;
export const targetTables:Record<WorkTarget,string>={necesidad:"necesidades",expediente:"procurement_processes",contrato_sie:"contratos_sie",contrato_cp:"contratos_cp"};
export const workNoteSchema=z.object({messageId:z.string().uuid(),targetType:workTargetSchema,targetId:z.string().uuid(),comment:z.string().trim().max(4000).default("")});
export function workNoteSnapshot(message:{id:string;session_id?:string;content?:string;metadata?:Record<string,unknown>;sources?:unknown[]}) {
 const sources=Array.isArray(message.sources)?message.sources:[];
 return {messageId:message.id,sessionId:message.session_id,question:typeof message.metadata?.question==="string"?message.metadata.question:"Pregunta no registrada",answer:message.content??"",status:"pending_review" as const,
  sources:citedSourceNumbers(message.content??"").flatMap(number=>{const source=sources[number-1] as Record<string,unknown>|undefined;return source?[{number,documentId:source.documentId,title:source.documentTitle,article:source.article,articleId:source.articleId,bodyId:source.bodyId,bodyTitle:source.bodyTitle,numeral:source.numeral,version:source.version,pageStart:source.pageStart,pageEnd:source.pageEnd}]:[];}),
  notice:"Nota personal de apoyo generada con IA. Requiere revisión antes de utilizarla; no modifica ni aprueba el procedimiento."};
}
