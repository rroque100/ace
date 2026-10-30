import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";
import {researchBriefSchema} from '@/lib/research-brief';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function PATCH(request:Request){
 const auth=await requireUser();if("error"in auth)return auth.error;
 const raw=await request.json().catch(()=>null);const parsed=researchBriefSchema.partial().extend({id:z.string().uuid(),name:z.string().trim().min(1).max(120).optional()}).safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Revisa la carpeta y sus datos."},{status:400});
 const {id,...parsedChanges}=parsed.data;const changes=Object.fromEntries(Object.entries(parsedChanges).filter(([key])=>Object.hasOwn(raw,key)));if(!Object.keys(changes).length)return NextResponse.json({error:'No hay cambios para guardar.'},{status:400});
 try{const folders=await supabaseUserRest<Array<{id:string;name:string}>>(auth.user.accessToken,`carpetas?id=eq.${id}&owner_id=eq.${auth.user.id}`,{method:"PATCH",body:JSON.stringify(changes)});if(!folders.length)return NextResponse.json({error:"Carpeta no disponible."},{status:404});return NextResponse.json({folder:folders[0]});}catch{return NextResponse.json({error:"No se pudo guardar la investigación."},{status:503});}
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const folders = await supabaseUserRest(
    auth.user.accessToken,
    "carpetas?select=id,name,created_at,research_question,research_objective,research_notes,research_status&order=created_at.asc",
  );
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const payload = folderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
  }
  const [folder] = await supabaseUserRest<Array<{ id: string; name: string }>>(
    auth.user.accessToken,
    "carpetas",
    {
      body: JSON.stringify({ name: payload.data.name, owner_id: auth.user.id }),
      method: "POST",
    },
  );
  return NextResponse.json({ folder });
}
