import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),catalogue:vi.fn(),optional:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireUser:mocks.auth}));
vi.mock("@/lib/document-search-server",()=>({loadSearchCatalogue:mocks.catalogue}));
vi.mock("@/lib/normative-server",()=>({optionalNormativeRows:mocks.optional}));
import {GET} from "@/app/api/norms/route";
import {GET as versions} from "@/app/api/norms/versions/route";
const rows=Array.from({length:350},(_,index)=>({id:`document-${index.toString().padStart(3,"0")}`,title:`Norma ${index.toString().padStart(3,"0")}`,document_type:"ley",source_entity:"OECE",process_type:"todos",metadata:{year:2025,vigencia:index%2?"vigente":"no vigente"}}));
const request=(query="")=>new Request(`http://localhost/api/norms?${query}`);
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"user"}});mocks.catalogue.mockResolvedValue(rows);mocks.optional.mockResolvedValue([]);});
it("exige autenticación antes de consultar documentos",async()=>{
  mocks.auth.mockResolvedValue({error:new Response(null,{status:401})});
  expect((await GET(request())).status).toBe(401);expect(mocks.catalogue).not.toHaveBeenCalled();
});
it("rechaza estados, categorías y páginas inválidos",async()=>{
  for(const query of ["vigencia=cualquiercosa","category=privado","page=0","pageSize=200","year=NaN"]){expect((await GET(request(query))).status).toBe(400);}
});
it("pagina sin perder los documentos posteriores a los antiguos 300",async()=>{
  const data=await (await GET(request("page=17&pageSize=20"))).json();
  expect(data.total).toBe(350);expect(data.pages).toBe(18);expect(data.norms[0].id).toBe("document-320");expect(data.norms).toHaveLength(20);
  const paths=mocks.optional.mock.calls.map(call=>call[0]);expect(paths.every(path=>path.includes("document-320")&&!path.includes("document-000"))).toBe(true);
});
it("vigente no incluye no vigente y los filtros se aplican antes de paginar",async()=>{
  const data=await (await GET(request("vigencia=vigente&pageSize=5"))).json();
  expect(data.total).toBe(175);expect(data.norms.every((row:{vigencia:string})=>row.vigencia==="vigente")).toBe(true);
});
it("busca títulos y devuelve facetas del catálogo sin confundirlas con coincidencias",async()=>{
  const data=await (await GET(request("q=Norma%20349"))).json();
  expect(data.total).toBe(1);expect(data.facets.categoryTotal).toBe(350);expect(data.norms[0].id).toBe("document-349");
});
it("publica fallos parciales y mantiene el documento legible",async()=>{
  mocks.optional.mockImplementation(async(_path,_message,warnings)=>{warnings.push("Comprobación pendiente");return[];});
  const data=await (await GET(request())).json();expect(data.warnings.length).toBeGreaterThan(0);expect(data.norms).toHaveLength(20);
});
it("un fallo de catálogo no se presenta como cero coincidencias",async()=>{
  mocks.catalogue.mockRejectedValue(new Error("secret database detail"));
  const response=await GET(request());expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret database detail");
});
it("versiones incluye bases, acuerdos y los otros tipos disponibles",async()=>{
  mocks.catalogue.mockResolvedValue([ {...rows[0],document_type:"bases_estandar"},{...rows[1],document_type:"acuerdo_sala_plena"} ]);
  const data=await(await versions()).json();expect(data.versions.map((group:{documents:Array<{documentType:string}>})=>group.documents[0].documentType)).toEqual(["bases_estandar","acuerdo_sala_plena"]);
});
