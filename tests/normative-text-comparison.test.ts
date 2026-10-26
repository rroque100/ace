import {expect,it} from "vitest";
import {compareTextUnits} from "@/lib/normative-text-comparison";
const units=(values:string[])=>values.map((text,i)=>({id:String(i),text,pageStart:i+1,pageEnd:i+1}));
it("recorre ambos documentos y detecta una inserción central",()=>{const r=compareTextUnits(units(["A","B","C"]),units(["A","nuevo","B","C"]));expect(r.unchanged).toBe(3);expect(r.changes).toEqual([{before:[],after:units(["A","nuevo","B","C"]).slice(1,2)}]);});
it("conserva íntegros los bloques distintos sin inventar una alineación",()=>{const r=compareTextUnits(units(["A","13","B"]),units(["A","113","B"]));expect(r.changes[0].before[0].text).toBe("13");expect(r.changes[0].after[0].text).toBe("113");});
it("no pierde regiones repetidas ni cambios al final",()=>{const r=compareTextUnits(units(["X","X","fin"]),units(["X","X","otro"]));expect(r.unchanged).toBe(2);expect(r.changes[0].before[0].text).toBe("fin");});
