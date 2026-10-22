import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { OFFICIAL_CORPUS_TYPES } from "../lib/official-corpus";
import { downloadOfficialPdf, validateOfficialUrl } from "../lib/official-import/download";
import { findKnownOfficialDocument } from "../lib/official-import/identity";

const entrySchema = z.object({
  title:z.string().min(4), type:z.enum(OFFICIAL_CORPUS_TYPES.map(x=>x.value) as [string,...string[]]),
  publicationUrl:z.string().url(), pdfUrl:z.string().url(), sourceEntity:z.string().min(2),
  number:z.string().optional(), year:z.number().int().optional(), processType:z.string().nullable().optional(),
  versionLabel:z.string().optional(), selectionNote:z.string().optional(),
  regime:z.enum(["32069","30225","no_determinado"]).default("no_determinado"),
  status:z.enum(["selected","indexed","reused","error","excluded"]).default("selected"),
  documentId:z.string().uuid().optional(), sha256:z.string().optional(), error:z.string().optional(),
  verification:z.record(z.string(),z.unknown()).optional(),
});
const manifestSchema=z.object({batch:z.string().regex(/^[a-z0-9-]+$/),entries:z.array(entrySchema)});
async function main(){
  process.loadEnvFile(".env.local");
  const file=process.argv.find(x=>x.endsWith(".json"));
  if(!file)throw Error("Uso: tsx scripts/import-corpus-oficial.ts manifiesto.json [--apply] [--limit=10]");
  const manifest=manifestSchema.parse(JSON.parse(fs.readFileSync(file,"utf8")));
  const apply=process.argv.includes("--apply");
  const selectedType=process.argv.find(x=>x.startsWith("--type="))?.split("=")[1];
  if(selectedType&&!OFFICIAL_CORPUS_TYPES.some(x=>x.value===selectedType))throw Error("Categoría inválida");
  const limit=Number(process.argv.find(x=>x.startsWith("--limit="))?.split("=")[1]??100);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error("Límite inválido");
  for(const entry of manifest.entries){
    validateOfficialUrl(entry.publicationUrl);validateOfficialUrl(entry.pdfUrl);
    if(entry.type==="bases_estandar"&&(!entry.processType||entry.processType==="todos"))throw Error("Bases estándar sin procedimiento: "+entry.title);
  }
  const counts=new Map<string,number>();
  for(const e of manifest.entries.filter(x=>x.status!=="excluded")){const n=(counts.get(e.type)??0)+1;counts.set(e.type,n);if(n>10)throw Error("La categoría supera diez documentos: "+e.type);}
  const cache=path.resolve(".next/official-import",manifest.batch);fs.mkdirSync(cache,{recursive:true});
  const lock=path.join(cache,"run.lock");
  if(fs.existsSync(lock)){
    const owner=Number(fs.readFileSync(lock,"utf8"));
    if(!Number.isSafeInteger(owner)||owner<1)throw Error("Bloqueo de ejecución inválido; requiere revisión");
    try{process.kill(owner,0);throw Error("Ya hay una importación activa");}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;fs.unlinkSync(lock);}
  }
  const fd=fs.openSync(lock,"wx");fs.writeFileSync(fd,String(process.pid));
  const save=()=>fs.writeFileSync(file,JSON.stringify(manifest,null,2)+"\n");
  try{
    const {getSupabaseAdminClient,writeAuditLog}=await import("../lib/supabase-server");
    const {processPdfForSearch,extractPdfPlainText}=await import("../lib/pdf-processing");
    const {deleteDocuments,searchTextRecords}=await import("../lib/pinecone");
    const client=apply?await getSupabaseAdminClient():null;
    let processed=0;
    for(const item of manifest.entries){
      if(item.status==="excluded"||processed>=limit)continue;
      if(selectedType&&item.type!==selectedType)continue;
      if(["indexed","reused"].includes(item.status))continue;
      processed++;
      try{
        const key=createHash("sha256").update(item.pdfUrl).digest("hex");const cacheFile=path.join(cache,key+".pdf");
        const bytes=fs.existsSync(cacheFile)?fs.readFileSync(cacheFile):await downloadOfficialPdf(item.pdfUrl);
        fs.writeFileSync(cacheFile,bytes);
        item.sha256=createHash("sha256").update(bytes).digest("hex");
        const pdfFile=new File([Uint8Array.from(bytes)],key+".pdf",{type:"application/pdf"});
        const {text}=await extractPdfPlainText(pdfFile);
        if(text.length<120)throw Error("PDF sin texto suficiente; requiere revisión OCR");
        if(!apply){console.log("VALIDADO",item.type,item.title,bytes.length);continue;}
        const c=client!;
        const {data:all,error:lookupError}=await c.from("documents").select("*").eq("es_institucional",true);if(lookupError)throw lookupError;
        let document=findKnownOfficialDocument(all,item);
        if(document&&document.metadata?.sha256!==item.sha256){
          const {data:prior,error}=await c.storage.from(document.storage_bucket).download(document.storage_path);if(error)throw error;
          const priorHash=createHash("sha256").update(Buffer.from(await prior.arrayBuffer())).digest("hex");
          if(priorHash!==item.sha256){
            if(document.id===item.documentId)throw Error("El identificador apunta a un PDF diferente; requiere revisión");
            document=undefined;
          }
        }
        // No inspeccionar PDFs ajenos por una mera coincidencia de tamaño.
        // Sin huella conocida, una identidad sin versión requiere revisión.
        const normalizedNumber=(value:unknown)=>typeof value==="string"?value.toUpperCase().replace(/[^A-Z0-9]/g,""):"";
        if(!document&&item.number&&!item.versionLabel&&all.some(x=>x.document_type===item.type&&normalizedNumber(x.metadata?.documentNumber??x.metadata?.number)===normalizedNumber(item.number))){
          throw Error("Posible identidad existente sin huella o versión verificada; requiere revisión de metadatos");
        }
        if(document?.metadata?.number&&item.number&&document.metadata.number!==item.number&&document.metadata?.officialPublicationUrl!==item.publicationUrl){
          item.status="excluded";item.error="PDF idéntico con identidad documental diferente; requiere revisión";save();continue;
        }
        const metadata={...(document?.metadata??{}),sourceUrl:item.pdfUrl,officialPublicationUrl:item.publicationUrl,sha256:item.sha256,importBatch:manifest.batch,importedAt:new Date().toISOString(),uploadSource:"official-import",legalReviewStatus:"pendiente",vigencia:"desconocida",regime:item.regime,officialVersion:item.versionLabel??null,selectionNote:item.selectionNote??null,number:item.number??null,...(item.year?{year:item.year}:{})};
        const reused=Boolean(document);
        if(!document){
          const bucket=process.env.SUPABASE_STORAGE_BUCKET||"documents";const storagePath=`official/${manifest.batch}/${randomUUID()}.pdf`;
          const {error}=await c.storage.from(bucket).upload(storagePath,bytes,{contentType:"application/pdf",upsert:false});if(error)throw error;
          const {data,error:insertError}=await c.from("documents").insert({title:item.title,document_type:item.type,process_type:item.processType??null,source_entity:item.sourceEntity,file_name:(item.number??key).replace(/[^a-zA-Z0-9.-]/g,"-")+".pdf",file_size:bytes.length,mime_type:"application/pdf",storage_bucket:bucket,storage_path:storagePath,status:"uploaded",es_institucional:true,metadata}).select("*").single();
          if(insertError){await c.storage.from(bucket).remove([storagePath]);throw insertError;}document=data;
        }
        item.documentId=document.id;save();
        if(document.status==="indexed"&&document.document_type===item.type&&document.metadata?.documentNumber===(item.number??null)&&document.metadata?.sha256===item.sha256&&document.metadata?.legalReviewStatus==="pendiente"&&document.metadata?.indexedTextComplete===true){
          item.status="reused";
        }else{
          if(document.status!=="uploaded"){
            await deleteDocuments([document.id]);
            const {error}=await c.from("document_chunks").delete().eq("document_id",document.id);if(error)throw error;
          }
          const {data:updated,error}=await c.from("documents").update({document_type:item.type,process_type:item.processType??null,metadata}).eq("id",document.id).select("*").single();if(error)throw error;
          await processPdfForSearch(updated,new File([Uint8Array.from(bytes)],document.file_name,{type:"application/pdf"}));
          item.status=reused?"reused":"indexed";
        }
        const {data:current,error:readError}=await c.from("documents").select("*").eq("id",document.id).single();if(readError)throw readError;
        if(current.status!=="indexed"||current.metadata.indexedTextComplete!==true)throw Error("Indexación no completa");
        const {data:stored,error:storageError}=await c.storage.from(current.storage_bucket).download(current.storage_path);if(storageError)throw storageError;
        if(createHash("sha256").update(Buffer.from(await stored.arrayBuffer())).digest("hex")!==item.sha256)throw Error("Integridad de Storage incorrecta");
        const hits=await searchTextRecords(item.title,3,{documentId:document.id});if(!hits.length)throw Error("Sin recuperación en Pinecone");
        item.verification={pages:current.metadata.pageCount,chunks:current.metadata.chunkCount,pineconeHits:hits.length,complete:true,sha256Verified:true,verifiedAt:new Date().toISOString()};
        delete item.error;save();
        await writeAuditLog({action:"document.import.official",entityType:"document",entityId:document.id,details:{batch:manifest.batch,sourceUrl:item.pdfUrl,sha256:item.sha256,type:item.type,reused}});
        console.log(item.status.toUpperCase(),item.type,item.title,JSON.stringify(item.verification));
      }catch(error){item.status="error";item.error=error instanceof Error?error.message:String(error);if(apply)save();console.error("ERROR",item.title,item.error);}
    }
    console.log("RESUMEN",JSON.stringify(OFFICIAL_CORPUS_TYPES.map(type=>({type:type.value,target:10,selected:manifest.entries.filter(x=>x.type===type.value).length,completed:manifest.entries.filter(x=>x.type===type.value&&["indexed","reused"].includes(x.status)).length,errors:manifest.entries.filter(x=>x.type===type.value&&x.status==="error").length}))));
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
