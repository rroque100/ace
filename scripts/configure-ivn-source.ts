import fs from "node:fs";
async function main(){
 process.loadEnvFile(".env.local");
 const {getSupabaseAdminClient}=await import("../lib/supabase-server");
 const {officialPage}=await import("../lib/library-updates");
 const {parseOeceCatalogue}=await import("../lib/oece-official-source");
 const url="https://www.gob.pe/institucion/oece/informes-publicaciones?filter%5Bterms%5D=IVN";
 const listing=parseOeceCatalogue(await officialPage(url),url);
 const c=await getSupabaseAdminClient();
 const {data:origin,error}=await c.from("legal_official_sources").select("created_by").eq("url","https://www.gob.pe/institucion/oece/normas-legales").single();
 if(error)throw error;
 await c.from("legal_official_sources").upsert({url,label:"OECE · Informes de Vicios de Nulidad (IVN)",document_type:"informe_vicio_nulidad",source_entity:"OECE",created_by:origin.created_by},{onConflict:"url",ignoreDuplicates:true}).throwOnError();
 const {data:source,error:se}=await c.from("legal_official_sources").select("id").eq("url",url).single();if(se)throw se;
 await c.from("legal_sync_sources").upsert({source_id:source.id,enabled:true,document_types:["informe_vicio_nulidad"],regimes:[],code_prefix:""},{onConflict:"source_id",ignoreDuplicates:true}).throwOnError();
 const report={checkedAt:new Date().toISOString(),sourceId:source.id,url,enabled:true,originalsFound:listing.items.filter(x=>x.detectedType==="informe_vicio_nulidad").length,publications:listing.publications,withoutPdf:listing.withoutPdf,nextUrl:listing.nextUrl,downloadsPerformed:0,coverage:"Catálogo público consultado; no acredita cobertura de SEACE.",requiresAIForDownload:false};
 fs.writeFileSync("docs/importaciones/ivn-fuente-oficial-2026-10-29.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
