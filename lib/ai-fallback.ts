/** Automatic generation fallback only; embedding spaces must never be switched here. */
export function openCodeAvailable() { return Boolean(process.env.OPENCODE_API_KEY?.trim()) && process.env.OPENCODE_FALLBACK_ENABLED !== 'false'; }
export const openCodeModel = () => process.env.OPENCODE_MODEL?.trim() || 'gemini-3.8-flash';
export const openCodeBase = () => process.env.OPENCODE_BASE_URL?.trim() || 'https://opencode.ai/inference/openai/v1';
export const openCodeGoogleBase = () => process.env.OPENCODE_GOOGLE_BASE_URL?.trim() || 'https://opencode.ai/inference/google/v1beta';

export function providerQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as {name?:string;status?:number;message?:string;code?:string;error?:{code?:string;message?:string}};
  if (e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'CuotaIAAgotadaError') return false;
  if (e.status === 402 || e.status === 429) return true;
  // Billing can also be returned as FAILED_PRECONDITION, but never mask auth/validation errors.
  return (e.status === 400 || e.status === 403) && /insufficient[_ ]quota|credits? (?:are )?(?:depleted|exhausted)|billing.*(?:disabled|limit)|payment required|resource_exhausted/i.test(`${e.message??''} ${e.code??''} ${e.error?.code??''} ${e.error?.message??''}`);
}
export function createGeminiFallback(now:()=>number = Date.now) {
  let blockedUntil=0;
  const available=()=>openCodeAvailable();
  const skip=()=>available() && now()<blockedUntil;
  const failed=(error:unknown)=>{
    if (!available() || !providerQuotaError(error)) return false;
    const status=(error as {status?:number}).status;
    blockedUntil=now()+(status===429?60_000:300_000);
    return true;
  };
  return {
    async run<T>(primary:()=>Promise<T>,fallback:()=>Promise<T>):Promise<T> {
      if(skip())return fallback();
      try{return await primary();}catch(error){if(!failed(error))throw error;return fallback();}
    },
    async *stream<T>(primary:()=>AsyncIterable<T>|Promise<AsyncIterable<T>>,fallback:()=>AsyncIterable<T>|Promise<AsyncIterable<T>>):AsyncGenerator<T>{
      if(skip()){yield* await fallback();return;}
      let emitted=false;
      try{for await(const event of await primary()){emitted=true;yield event;}}
      catch(error){if(emitted || !failed(error))throw error;yield* await fallback();}
    },
  };
}
// Per warm server instance; retries Gemini after cooldown, never a permanent provider change.
export const geminiFallback = createGeminiFallback();
