import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({search:vi.fn(),rest:vi.fn(),userRest:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/pinecone",()=>({searchTextRecords:mocks.search,rerankWithModel:async()=>null}));
vi.mock("@/lib/openai-server",()=>({getOpenAIClient:()=>({responses:{create:mocks.create}}),legalAnswerModel:"test"}));
vi.mock("@/lib/supabase-server",()=>({supabaseRest:mocks.rest,supabaseUserRest:mocks.userRest,writeAuditLog:async()=>{},institutionalAuditDetails:(x:unknown)=>x}));
import {answerLegalQuestion,chatRequestSchema,streamLegalAnswer} from "@/lib/legal-chat";
import {parseAlternatives} from "@/lib/chat-alternatives";
const question="¿Qué elemento debe contener el requerimiento? a) La propuesta de factores de evaluación b) La propuesta de modalidad de pago c) La evaluación de posibilidad de agrupar prestaciones d) El tipo de perfil del evaluador";
// Content verified against the project's corpus on 2026-10-26, not a production rule.
const content="Artículo 44. Requerimiento 44.2. El área usuaria remite el requerimiento a la DEC. El requerimiento contiene las condiciones de contratación, que incluyen como mínimo lo siguiente, de corresponder: a) El alcance de la contratación, y las condiciones de ejecución, en función de su desempeño y funcionalidad. b) Propuesta de requisitos de calificación y/o precalificación. c) Propuesta de modalidad de pago y sistema de entrega.";
const auth={ownerId:"validation",accessToken:"jwt",persist:false};
const structured=JSON.stringify({choice:"b",options:parseAlternatives(question)!.options.map(option=>({key:option.key,status:option.key==="b"?"answers":"does_not_answer",reason:"Contraste de prueba"})),evidence:[{source:1}],reason:"El numeral 44.2 incluye la propuesta de modalidad de pago."});
const review=JSON.stringify({claims:[1,2].map(id=>({id,status:"supported",reason:"Respaldo directo",evidence:[{source:1,passage:1}]}))});
beforeEach(()=>{
 vi.clearAllMocks();mocks.search.mockResolvedValue([{_id:"vector",_score:0.95}]);
 mocks.rest.mockResolvedValue([{id:"chunk",document_id:"doc",chunk_index:0,pinecone_vector_id:"vector",page_start:24,page_end:25,content,metadata:{article:"44"},documents:{id:"doc",title:"Reglamento de la Ley 32069",document_type:"reglamento",source_entity:"OECE",file_name:"test.pdf",status:"indexed",es_institucional:true,metadata:{}}}]);
 mocks.userRest.mockResolvedValue([]);
});
it("recupera por enunciado y opciones, revisa la pregunta y publica una elección con fuente",async()=>{
 mocks.create.mockResolvedValueOnce({output_text:structured}).mockResolvedValueOnce({output_text:review});
 const result=await answerLegalQuestion(chatRequestSchema.parse({question}),auth);
 expect(result.answer).toContain("Alternativa correcta: b) La propuesta de modalidad de pago");
 expect(result.answer).toContain("artículo 44");expect(result.answer).not.toContain("Lectura del documento");
 expect(mocks.search.mock.calls.some(call=>call[0].includes("requerimiento")&&!call[0].includes("factores"))).toBe(true);
 expect(JSON.parse(mocks.create.mock.calls[1][0].input[1].content).question).toBe(question);
});
it("aplica la misma revisión antes de transmitir una elección en streaming",async()=>{
 mocks.create.mockResolvedValueOnce((async function*(){yield{type:"response.output_text.delta",delta:structured};})()).mockResolvedValueOnce({output_text:review});
 const events=[];for await(const event of streamLegalAnswer(chatRequestSchema.parse({question}),auth))events.push(event);
 const deltas=events.filter(event=>event.type==="delta");expect(deltas).toHaveLength(1);
 expect(JSON.stringify(deltas)).toContain("Alternativa correcta: b)");expect(JSON.stringify(deltas)).not.toContain('"choice"');
});
it("retira una elección contradicha sin mostrar el borrador ni otro artículo como respuesta",async()=>{
 mocks.create.mockResolvedValueOnce({output_text:structured}).mockResolvedValueOnce({output_text:JSON.stringify({claims:[1,2].map(id=>({id,status:"contradicted",reason:"La evidencia no responde al enunciado",evidence:[]}))})});
 const result=await answerLegalQuestion(chatRequestSchema.parse({question}),auth);
 expect(result.answer).not.toContain("Alternativa correcta:");expect(result.answer).not.toContain("Lectura del documento");
});
it("una caída del revisor no publica la alternativa como comprobada",async()=>{
 mocks.create.mockResolvedValueOnce({output_text:structured}).mockRejectedValueOnce(Error("review offline"));
 const result=await answerLegalQuestion(chatRequestSchema.parse({question}),auth);
 expect(result.answer).toContain("No pude completar la comprobación");expect(result.answer).not.toContain("Alternativa correcta:");
 expect(result.assessment.evidenceReview?.reviewStatus).toBe("failed");
});
