import {esRespuestaFija} from './chat-respuesta-fija';
export type ResponseAiIdentity={kind:'confirmed'|'pending'|'system'|'unknown';provider:string;model:string|null;note:string};
/** Only the provider that generated this answer, never the configured fallback order. */
export function responseAiIdentity(input:{model?:string|null;provider?:string|null;streaming?:boolean;error?:string|null}):ResponseAiIdentity{
 if(input.streaming)return {kind:'pending',provider:'IA en proceso',model:null,note:'El proveedor utilizado se confirma al terminar la respuesta.'};
 if(input.error)return {kind:'unknown',provider:'Proveedor sin confirmar',model:null,note:'La solicitud no terminó; no se atribuye a una IA una respuesta incompleta.'};
 const raw=input.model?.trim()||'';
 if(esRespuestaFija(raw)||raw==='out-of-scope'||input.provider==='sin generación')return {kind:'system',provider:'Respuesta de ACE',model:null,note:'Mensaje de orientación, sin generación de IA.'};
 if(raw.startsWith('fallback-')||input.provider==='extractivo')return {kind:'system',provider:'Lectura de fuentes',model:null,note:'Se mostró un extracto documental; no una respuesta generada por IA.'};
 const prefix=/^(opencode|zai)\/(.+)$/.exec(raw);
 const model=(prefix?.[2]??raw).replace(/^models\//,'');
 const provider=prefix?.[1]||input.provider||(/^gemini-/i.test(model)?'gemini':/^glm-/i.test(model)?'zai':/^(gpt-|o[134]-)/i.test(model)?'openai':'');
 const label:Record<string,string>={gemini:'Google Gemini',google:'Google Gemini',opencode:'OpenCode',zai:'Z.ai',openai:'OpenAI'};
 if(!label[provider]||!model||!/^[a-zA-Z0-9._:/-]{1,100}$/.test(model))return {kind:'unknown',provider:'IA sin identificar',model:null,note:'Esta respuesta no tiene registrado un proveedor y modelo verificables.'};
 return {kind:'confirmed',provider:label[provider],model,note:'Proveedor y modelo que redactaron esta respuesta. La recuperación y revisión de fuentes pueden usar otros servicios.'};
}
