import fs from "node:fs";
import { classifySearchDocument } from "../lib/document-search";
import { documentFamily } from "../lib/search-document-metadata";

async function main() {
  process.loadEnvFile(".env.local");
  const {loadSearchCatalogue}=await import("../lib/document-search-server");
  const {supabaseRest}=await import("../lib/supabase-server");
  const rows=await loadSearchCatalogue();
  const index:Array<{document_id:string;classification:ReturnType<typeof classifySearchDocument>;family_key:string}>=[];
  let cursor="";
  for(let pageNumber=0;pageNumber<200;pageNumber++) {
    const page=await supabaseRest<typeof index>(`ace_search_documents_v2?select=document_id,classification,family_key&order=document_id${cursor?`&document_id=gt.${encodeURIComponent(cursor)}`:""}&limit=500`);
    index.push(...page);if(page.length<500) break;
    const next=page[page.length-1].document_id;if(next<=cursor||pageNumber===199) throw Error("No se completó la auditoría del índice");cursor=next;
  }
  const indexById=new Map(index.map(item=>[item.document_id,item]));
  const canonical=(value:ReturnType<typeof classifySearchDocument>)=>JSON.stringify({origin:value.origin,objects:[...value.objects].sort(),subjects:[...value.subjects].sort(),topics:[...value.topics].sort()});
  const mismatches=rows.filter(row=>{
    const projection=indexById.get(row.id);
    return !projection || canonical(projection.classification)!==canonical(classifySearchDocument(row)) || projection.family_key!==documentFamily(row.document_type,row.title,row.metadata);
  }).map(row=>row.id);
  const report={checkedAt:new Date().toISOString(),catalogueDocuments:rows.length,indexDocuments:index.length,metadataMismatches:mismatches,coverage:await supabaseRest("rpc/ace_search_library_coverage_v2",{method:"POST",body:"{}"}),types:Object.fromEntries([...new Set(rows.map(row=>row.document_type))].map(type=>[type,rows.filter(row=>row.document_type===type).length])),unconfirmedValidity:rows.filter(row=>row.metadata.legalReviewStatus==="pendiente").length};
  const output=process.argv.find(value=>value.startsWith("--output="))?.slice(9);
  if(output) fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
  if(mismatches.length || rows.length!==index.length) process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:"No se pudo completar la auditoría");process.exitCode=1;});
