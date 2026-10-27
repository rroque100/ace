import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function PATCH(request:Request){
 const auth=await requireUser();if("error"in auth)return auth.error;
 const parsed=folderSchema.extend({id:z.string().uuid()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Revisa la carpeta y su nombre."},{status:400});
 try{const folders=await supabaseUserRest<Array<{id:string;name:string}>>(auth.user.accessToken,`carpetas?id=eq.${parsed.data.id}&owner_id=eq.${auth.user.id}`,{method:"PATCH",body:JSON.stringify({name:parsed.data.name})});if(!folders.length)return NextResponse.json({error:"Carpeta no disponible."},{status:404});return NextResponse.json({folder:folders[0]});}catch{return NextResponse.json({error:"No se pudo renombrar la carpeta."},{status:503});}
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const folders = await supabaseUserRest(
    auth.user.accessToken,
    "carpetas?select=id,name,created_at&order=created_at.asc",
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
