import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rest:vi.fn(),rows:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:mocks.auth}));
vi.mock("@/lib/supabase-server",()=>({supabaseRest:mocks.rest}));
vi.mock("@/lib/normative-server",()=>({loadNormativeRows:mocks.rows}));
import {GET} from "@/app/api/norms/[id]/route";
const id="43b7991a-0768-45c2-a1a0-7c4d0c62abef";
const context=(value=id)=>({params:Promise.resolve({id:value})});
const doc={id,title:"Reglamento",document_type:"reglamento",source_entity:"OECE",process_type:"todos",status:"indexed",metadata:{regime:"32069",regimeReviewed:true}};
beforeEach(()=>{
  vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"user"}});
  mocks.rest.mockImplementation(async(path:string)=>path.startsWith("documents?")?[doc]:[]);
  mocks.rows.mockResolvedValue([]);
});
it("rechaza UUID inválido antes de consultar",async()=>{
  expect((await GET(new Request("http://localhost"),context("x&select=*"))).status).toBe(400);expect(mocks.rest).not.toHaveBeenCalled();
});
it("solo abre originales institucionales indexados",async()=>{
  await GET(new Request("http://localhost"),context());
  expect(mocks.rest.mock.calls[0][0]).toContain("es_institucional=eq.true&status=eq.indexed");
  mocks.rest.mockResolvedValue([]);expect((await GET(new Request("http://localhost"),context())).status).toBe(404);
});
it("explica fallos de referencias sin ocultar el documento",async()=>{
  mocks.rows.mockImplementation(async(path:string)=>{if(path.startsWith("norma_concordancias"))throw new Error("offline");return[];});
  const response=await GET(new Request("http://localhost"),context());const data=await response.json();
  expect(response.status).toBe(200);expect(data.norm.id).toBe(id);expect(data.warnings.join(" ")).toContain("referencias");expect(data.concordanciasByArticle).toEqual({});
});
it("un fallo en el articulado no se presenta como un documento sin artículos",async()=>{
  mocks.rows.mockImplementation(async(path:string)=>{if(path.startsWith("norma_articulos"))throw new Error("offline");return[];});
  expect((await GET(new Request("http://localhost"),context())).status).toBe(500);
});
