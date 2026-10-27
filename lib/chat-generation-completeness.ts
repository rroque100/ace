/** Provider-independent completion checks; never expose or log raw request data. */
export function generationIncomplete(response:unknown) {
 const result=response as {status?:string;raw?:{choices?:Array<{finish_reason?:string}>}}|null;
 return result?.status==="incomplete"||result?.raw?.choices?.[0]?.finish_reason==="length";
}
export function compactRetryParams<T extends {max_output_tokens?:number;input:unknown}>(params:T):T {
 const input=Array.isArray(params.input)?params.input:[];
 return {...params,max_output_tokens:Math.min(6000,Math.max(2400,(params.max_output_tokens??1200)*2)),input:[...input,{role:"user",content:"La respuesta anterior se interrumpió. Genera una respuesta completa desde el principio, compacta y limitada a doce afirmaciones relevantes, manteniendo el esquema solicitado si es JSON y todas las citas. No añadas relleno. En tablas Markdown usa separadores mínimos y una sola separación junto a cada barra; no alinees columnas mediante espacios repetidos. Si falta evidencia, decláralo."}]} as T;
}
