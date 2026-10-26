import {NextResponse} from "next/server";
import {z} from "zod";
import {requireUser} from "@/lib/auth";
import {supabaseUserRest} from "@/lib/supabase-server";
import {targetTables,workNoteSchema,workNoteSnapshot,workTargetSchema,type WorkTarget} from "@/lib/chat-work-notes";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const auth=await requireUser();if("error" in auth)return auth.error;
 const url=new URL(request.url),type=workTargetSchema.safeParse(url.searchParams.get("targetType")),id=z.string().uuid().safeParse(url.searchParams.get("targetId"));
 if(!type.success||!id.success)return NextResponse.json({error:"Selecciona un destino válido"},{status:400});
 try{const visible=await targetVisible(auth.user.accessToken,type.data,id.data);if(!visible)return NextResponse.json({error:"Destino no disponible"},{status:404});
 const notes=await supabaseUserRest(auth.user.accessToken,`legal_work_notes?owner_id=eq.${auth.user.id}&target_type=eq.${type.data}&target_id=eq.${id.data}&select=id,message_id,snapshot,comment,created_at&order=created_at.desc&limit=50`);
 return NextResponse.json({notes},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudieron consultar las notas; no significa que no existan"},{status:503});}
}
async function targetVisible(token:string,type:WorkTarget,id:string){const rows=await supabaseUserRest<Array<{id:string}>>(token,`${targetTables[type]}?id=eq.${id}&select=id&limit=1`);return rows.length>0;}
export async function POST(request:Request){
 const auth=await requireUser();if("error" in auth)return auth.error;
 const body=workNoteSchema.safeParse(await request.json().catch(()=>null));if(!body.success)return NextResponse.json({error:"Revisa el mensaje, destino y comentario"},{status:400});
 try{
  const [messages,visible]=await Promise.all([supabaseUserRest<Array<{id:string;session_id:string;role:string;content:string;metadata:Record<string,unknown>;sources:unknown[]}>>(auth.user.accessToken,`chat_messages?id=eq.${body.data.messageId}&select=id,session_id,role,content,metadata,sources&limit=1`),targetVisible(auth.user.accessToken,body.data.targetType,body.data.targetId)]);
  if(!visible||messages[0]?.role!=="assistant")return NextResponse.json({error:"El mensaje o destino no está disponible para tu usuario"},{status:404});
  const snapshot=workNoteSnapshot(messages[0]);
  if(new URL(request.url).searchParams.get("preview")==="1")return NextResponse.json({preview:snapshot});
  const notes=await supabaseUserRest<Array<{id:string}>>(auth.user.accessToken,"legal_work_notes",{method:"POST",body:JSON.stringify({owner_id:auth.user.id,message_id:body.data.messageId,target_type:body.data.targetType,target_id:body.data.targetId,snapshot,comment:body.data.comment})});
  return NextResponse.json({note:notes[0],status:"pending_review"},{status:201});
 }catch(error){const duplicate=error instanceof Error&&/23505/.test(error.message);return NextResponse.json({error:duplicate?"Ya existe una nota de esta respuesta para ese destino.":"No se pudo guardar la nota; revisa los permisos o reintenta."},{status:duplicate?409:503});}
}
