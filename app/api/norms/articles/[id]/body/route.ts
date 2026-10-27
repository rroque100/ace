import {NextResponse} from "next/server";
import {z} from "zod";
import {requireUser} from "@/lib/auth";
import {supabaseRest} from "@/lib/supabase-server";
const schema=z.object({title:z.string().trim().min(3).max(160),reason:z.string().trim().min(10).max(2000),revision:z.number().int().min(0)});
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 const auth=await requireUser();if("error" in auth)return auth.error;
 if(!auth.user.isAdmin&&!auth.user.isEditor&&!auth.user.isLegal)return NextResponse.json({error:"Requiere permiso de revisión"},{status:403});
 const {id}=await context.params;const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!parsed.success)return NextResponse.json({error:"Revisa título, artículo y motivo"},{status:400});
 try {return NextResponse.json(await supabaseRest("rpc/ace_review_article_body_v1",{method:"POST",body:JSON.stringify({p_article:id,p_actor:auth.user.id,p_title:parsed.data.title,p_reason:parsed.data.reason,p_revision:parsed.data.revision})}));}
 catch(error){return NextResponse.json({error:error instanceof Error&&/40001/.test(error.message)?"El artículo cambió. Vuelve a abrirlo.":"No se pudo guardar la identificación del cuerpo."},{status:422});}
}
