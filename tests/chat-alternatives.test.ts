import { expect, it } from "vitest";
import { alternativeQueries, checkedAlternative, parseAlternatives, prioritizeAlternativeSources, renderAlternativeDraft } from "@/lib/chat-alternatives";
import { auditEvidence, evidencePassages } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";

const question = "¿Qué elemento debe contener el requerimiento?\na) La propuesta de factores de evaluación\nb) La propuesta de modalidad de pago\nc) La evaluación de posibilidad de agrupar prestaciones\nd) El tipo de perfil del evaluador";
// Verified against corpus 8371bce1-f773-4ad8-8efa-1266276ae4ec, chunk 50, 2026-10-26.
const quote = "44.2. El área usuaria remite el requerimiento a la DEC. El requerimiento contiene las condiciones de contratación, que incluyen como mínimo lo siguiente, de corresponder: c) Propuesta de modalidad de pago y sistema de entrega.";
const sources = [{ documentTitle: "Reglamento de la Ley 32069", article: "44", pageStart: 24, pageEnd: 25, excerpt: `Artículo 44. Requerimiento ${quote}` }];
const answer = "Alternativa correcta: b) La propuesta de modalidad de pago [F1]";
const verdict = (status = "supported") => JSON.stringify({ claims: [{ id: 1, status, reason: "La disposición corresponde al enunciado", evidence: [{ source: 1, quote }] }] });

it("extrae enunciado y alternativas conservando letras y texto", () => {
 const parsed = parseAlternatives(question)!;
 expect(parsed.stem).toContain("requerimiento"); expect(parsed.stem).not.toContain("factores");
 expect(parsed.options).toHaveLength(4); expect(parsed.options[1]).toEqual({key:"b",text:"La propuesta de modalidad de pago"});
 expect(alternativeQueries(parsed)).toHaveLength(5);
});
it("reconoce opciones en una línea, sin interpretar numerales como alternativas", () => {
 expect(parseAlternatives("¿Cuál es correcta? a) Uno b) Dos")?.options).toHaveLength(2);
 expect(parseAlternatives("Explica los artículos 44.2 y 46.1, incisos a) y b) del reglamento")).toBeNull();
 expect(parseAlternatives("Texto para revisar a) Algo a) Otro")).toBeNull();
});
it("no cambia la negación ni el texto de una opción", () => {
 const parsed = parseAlternatives("¿Cuál NO corresponde? a) Uno b) Dos")!;
 expect(parsed.stem).toContain("NO");
 expect(checkedAlternative("Alternativa correcta: b) Dos [F1]",parsed)?.key).toBe("b");
 expect(checkedAlternative("Alternativa correcta: b) Uno [F1]",parsed)).toBeNull();
 expect(checkedAlternative("La alternativa es b [F1]",parsed)).toBeNull();
});
it("prioriza el encabezado del objeto preguntado frente a un distractor que lo menciona", () => {
 const distractor={excerpt:"Artículo 46. Estrategia de contratación. La DEC analiza el requerimiento y propone factores de evaluación."};
 expect(prioritizeAlternativeSources([distractor,...sources],parseAlternatives(question)!)[0]).toBe(sources[0]);
});
it("entrega pregunta y alternativas al revisor y publica la opción comprobada primero",async()=>{
 let payload:Record<string,unknown>={};
 const review=await auditEvidence(answer,sources,undefined,async(_system,input)=>{payload=JSON.parse(input);return verdict();},question);
 const published=publishEvidence(answer,sources,review,question);
 expect(payload.question).toBe(question);expect(payload.alternatives).toEqual(parseAlternatives(question));
 expect(published).toContain(answer); expect(published).toContain("artículo 44");expect(published).toContain("página 24–25");
});
it("no convierte un extracto o una explicación comprobada en elección de alternativa",async()=>{
 const draft=`${quote} [F1]`;
 const review=await auditEvidence(draft,sources,undefined,async()=>verdict(),question);
 expect(publishEvidence(draft,sources,review,question)).toContain("No pude confirmar una única alternativa");
 expect(review.documentary).toBe("unchecked");
});
it("rechaza elección contradicha y no vuelca el fragmento como respuesta",async()=>{
 const review=await auditEvidence(answer,sources,undefined,async()=>verdict("contradicted"),question);
 const published=publishEvidence(answer,sources,review,question);
 expect(published).not.toContain("Alternativa correcta"); expect(published).not.toContain("Lectura del documento");
});
it("distingue fallo de comprobación de falta de evidencia",async()=>{
 const review=await auditEvidence(answer,sources,undefined,async()=>{throw Error("timeout");},question);
 expect(publishEvidence(answer,sources,review,question)).toContain("no significa que no exista una respuesta");
});
it("no elige cuando el borrador propone dos opciones distintas",async()=>{
 const draft=answer+"\nAlternativa correcta: a) La propuesta de factores de evaluación [F1]";
 const review=await auditEvidence(draft,sources,undefined,async()=>verdict(),question);
 expect(publishEvidence(draft,sources,review,question)).not.toContain("Alternativa correcta:");
});
it("convierte elección estructurada en una afirmación citada sin publicar el análisis no revisado",()=>{
 const data={choice:"b",options:parseAlternatives(question)!.options.map(option=>({key:option.key,status:option.key==="b"?"answers":"does_not_answer",reason:"Análisis interno no revisado"})),evidence:[{source:1}],reason:"El contenido se recoge en el numeral 44.2."};
 const draft=renderAlternativeDraft(JSON.stringify(data),parseAlternatives(question)!,sources);
 expect(draft).toContain(answer);expect(draft).not.toContain("Análisis interno");
 expect(renderAlternativeDraft(JSON.stringify({...data,evidence:[{source:99}]}),parseAlternatives(question)!,sources)).not.toContain("Alternativa correcta");
 expect(renderAlternativeDraft(JSON.stringify({...data,options:data.options.slice(1)}),parseAlternatives(question)!,sources)).not.toContain("Alternativa correcta");
 expect(renderAlternativeDraft("JSON truncado",parseAlternatives(question)!,sources)).not.toContain("Alternativa correcta");
});
it("selecciona evidencia literal por identificador sin reescribir el OCR",async()=>{
 const review=await auditEvidence(answer,sources,undefined,async()=>JSON.stringify({claims:[{id:1,status:"supported",reason:"Responde al enunciado",evidence:[{source:1,passage:1}]}]}),question);
 expect(review.claims[0].status).toBe("supported");expect(review.claims[0].evidence?.[0].quote).toBe(evidencePassages(sources[0].excerpt)[0].quote);
 expect(publishEvidence(answer,sources,review,question)).toContain(answer);
});
it("rechaza identificadores de pasaje inexistentes o citas incompatibles",async()=>{
 for(const evidence of [[{source:1,passage:99}],[{source:1,passage:1,quote:"Texto inventado"}]]){
  const review=await auditEvidence(answer,sources,undefined,async()=>JSON.stringify({claims:[{id:1,status:"supported",reason:"Prueba",evidence}]}),question);
  expect(review.claims[0].status).toBe("insufficient");
 }
});
