import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const usage=vi.hoisted(()=>({record:vi.fn(),quota:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../lib/uso-ia',()=>({registrarUsoIA:usage.record,exigirCuotaIA:usage.quota}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('GOOGLE_API_KEY','primary-test');vi.stubEnv('OPENCODE_API_KEY','backup-test');usage.record.mockClear();usage.quota.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const denied=()=>new Response(JSON.stringify({error:{message:'payment required'}}),{status:402,headers:{'content-type':'application/json'}});
const completion=()=>new Response(JSON.stringify({id:'test',model:'gemini-3.8-flash',choices:[{message:{role:'assistant',content:'{"result":"ok"}'},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:5}}),{headers:{'content-type':'application/json'}});
it('routes a real SDK call to backup with its model, keeps JSON/system instructions, and measures backup usage',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(denied()).mockResolvedValueOnce(completion());vi.stubGlobal('fetch',fetcher);
 const {getOpenAIClient}=await import('../lib/openai-server');
 const result=await getOpenAIClient().responses.create({model:'gemini-2.5-flash',input:'test',instructions:'Return JSON',text:{format:{type:'json_object'}},max_output_tokens:200});
 expect(result.output_text).toBe('{"result":"ok"}');expect(result.model).toBe('opencode/gemini-3.8-flash');
 const [url,request]=fetcher.mock.calls[1];expect(String(url)).toContain('opencode.ai/inference/openai/v1/chat/completions');const body=JSON.parse(request.body);expect(body.model).toBe('gemini-3.8-flash');expect(body.messages[0]).toEqual({role:'system',content:'Return JSON'});expect(body.response_format).toEqual({type:'json_object'});expect(body.reasoning_effort).toBe('minimal');expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({modelo:'gemini-3.8-flash',tokensEntrada:12,tokensSalida:5}), 'llm','opencode');expect(usage.quota).toHaveBeenCalledTimes(2);
});
it('cannot bypass an external account quota even with OpenCode configured',async()=>{
 const error=Object.assign(Error('account quota'),{name:'CuotaIAAgotadaError'});usage.quota.mockRejectedValue(error);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const {getOpenAIClient}=await import('../lib/openai-server');await expect(getOpenAIClient().responses.create({model:'gemini-2.5-flash',input:'test'})).rejects.toBe(error);expect(fetcher).not.toHaveBeenCalled();
});
it('switches before opening a stream and reports actual model in terminal event',async()=>{
 const chunks=[{id:'stream',model:'gemini-3.8-flash',choices:[{delta:{content:'OK'},finish_reason:null}]},{id:'stream',model:'gemini-3.8-flash',choices:[{delta:{},finish_reason:'stop'}]}];const sse=chunks.map(chunk=>'data: '+JSON.stringify(chunk)+'\n\n').join('')+'data: [DONE]\n\n';
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(denied()).mockResolvedValueOnce(new Response(sse,{headers:{'content-type':'text/event-stream'}})));
 const {getOpenAIClient}=await import('../lib/openai-server');const stream=await getOpenAIClient().responses.create({model:'gemini-2.5-flash',input:'test',stream:true});const events=[];for await(const event of stream)events.push(event);expect(events).toEqual([{type:'response.output_text.delta',delta:'OK'},{type:'response.completed',response:{model:'opencode/gemini-3.8-flash',usage:undefined}}]);expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({modelo:'gemini-3.8-flash'}),'llm','opencode');
});
it('does not route embeddings through the generation gateway',async()=>{vi.stubEnv('OPENAI_EMBEDDING_API_KEY','embedding-only');const {getEmbeddingClient}=await import('../lib/openai-server');expect(getEmbeddingClient().baseURL).toBe('https://api.openai.com/v1');});
