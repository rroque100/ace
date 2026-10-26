import {beforeEach,expect,it,vi} from "vitest";
const rest=vi.hoisted(()=>vi.fn());vi.mock("@/lib/supabase-server",()=>({supabaseRest:rest}));
import {loadNormativeRows,optionalNormativeRows} from "@/lib/normative-server";
beforeEach(()=>vi.resetAllMocks());
it("recorre todas las páginas auxiliares sin cortar en 500",async()=>{
  rest.mockResolvedValueOnce(Array.from({length:500},(_,id)=>({id}))).mockResolvedValueOnce([{id:500}]);
  const result=await loadNormativeRows("table?select=id");expect(result).toHaveLength(501);expect(rest.mock.calls[1][0]).toContain("offset=500");
});
it("un fallo en páginas posteriores no devuelve una lista parcial silenciosa",async()=>{
  rest.mockResolvedValueOnce(Array.from({length:500},(_,id)=>({id}))).mockRejectedValueOnce(new Error("offline"));
  await expect(loadNormativeRows("table?select=id")).rejects.toThrow("offline");
});
it("las consultas auxiliares fallidas incluyen aviso explícito",async()=>{
  rest.mockRejectedValue(new Error("offline"));const warnings:string[]=[];
  expect(await optionalNormativeRows("table?select=id","No se pudo comprobar",warnings)).toEqual([]);expect(warnings).toEqual(["No se pudo comprobar"]);
});
