import {NextResponse} from "next/server";
import {z} from "zod";
import {requireUser} from "@/lib/auth";
import {supabaseRest} from "@/lib/supabase-server";
import {normativeVersions} from "@/lib/normative-library";
import type {SearchCatalogueRow} from "@/lib/document-search";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
 const auth=await requireUser();if("error" in auth)return auth.error;
 const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get("documentId"));
 if(!id.success)return NextResponse.json({error:"Selecciona un documento exacto"},{status:400});
 try {const rows=await supabaseRest<SearchCatalogueRow[]>("rpc/ace_normative_versions_v1",{method:"POST",body:JSON.stringify({p_document:id.data})});if(!Array.isArray(rows))throw Error();return NextResponse.json({versions:normativeVersions(rows)},{headers:{"Cache-Control":"no-store"}});}
 catch{return NextResponse.json({error:"No se pudieron comprobar las versiones relacionadas. Reintenta."},{status:503});}
}
