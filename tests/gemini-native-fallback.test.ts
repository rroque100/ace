import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {generateGeminiContent} from '../lib/gemini-native';
const ok={candidates:[{content:{parts:[{text:'texto de prueba'}]}}],usage:{promptTokenCount:10,candidatesTokenCount:3}};
beforeEach(()=>{vi.stubEnv('GOOGLE_API_KEY','google-test');vi.stubEnv('OPENCODE_API_KEY','opencode-test');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
describe('native multimodal gateway',()=>{
 it('preserves PDF/audio parts, uses server authorization and accounts for actual provider',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}',{status:402})).mockResolvedValueOnce(new Response(JSON.stringify(ok)));
 vi.stubGlobal('fetch',fetcher);
 const body={contents:[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:'cHVibGljIHRlc3Q='}}]}],generationConfig:{maxOutputTokens:100,thinkingConfig:{thinkingBudget:0}}};
 const result=await generateGeminiContent(body,{model:'gemini-2.5-flash'});
 expect(result.provider).toBe('opencode');expect(result.model).toBe('gemini-3.8-flash');expect(result.usageMetadata?.promptTokenCount).toBe(10);
 const [url,request]=fetcher.mock.calls[1];expect(url).toBe('https://opencode.ai/inference/google/v1beta/models/gemini-3.8-flash:generateContent');expect(request.headers.Authorization).toBe('Bearer opencode-test');expect(url).not.toContain('test');expect(JSON.parse(request.body).contents).toEqual(body.contents);expect(JSON.parse(request.body).generationConfig.thinkingConfig).toEqual({thinkingLevel:'low'});
 expect(body.generationConfig.thinkingConfig).toEqual({thinkingBudget:0});
 });
});

it('invalidates the previous voice consent when the fallback destination changes',async()=>{
 const {voiceConfiguration}=await import('../lib/voice-transcription');
 expect(voiceConfiguration()).toMatchObject({providerId:'gemini-opencode',fallbackProvider:'OpenCode'});
 vi.stubEnv('OPENCODE_FALLBACK_ENABLED','false');
 expect(voiceConfiguration().providerId).toBe('gemini');
});
