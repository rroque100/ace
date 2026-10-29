import fs from "node:fs";
import {examQuestionSchema,publicExam,type RawExam} from "../lib/exam-policy";
async function main(){
 process.loadEnvFile(".env.local");
 const {getSupabaseAdminClient}=await import("../lib/supabase-server");
 const {validateExamSources,examRpc}=await import("../lib/exam-server");
 const c=await getSupabaseAdminClient();
 const q=await c.from("exam_questions").select("*").order("created_at");if(q.error)throw q.error;
 const a=await c.from("exam_attempts").select("id,owner_id,state,preview,questions,result").eq("preview",true).eq("state","submitted").order("started_at",{ascending:false}).limit(1).single();if(a.error)throw a.error;
 let checked=0;
 for(const row of q.data){const question=examQuestionSchema.parse({...row,correctOption:row.correct_option,reviewBasis:row.review_basis??"",confirmReview:false});await validateExamSources(question);checked++;}
 const target=q.data.find(x=>x.id===a.data.questions[0].id);if(!target)throw Error("No se encontró el borrador de prueba");
 const draft=examQuestionSchema.parse({...target,correctOption:target.correct_option,status:"draft",reviewBasis:"Prueba automatizada de guardado sin cambios de contenido; revisión jurídica humana pendiente.",confirmReview:false});
 let rejectsWrongSource=false;try{await validateExamSources({...draft,sources:draft.sources.map(s=>({...s,sha256:"0".repeat(64)}))});}catch{rejectsWrongSource=true;}if(!rejectsWrongSource)throw Error("Se aceptó una fuente con versión distinta");
 await examRpc("ace_exam_edit",{p_actor:a.data.owner_id,p_input:draft});
 const after=await c.from("exam_questions").select("revision,status,reviewed_by").eq("id",target.id).single();if(after.error)throw after.error;
 const attempt=await examRpc("ace_exam_get",{p_actor:a.data.owner_id,p_id:a.data.id})as RawExam;
 const frozen=attempt.attempt.questions.find(x=>x.id===target.id);if(!frozen||frozen.revision!==a.data.questions[0].revision||after.data.revision<=frozen.revision)throw Error("El intento no conservó su versión");
 let rejectsOtherOwner=false;try{await examRpc("ace_exam_get",{p_actor:crypto.randomUUID(),p_id:a.data.id});}catch(e){rejectsOtherOwner=(e as {code?:string}).code==="P0002";}if(!rejectsOtherOwner)throw Error("Fallo de aislamiento");
 const anonymous=await Promise.all(["/api/exams","/api/exams/bank",`/api/exams/${a.data.id}`].map(async path=>({path,status:(await fetch("https://ace-rormi.vercel.app"+path)).status})));
 if(anonymous.some(x=>x.status!==401))throw Error("Acceso anónimo inesperado");
 const final=await c.from("exam_questions").select("status");if(final.error)throw final.error;
 const report={checkedAt:new Date().toISOString(),sourcesVerified:checked,draftSaveVerified:after.data.status==="draft"&&after.data.reviewed_by===null,questionRevision:after.data.revision,frozenAttemptRevision:frozen.revision,rejectsWrongSource,rejectsOtherOwner,practiceResult:publicExam(attempt).attempt.result,publishedQuestions:final.data.filter(x=>x.status==="published").length,anonymous};
 fs.writeFileSync("docs/importaciones/simulador-verificacion-produccion-2026-10-29.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
