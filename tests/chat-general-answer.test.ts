import {expect,it,vi} from "vitest";
import {planQuestion,isCaseQuestion,adaptiveAnswerInstruction} from "@/lib/chat-question-plan";
import {analyzeAnswerLayout,renderCheckedAnswer,checkedAnswerSections} from "@/lib/chat-answer-layout";
import {auditEvidence,evidenceClaims,initialEvidenceReview} from "@/lib/chat-evidence-audit";
import {publishEvidence} from "@/lib/chat-evidence-publication";
import {comparisonDraft} from "@/lib/chat-comparison-draft";
import {compactRetryParams,generationIncomplete} from "@/lib/chat-generation-completeness";
import {caseInformationNeeds} from "@/lib/chat-question-plan";
const source={documentTitle:"Documento sintético",excerpt:"El equipo presenta una ficha de prueba. El revisor registra una observación de prueba. El plazo ficticio es de cinco días.",article:"X",pageStart:1,pageEnd:1};
const one="El equipo presenta una ficha de prueba. [F1]",two="El revisor registra una observación de prueba. [F1]";
const complete=async(_system:string,payload:string)=>JSON.stringify({claims:JSON.parse(payload).claims.map((claim:{id:number})=>({id:claim.id,status:"supported",reason:"Pasaje de prueba",evidence:[{source:1,passage:1}]}))});

it.each([
 ["Explica qué significa una garantía", "explanation"],
 ["Enumera los requisitos para contratar", "requirements"],
 ["Describe paso a paso el procedimiento", "procedure"],
 ["Compara estas normas", "comparison"],
 ["Resume el documento seleccionado", "summary"],
 ["¿Qué plazo corresponde?", "numeric"],
 ["¿Qué procede en mi contrato?", "case"],
 ["¿Cuál corresponde? a) Uno b) Dos", "alternatives"],
])("orienta el formato de %s sin fijar una respuesta jurídica",(question,task)=>{
 expect(planQuestion(question).tasks).toContain(task);expect(adaptiveAnswerInstruction(question)).toContain("fuentes");
});
it("combina tareas y limita consultas sin inventar términos o referencias",()=>{
 const question="¿Qué requisitos corresponden? ¿Qué plazo se aplica? ¿Qué documentos debo revisar? ¿Cómo presento la solicitud?";
 const plan=planQuestion(question);expect(plan.subqueries).toHaveLength(3);expect(plan.truncated).toBe(true);
 expect(plan.tasks).toEqual(expect.arrayContaining(["requirements","numeric"]));
 expect(plan.subqueries.every(query=>question.includes(query))).toBe(true);
 expect(planQuestion("Explica el procedimiento completo").subqueries).toEqual([]);
});
it("no convierte una búsqueda general por año en un caso ni pide hechos inexistentes",()=>{
 expect(isCaseQuestion("Resume las opiniones de 2026")).toBe(false);
 expect(isCaseQuestion("Se convocó en 2025, ¿qué corresponde?")).toBe(true);
 const review=initialEvidenceReview();publishEvidence("",[source],review,"Resume las opiniones de 2026");
 expect(review.queryScope).toBe("general");expect(review.missing).toEqual([]);
});
it("conserva listas revisadas y no publica un encabezado que afirma una regla sin respaldo",async()=>{
 const draft=`## El contrato siempre es válido\n## Requisitos\n- ${one}\n- ${two}`;
 const review=await auditEvidence(draft,[source],undefined,async(_system,payload)=>{
  const claims=JSON.parse(payload).claims;return JSON.stringify({claims:claims.map((claim:{id:number;markers:number[]})=>({id:claim.id,status:claim.markers.length?"supported":"insufficient",reason:"Prueba",evidence:claim.markers.length?[{source:1,passage:1}]:[]}))});
 },"Enumera los requisitos de prueba");
 const result=publishEvidence(draft,[source],review,"Enumera los requisitos de prueba");
 expect(result).toContain("**Requisitos**");expect(result).toContain(`- ${one}`);expect(result).toContain(`- ${two}`);expect(result).not.toContain("siempre es válido");
});
it("revisa cada fila de tabla junto con sus encabezados y conserva la tabla",async()=>{
 const draft="| Aspecto | Regla |\n| --- | --- |\n| Registro | El equipo presenta una ficha de prueba. [F1] |\n| Revisión | El revisor registra una observación de prueba. [F1] |";
 const claims=evidenceClaims(draft);expect(claims).toHaveLength(2);expect(claims[0].text).toContain("Aspecto: Registro");expect(claims[0].text).toContain("Regla:");
 const review=await auditEvidence(draft,[source],undefined,complete,"Compara las actuaciones de prueba");
 expect(publishEvidence(draft,[source],review,"Compara las actuaciones de prueba")).toContain("| Aspecto | Regla |");
 const partial=renderCheckedAnswer(draft,new Set([claims[0].id]));expect(partial).toContain("Registro");expect(partial).not.toContain("Revisión");
});
it("un encabezado de tabla con una cifra no comprobada no elude la revisión",async()=>{
 const draft="| Se exige el 99% | Regla |\n| --- | --- |\n| Registro | El equipo presenta una ficha de prueba. [F1] |";
 const review=await auditEvidence(draft,[source],undefined,complete,"Compara las reglas de prueba");
 expect(review.claims[0].status).toBe("insufficient");expect(publishEvidence(draft,[source],review,"Compara las reglas de prueba")).not.toContain("99%");
});
it("retiene afirmaciones correctas después de la primera tanda y declara el límite total",async()=>{
 const draft=Array(51).fill(one).join("\n");const reviewer=vi.fn(complete);
 const review=await auditEvidence(draft,[source],undefined,reviewer,"Resume las actuaciones de prueba");
 expect(reviewer).toHaveBeenCalledTimes(3);expect(review.claims).toHaveLength(51);
 expect(review.claims.filter(claim=>claim.status==="supported")).toHaveLength(48);expect(review.reviewStatus).toBe("incomplete");expect(review.failureReason).toBe("review_limit");
 expect(review.warnings.join(" ")).toContain("48");
});
it("un fallo de una tanda no elimina las otras afirmaciones comprobadas",async()=>{
 const review=await auditEvidence(Array(20).fill(one).join("\n"),[source],undefined,async(system,payload)=>{
  if(JSON.parse(payload).batch.number===2)throw Error("timeout");return complete(system,payload);
 },"Resume las actuaciones de prueba");
 expect(review.claims.filter(claim=>claim.status==="supported")).toHaveLength(16);expect(review.documentary).toBe("partial");expect(review.reviewStatus).toBe("incomplete");expect(review.failureReason).toBe("provider_error");
});
it("la lectura parcial no pierde listas y mantiene el desarrollo adicional plegable",()=>{
 const draft=`${one}\n${two}`;const parsed=analyzeAnswerLayout(draft);
 const result=checkedAnswerSections(draft,new Set(parsed.claims.map(claim=>claim.id)));
 expect(result.main).toContain(one);expect(result.detail).toContain(two);
});
it("construye una tabla estructurada con referencias numéricas o F sin duplicar citas",()=>{
 const raw=JSON.stringify({headers:["Aspecto","Contenido"],rows:[{cells:["Registro","La ficha de prueba [F1]"],sources:["F1"]}]});
 const draft=comparisonDraft(raw,1);expect(draft).toContain("| Aspecto | Contenido |");expect(draft.match(/\[F1\]/g)).toHaveLength(1);
 expect(comparisonDraft(raw,0)).not.toContain("| Aspecto");expect(comparisonDraft("JSON cortado",1)).not.toContain("| Aspecto");
});
it("detecta cortes de los proveedores y limita el presupuesto del único reintento",()=>{
 expect(generationIncomplete({status:"incomplete"})).toBe(true);
 expect(generationIncomplete({raw:{choices:[{finish_reason:"length"}]}})).toBe(true);
 expect(generationIncomplete({status:"completed"})).toBe(false);
 const retry=compactRetryParams({max_output_tokens:20000,input:[{role:"user",content:"Consulta"}]});
 expect(retry.max_output_tokens).toBe(6000);expect(retry.input).toHaveLength(2);
});
it("pide solo información pertinente y no añade hechos faltantes a un resumen",()=>{
 expect(caseInformationNeeds("Resume mi contrato")).toEqual([]);
 expect(caseInformationNeeds("En mi contrato de bienes, ¿qué plazo aplica?",{regime:"Declarado",dates:"01/02/2026",facts:"Hechos declarados"})).toEqual([]);
});
