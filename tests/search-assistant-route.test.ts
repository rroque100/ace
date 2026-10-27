import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rate:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:mocks.auth}));
vi.mock("@/lib/openai-server",()=>({legalAnswerModel:"test",getProvider:()=>"gemini",getOpenAIClient:()=>({responses:{create:mocks.create}})}));
vi.mock("@/lib/rate-limit",()=>({checkRateLimit:mocks.rate,getRateLimitKey:()=>"test",RATE_LIMITS:{aiSearch:{}},rateLimitResponse:()=>new Response(null,{status:429})}));
import {POST} from "@/app/api/search/assistant/route";
const request=(body:unknown)=>new Request("http://localhost/api/search/assistant",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"alice"}});mocks.rate.mockReturnValue({allowed:true});});
it("requires authentication and applies rate limits before AI",async()=>{
  mocks.auth.mockResolvedValueOnce({error:new Response(null,{status:401})});
  expect((await POST(request({text:"buscar"}))).status).toBe(401);
  mocks.rate.mockReturnValueOnce({allowed:false});expect((await POST(request({text:"buscar"}))).status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects malformed requests",async()=>{
  expect((await POST(new Request("http://localhost",{method:"POST",body:"{"}))).status).toBe(400);
  expect((await POST(request({text:"x"}))).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("returns explicitly unassisted editable fallback on provider failure",async()=>{
  mocks.create.mockRejectedValue(new Error("timeout"));
  const response=await POST(request({text:'buscar "fiel cumplimiento"'}));const data=await response.json();
  expect(data.assisted).toBe(false);expect(data.proposal.search).toMatchObject({query:"fiel cumplimiento",mode:"literal"});
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("never returns a privileged route suggested by the model",async()=>{
  mocks.create.mockResolvedValue({output_text:JSON.stringify({destination:"/configuracion",explanation:"x",search:{query:"garantías"}})});
  const data=await (await POST(request({text:"garantías",scope:"global"}))).json();expect(data.proposal.destination).toBe("/busqueda");expect(data.assisted).toBe(false);
});
