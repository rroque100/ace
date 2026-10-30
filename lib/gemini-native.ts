import {geminiFallback,openCodeGoogleBase,openCodeModel} from './ai-fallback';
type NativeResult = { candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>; usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number}; usage?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number}; provider:string; model:string };
/** Same multimodal Google protocol through the official OpenCode gateway. Never sends embeddings. */
export async function generateGeminiContent(body:Record<string,unknown>,options:{model:string;signal?:AbortSignal;timeout?:number}):Promise<NativeResult>{
 const signal=AbortSignal.any([AbortSignal.timeout(options.timeout??60_000),...(options.signal?[options.signal]:[])]);
 async function send(backup:boolean):Promise<NativeResult>{
  const key=backup?process.env.OPENCODE_API_KEY:(process.env.GOOGLE_API_KEY??process.env.GEMINI_API_KEY);
  if(!key)throw new Error('No está configurado el proveedor de IA');
  const model=backup?openCodeModel():options.model;
  if(!/^[a-zA-Z0-9._-]+$/.test(model))throw new Error('Modelo de IA no válido');
  const base=backup?openCodeGoogleBase():(process.env.GEMINI_NATIVE_BASE_URL??'https://generativelanguage.googleapis.com/v1beta');
  const payload=backup?{...body,generationConfig:{...(body.generationConfig as object??{}),thinkingConfig:{thinkingLevel:'low'}}}:body;
  const response=await fetch(`${base}/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json',...(backup?{Authorization:`Bearer ${key}`}:{'x-goog-api-key':key})},body:JSON.stringify(payload),signal});
  if(!response.ok){const json=await response.json().catch(()=>null);const code=json?.error?.status??json?.error?.code??'';throw Object.assign(new Error(`Proveedor de IA HTTP ${response.status} ${String(code).slice(0,80)}`),{status:response.status});}
  const result=await response.json() as NativeResult;
  return {...result,usageMetadata:result.usageMetadata??result.usage,provider:backup?'opencode':'gemini',model};
 }
 return geminiFallback.run(()=>send(false),()=>send(true));
}
