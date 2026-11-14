import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),operate:vi.fn(),start:vi.fn(),catalog:vi.fn(),client:vi.fn(),validate:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:m.auth}));
vi.mock("@/lib/balotarios-server",()=>({operarBalotario:m.operate,iniciarBalotario:m.start,catalogoRevisado:m.catalog,errorBalotario:()=>({status:400,message:"Error"})}));
vi.mock("@/lib/supabase-server",()=>({getSupabaseAdminClient:m.client}));
vi.mock("@/lib/exam-server",()=>({validateExamSources:m.validate}));
import {GET,POST} from "@/app/api/balotarios/route";
import {POST as content} from "@/app/api/balotarios/contenido/route";
const actor="11111111-1111-4111-8111-111111111111";
const req=(p:unknown)=>new Request("https://ace.test/api/balotarios",{method:"POST",body:JSON.stringify(p)});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({error:new Response(null,{status:401})});});
it("sin sesión no consulta intentos ni contenido",async()=>{
  expect((await GET()).status).toBe(401);expect((await POST(req({action:"start",balotario:1}))).status).toBe(401);expect((await content(req({action:"report"}))).status).toBe(401);expect(m.operate).not.toHaveBeenCalled();expect(m.client).not.toHaveBeenCalled();
});
it("el propietario procede de la sesión, no del cliente",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:false}});m.start.mockResolvedValue({id:"nuevo"});
  expect((await POST(req({action:"start",balotario:2,actor:"otro"}))).status).toBe(200);expect(m.start).toHaveBeenCalledWith(actor,2);
});
it("entrega solo el intento del actor con revisión válida y sin puntaje del cliente",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:false}});m.operate.mockResolvedValue({state:"submitted",questions:[]});
  await POST(req({action:"submit",id:actor,revision:3,result:{correct:72},owner_id:"otro"}));
  expect(m.operate).toHaveBeenCalledWith(actor,"submit",{action:"submit",id:actor,revision:3});
});
it("dashboard no cachea resultados ni revela claves activas",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:false}});m.operate.mockResolvedValue({active:{state:"active",questions:[{id:"b1-q1",correcta:"A",explicacion:"clave"}]},history:[]});
  const r=await GET();expect(r.headers.get("cache-control")).toBe("no-store");expect((await r.json()).active.questions[0].correcta).toBeUndefined();
});
it("un usuario común no publica revisiones",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:false}});m.client.mockResolvedValue({});expect((await content(req({questionId:"b1-q1"}))).status).toBe(403);expect(m.validate).not.toHaveBeenCalled();expect(m.client).not.toHaveBeenCalled();
});
it("un detalle exige UUID y toma el propietario de sesión",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:false}});m.operate.mockResolvedValue({state:"submitted",questions:[]});
  expect((await GET(new Request("https://ace.test/api/balotarios?id=invalido"))).status).toBe(400);expect(m.operate).not.toHaveBeenCalled();
  expect((await GET(new Request(`https://ace.test/api/balotarios?id=${actor}&owner_id=otro`))).status).toBe(200);expect(m.operate).toHaveBeenCalledWith(actor,"get",{id:actor});
});
it("no publica una revisión si la cita no coincide con el corpus",async()=>{
  m.auth.mockResolvedValue({user:{id:actor,isAdmin:true}});m.client.mockResolvedValue({});m.validate.mockRejectedValue(Error("Cita no coincide"));
  const p={questionId:"b1-q1",prompt:"Un enunciado editorial de prueba con contexto suficiente.",options:["A","B","C","D"].map(id=>({id,text:`Opción ${id}`})),correct:"A",competency:"COMPETENCIA 1",explanation:"Una explicación editorial de al menos cuarenta caracteres.",sources:[{documentId:actor,chunkId:actor,title:"Reglamento",article:"1",pageStart:1,pageEnd:1,quote:"Pasaje de prueba para contrastar con el documento real.",version:"2026",sha256:"a".repeat(64)}]};
  expect((await content(req(p))).status).toBe(400);expect(m.validate).toHaveBeenCalledWith({regime:"32069",sources:p.sources});
});
