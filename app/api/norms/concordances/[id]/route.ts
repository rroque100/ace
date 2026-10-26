import {NextResponse} from "next/server";
import {z} from "zod";
import {requireUser} from "@/lib/auth";
import {supabaseRest} from "@/lib/supabase-server";
const correction=z.object({documentId:z.string().uuid(),articleId:z.string().uuid().nullable(),reason:z.string().trim().min(10).max(2000),revision:z.number().int().min(0)});
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
 const auth=await requireUser();if("error" in auth)return auth.error;
 if(!auth.user.isAdmin&&!auth.user.isEditor&&!auth.user.isLegal)return NextResponse.json({error:"Requiere permiso de revisión"},{status:403});
 const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Referencia inválida"},{status:400});
 try {
  const rows=await supabaseRest<Array<{id:string;metadata:Record<string,unknown>;source_document_id:string}>>(`norma_concordancias?id=eq.${id}&select=id,metadata,source_document_id`);
  if(!rows[0])return NextResponse.json({error:"Referencia no encontrada"},{status:404});
  const docs=await supabaseRest<Array<{id:string}>>(`documents?id=eq.${rows[0].source_document_id}&es_institucional=eq.true&select=id`);
  if(!docs.length)return NextResponse.json({error:"Fuente no disponible"},{status:404});
  const history=await supabaseRest<Array<{id:string;reason:string;created_at:string;before_state:unknown;after_state:unknown}>>(`normative_reference_reviews?reference_id=eq.${id}&select=id,reason,created_at,before_state,after_state&order=created_at.desc&limit=20`);
  return NextResponse.json({revision:Number(rows[0].metadata?.destinationRevision??0),history},{headers:{"Cache-Control":"no-store"}});
 } catch {return NextResponse.json({error:"No se pudo comprobar el historial de revisión"},{status:503});}
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 const auth=await requireUser();if("error" in auth)return auth.error;
 if(!auth.user.isAdmin&&!auth.user.isEditor&&!auth.user.isLegal)return NextResponse.json({error:"Requiere permiso de revisión"},{status:403});
 const {id}=await context.params;const data=correction.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!data.success)return NextResponse.json({error:"Revisa destino, artículo y motivo"},{status:400});
 try {const saved=await supabaseRest("rpc/ace_correct_reference_v1",{method:"POST",body:JSON.stringify({p_reference:id,p_actor:auth.user.id,p_document:data.data.documentId,p_article:data.data.articleId,p_reason:data.data.reason,p_revision:data.data.revision})});return NextResponse.json(saved);}
 catch(error){const conflict=error instanceof Error&&/40001/.test(error.message);return NextResponse.json({error:conflict?"La referencia cambió. Vuelve a abrir la revisión.":"No se pudo guardar la corrección; revisa el destino y tus permisos."},{status:conflict?409:422});}
}
