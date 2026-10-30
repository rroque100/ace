import {describe,it,expect} from 'vitest';
import {responseAiIdentity} from '../lib/response-ai-identity';
describe('visible answer provider identity',()=>{
 it('identifies gateways from actual model prefixes, even if older telemetry names the primary',()=>{expect(responseAiIdentity({model:'opencode/gemini-3.8-flash',provider:'gemini'})).toMatchObject({kind:'confirmed',provider:'OpenCode',model:'gemini-3.8-flash'});expect(responseAiIdentity({model:'zai/glm-4.5-flash'})).toMatchObject({provider:'Z.ai',model:'glm-4.5-flash'});});
 it('reads direct models from restored history without requiring telemetry',()=>{expect(responseAiIdentity({model:'gemini-2.5-flash'}).provider).toBe('Google Gemini');expect(responseAiIdentity({model:'gpt-4.1-mini'}).provider).toBe('OpenAI');expect(responseAiIdentity({model:'glm-4.5-flash'}).provider).toBe('Z.ai');});
 it('does not claim an active provider before generation finishes',()=>{expect(responseAiIdentity({streaming:true,model:'zai/glm-4.5-flash'})).toMatchObject({kind:'pending',model:null});});
 it('separates guidance and extractive fallback from generated answers',()=>{for(const model of ['assistant-intro','needs-clarification','out-of-scope','fallback-source-extract (provider error)'])expect(responseAiIdentity({model,provider:'gemini'}).kind).toBe('system');});
 it('does not display raw errors or invent identities for missing/unknown models',()=>{for(const model of [undefined,'unknown-model','error: sensitive details here'])expect(responseAiIdentity({model})).toMatchObject({kind:'unknown',model:null});expect(responseAiIdentity({model:'gemini-2.5-flash',error:'network interrupted'}).kind).toBe('unknown');});
 it('uses the recorded provider for custom valid model identifiers',()=>{expect(responseAiIdentity({model:'custom-model',provider:'openai'})).toMatchObject({kind:'confirmed',provider:'OpenAI',model:'custom-model'});});
});
