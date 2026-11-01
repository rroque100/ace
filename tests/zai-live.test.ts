import {describe,it,expect,vi} from 'vitest';
vi.mock('../lib/uso-ia',()=>({registrarUsoIA:vi.fn(),exigirCuotaIA:vi.fn().mockResolvedValue(undefined)}));
describe.skipIf(process.env.ACE_TEST_ZAI_LIVE!=='1')('real third-provider smoke',()=>{
 it('answers JSON and streams through real Z.ai after two simulated provider quota failures',async()=>{
  vi.stubEnv('GOOGLE_API_KEY','public-test');vi.stubEnv('OPENCODE_API_KEY','public-test');
  const original=globalThis.fetch;const destinations:string[]=[];
  vi.stubGlobal('fetch',((url:RequestInfo|URL,init?:RequestInit)=>{const text=String(url);destinations.push(text);if(text.startsWith('https://generativelanguage.googleapis.com/')||text.startsWith('https://opencode.ai/'))return Promise.resolve(new Response('{"error":{"message":"payment required"}}',{status:402,headers:{'content-type':'application/json'}}));return original(url,init);}) as typeof fetch);
  try{const {getOpenAIClient,reportedProvider}=await import('../lib/openai-server');const client=getOpenAIClient();const response=await client.responses.create({model:'gemini-2.5-flash',input:'Return only JSON {"ok":true}.',text:{format:{type:'json_object'}},max_output_tokens:256},{timeout:30000});expect(JSON.parse(response.output_text)).toEqual({ok:true});expect(response.model).toBe('zai/glm-4.5-flash');expect(reportedProvider(response.model)).toBe('zai');expect(destinations.slice(0,3).map(x=>new URL(x).hostname)).toEqual(['generativelanguage.googleapis.com','opencode.ai','api.z.ai']);const stream=await client.responses.create({model:'gemini-2.5-flash',input:'Responde solo OK.',max_output_tokens:256,stream:true},{timeout:30000});let text='';for await(const e of stream)if(e.type==='response.output_text.delta')text+=e.delta;expect(text).toContain('OK');}finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}
 },75000);
});
