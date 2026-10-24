import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  search: vi.fn(),
  rest: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));

vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.rate,
  getRateLimitKey: () => "key",
  RATE_LIMITS: { aiSearch: {} },
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
import { POST } from "@/app/api/search/documents/matches/route";
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"alice"}});mocks.rate.mockReturnValue({allowed:true});mocks.rest.mockResolvedValue({matches:[],totalMatches:0});});
const request=(query:string,article?:string)=>new Request("http://localhost/api/search/documents/matches",{method:"POST",body:JSON.stringify({documentId:"00000000-0000-4000-8000-000000000001",query,article,offset:5})});
it.each([["Art. 17.2",undefined,"17.2","17"],["Artículo 1",undefined,"Artículo 1","1"],["garantía","Art. 17.2","garantía","17"]])("normaliza paginación %s como la consulta inicial",async(query,article,expectedQuery,expectedArticle)=>{
 expect((await POST(request(query!,article))).status).toBe(200);
 expect(JSON.parse(mocks.rest.mock.calls[0][1].body)).toMatchObject({p_query:expectedQuery,p_article:expectedArticle,p_offset:5});
});
it("rechaza acceso anónimo antes de consultar corpus",async()=>{mocks.auth.mockResolvedValue({error:new Response(null,{status:401})});expect((await POST(request("Art. 17"))).status).toBe(401);expect(mocks.rest).not.toHaveBeenCalled();});

it("respeta límite de solicitudes sin consultar corpus",async()=>{mocks.rate.mockReturnValue({allowed:false});expect((await POST(request("Art. 17"))).status).toBe(429);expect(mocks.rest).not.toHaveBeenCalled();});
it("un fallo de coincidencias responde con error, no con lista vacía",async()=>{mocks.rest.mockRejectedValue(new Error("offline"));expect((await POST(request("Art. 17"))).status).toBe(503);});
