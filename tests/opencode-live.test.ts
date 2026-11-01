import {expect,it,vi,describe} from 'vitest';
import {PDFDocument,StandardFonts} from 'pdf-lib';
vi.mock('../lib/uso-ia',()=>({registrarUsoIA:vi.fn(),exigirCuotaIA:vi.fn().mockResolvedValue(undefined)}));
// Explicit opt-in only. Uses public synthetic fixtures, never private corpus data.
describe.skipIf(process.env.ACE_TEST_OPENCODE_LIVE !== '1')('OpenCode live gateway smoke',()=>{
 it('recovers a simulated Gemini 402 with real text, streaming, PDF and audio calls',async()=>{
  vi.stubEnv('GOOGLE_API_KEY','synthetic-primary');
  const originalFetch=globalThis.fetch;let simulated=0;
  vi.stubGlobal('fetch',((url:RequestInfo|URL,init?:RequestInit)=>{if(String(url).startsWith('https://generativelanguage.googleapis.com/')){simulated++;return Promise.resolve(new Response('{"error":{"message":"payment required"}}',{status:402,headers:{'content-type':'application/json'}}));}return originalFetch(url,init);}) as typeof fetch);
  try{
   const {getOpenAIClient}=await import('../lib/openai-server');
   const client=getOpenAIClient();
   const text=await client.responses.create({model:'gemini-2.5-flash',input:'Return only JSON {"ok":true}.',max_output_tokens:256,response_format:{type:'json_object'}} as never,{timeout:30000});
   expect(JSON.parse(text.output_text)).toEqual({ok:true});expect(text.model).toMatch(/^opencode\//);
   const stream=await client.responses.create({model:'gemini-2.5-flash',input:'Responde solo OK.',max_output_tokens:256,stream:true},{timeout:30000});let output='';for await(const event of stream){if(event.type==='response.output_text.delta')output+=event.delta;}expect(output).toContain('OK');
   const {generateGeminiContent}=await import('../lib/gemini-native');
   const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([400,200]).drawText('PUBLIC TEST DOCUMENT: ACE 32069',{font,size:16});
   const read=await generateGeminiContent({contents:[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:Buffer.from(await pdf.save()).toString('base64')}},{text:'Transcribe el texto del documento.'}]}],generationConfig:{maxOutputTokens:256,thinkingConfig:{thinkingBudget:0}}},{model:'gemini-2.5-flash',timeout:30000});expect(read.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('')).toContain('ACE 32069');expect(read.provider).toBe('opencode');
   // One second of synthetic silence: validates the audio modality, not speech accuracy.
   const wav=Buffer.alloc(44+16000*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
   const audio=await generateGeminiContent({contents:[{role:'user',parts:[{inlineData:{mimeType:'audio/wav',data:wav.toString('base64')}},{text:'Transcribe el habla. Si hay silencio, devuelve JSON {"text":""}.'}]}],generationConfig:{maxOutputTokens:256,responseMimeType:'application/json'}},{model:'gemini-2.5-flash',timeout:30000});expect(JSON.parse(audio.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('')??'')).toHaveProperty('text');expect(simulated).toBeGreaterThanOrEqual(1);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}
 },120000);
});
