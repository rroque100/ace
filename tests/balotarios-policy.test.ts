import { describe, it, expect } from "vitest";
import { catalogoBalotarios, diagnosticoBalotarios } from "@/lib/balotarios-catalogo";
import { barajarPreguntas, calificar, comandoBalotario, intentoPublico, segundosRestantes, type IntentoBalotario } from "@/lib/balotarios-policy";
import { estadisticasCompetencia } from "@/lib/balotarios-estadisticas";
describe("balotarios: integridad y resultados", () => {
  const preguntas=catalogoBalotarios.flatMap(b=>b.preguntas);
  it("las cinco colecciones tienen ids estables, 72 preguntas y una clave válida",()=>{
    expect(catalogoBalotarios).toHaveLength(5); expect(new Set(preguntas.map(q=>q.id)).size).toBe(360);
    for(const b of catalogoBalotarios){ expect(b.preguntas).toHaveLength(72); for(const q of b.preguntas){expect(q.opciones.map(o=>o.letra)).toEqual(["A","B","C","D"]);expect(q.opciones.some(o=>o.letra===q.correcta)).toBe(true);} }
  });
  it("el diagnóstico mantiene pendientes reales sin dar por revisadas las importadas",()=>{
    const d=diagnosticoBalotarios();expect(d.filter(q=>q.sinCompetencia)).toHaveLength(144);expect(d.find(q=>q.id==="b1-q27")?.incidencia).toBeTruthy();expect(preguntas.every(q=>!q.revisada)).toBe(true);
  });
  it("el barajado no pierde preguntas ni modifica sus claves",()=>{
    const original=catalogoBalotarios[0].preguntas;for(let n=0;n<5;n++){const s=barajarPreguntas(original);expect(new Set(s.map(q=>q.id))).toEqual(new Set(original.map(q=>q.id)));for(const q of s)expect(q.correcta).toBe(original.find(o=>o.id===q.id)?.correcta);}
  });
  it("el vencimiento usa tiempo absoluto aunque se suspenda el navegador",()=>{
    const end="2026-11-13T18:00:00Z";expect(segundosRestantes(end,Date.parse("2026-11-13T17:00:00Z"))).toBe(3600);expect(segundosRestantes(end,Date.parse("2026-11-13T18:05:00Z"))).toBe(0);
  });
  it("distingue errores y omisiones e ignora respuestas ajenas al intento",()=>{
    const qs=preguntas.slice(0,3);const other=qs[1].opciones.find(o=>o.letra!==qs[1].correcta)!.letra;
    expect(calificar(qs,{[qs[0].id]:qs[0].correcta!,[qs[1].id]:other,otro:"A"},"2026-11-13T16:00:00Z","2026-11-13T19:00:00Z")).toEqual({correct:1,incorrect:1,omitted:1,total:3,seconds:7200});
  });
  it("no expone claves ni explicación de un intento activo",()=>{
    const t={state:"active",questions:preguntas.slice(0,1)} as IntentoBalotario;const x=intentoPublico(t);expect(x.questions[0].correcta).toBeUndefined();expect(preguntas[0].correcta).toBeTruthy();
    expect(intentoPublico({...t,state:"submitted"}).questions[0].correcta).toBe(preguntas[0].correcta);
  });
  it("el cliente no puede enviar puntajes, fecha límite ni identidad como parte del inicio",()=>{
    expect(comandoBalotario.parse({action:"start",balotario:1,owner_id:"otro",result:{correct:72},deadline_at:"2099-01-01"})).toEqual({action:"start",balotario:1});
    expect(comandoBalotario.safeParse({action:"save",id:crypto.randomUUID(),revision:-1,questionId:"otro",option:"Z",flagged:false,position:90}).success).toBe(false);
  });
  it("no inventa competencia para preguntas sin clasificar y excluye intentos activos",()=>{
    const q=preguntas[0];const t={state:"submitted",questions:[q],answers:{[q.id]:q.correcta}} as IntentoBalotario;
    expect(estadisticasCompetencia([t,{...t,state:"active"}])).toEqual([{competencia:"Pendiente de clasificar",correctas:1,incorrectas:0,omitidas:0,total:1}]);
  });
});
