import { canonicalSourceEntity } from "../lib/search-document-metadata";
import { officialPublicationDate } from "../lib/official-import/publication-metadata";
async function main() {
  process.loadEnvFile(".env.local");
  const { getSupabaseAdminClient, writeAuditLog } = await import("../lib/supabase-server");
  const client=await getSupabaseAdminClient();
  const {data:rows,error}=await client.from("documents").select("id,source_entity,metadata").eq("es_institucional",true).eq("status","indexed").limit(2001);
  if(error) throw error;
  if(rows.length>2000) throw Error("Catálogo fuera del límite de revisión.");
  let changed=0, dated=0, failures=0;
  for(const row of rows) {
    const metadata={...(row.metadata ?? {})};
    const source=canonicalSourceEntity(row.source_entity);
    let update=source!==row.source_entity;
    if(update) metadata.originalSourceEntity ??= row.source_entity;
    const publication=metadata.officialPublicationUrl;
    if(typeof publication === "string" && !metadata.publicationDate) {
      const url=new URL(publication);
      if(url.protocol==="https:" && ["www.gob.pe","gob.pe"].includes(url.hostname)) {
        try {
          const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
          if(!response.ok) throw Error("Publicación no disponible");
          const date=officialPublicationDate(await response.text());
          if(date) { metadata.publicationDate=date; metadata.publicationDateSource=publication; metadata.publicationDateCheckedAt=new Date().toISOString(); update=true;dated++; }
        } catch { failures++; }
      }
    }
    if(!update) continue;
    const {error:saveError}=await client.from("documents").update({source_entity:source,metadata}).eq("id",row.id).eq("es_institucional",true).eq("status","indexed");
    if(saveError) throw saveError;
    changed++;
    await writeAuditLog({action:"document.metadata.catalogue",entityType:"document",entityId:row.id,details:{publicationDate:metadata.publicationDate??null,canonicalEntity:source,provenance:metadata.publicationDateSource??null}});
  }
  console.log(JSON.stringify({reviewed:rows.length,changed,publicationDatesAdded:dated,officialPageFailures:failures}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Error de catálogo");process.exitCode=1;});
