import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { loadSearchCatalogue } from "@/lib/document-search-server";
import { documentSearchFiltersSchema, matchesSearchCatalogue } from "@/lib/document-search";
import { corpusTypesForGroup } from "@/lib/official-corpus";
import { canonicalSourceEntity, documentaryDates } from "@/lib/search-document-metadata";
import { reviewedRegime } from "@/lib/legal-workspace-filters";
import { documentReviewSummary } from "@/lib/document-review";
import { normTitleMatches } from "@/lib/normative-library";
import { optionalNormativeRows } from "@/lib/normative-server";
import { countReferencedPages } from "@/lib/document-pages";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const requestSchema = z.object({ q:z.string().max(200).default(""), category:z.enum(["normas","jurisprudencia","orientacion"]).default("normas"), page:z.coerce.number().int().min(1).max(10000).default(1), pageSize:z.coerce.number().int().min(5).max(50).default(20), vigencia:z.enum(["","vigente","no vigente","derogado","unknown"]).default("") });
export async function GET(request: Request) {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const options = requestSchema.safeParse(Object.fromEntries(params));
  const filters = documentSearchFiltersSchema.safeParse({ documentType:params.get("documentType")??undefined, processType:params.get("processType")??undefined, sourceEntity:params.get("sourceEntity")??undefined, year:params.get("year")?Number(params.get("year")):undefined, vigencia:params.get("vigencia")??undefined, topic:params.get("topic")??undefined, regime:params.get("regime")??"", includeUnknownRegime:params.get("includeUnknownRegime")==="true", documentTypes:params.get("documentTypes")?.split(",").filter(Boolean), years:params.get("years")?.split(",").filter(Boolean).map(Number) });
  if (!options.success || !filters.success) return NextResponse.json({error:"Revisa los filtros.",norms:[]},{status:400});
  try {
    const rows = await loadSearchCatalogue();
    const categoryRows = rows.filter(row=>corpusTypesForGroup(options.data.category).includes(row.document_type));
    const matches = categoryRows.filter(row=>matchesSearchCatalogue(row,filters.data)&&normTitleMatches(row,options.data.q));
    matches.sort((a,b)=>a.title.localeCompare(b.title,"es")||a.id.localeCompare(b.id));
    const total=matches.length, pages=Math.ceil(total/options.data.pageSize), page=Math.min(options.data.page,Math.max(1,pages));
    const selected=matches.slice((page-1)*options.data.pageSize,page*options.data.pageSize);
    const warnings:string[]=[];
    const ids=`in.(${selected.map(row=>row.id).join(",")})`;
    const [chunks,summaries,references,articles] = selected.length ? await Promise.all([
      optionalNormativeRows<{document_id:string;page_start:number|null;page_end:number|null;pinecone_vector_id:string|null}>(`document_chunks?document_id=${ids}&select=id,document_id,page_start,page_end,pinecone_vector_id`,"No se pudieron comprobar las páginas y el índice de consulta.",warnings),
      optionalNormativeRows<{document_id:string}>(`document_summaries?document_id=${ids}&select=id,document_id`,"No se pudo comprobar la disponibilidad de resúmenes.",warnings),
      optionalNormativeRows<{source_document_id:string}>(`norma_concordancias?source_document_id=${ids}&select=id,source_document_id`,"No se pudieron comprobar las referencias.",warnings),
      optionalNormativeRows<{document_id:string}>(`norma_articulos?document_id=${ids}&select=id,document_id`,"No se pudo comprobar el índice de artículos.",warnings),
    ]) : [[],[],[],[]];
    const norms=selected.map(row=>{
      const own=chunks.filter(item=>item.document_id===row.id);
      const pinecone=row.metadata.pinecone as {verification?:{verified?:boolean}}|undefined;
      const pineconeVerified=pinecone?.verification?.verified===true;
      return { id:row.id,title:row.title,documentType:row.document_type,sourceEntity:canonicalSourceEntity(row.source_entity),processType:row.process_type,status:typeof row.metadata.status==="string"?row.metadata.status:"indexed",regime:reviewedRegime(row.metadata),dates:documentaryDates(row.metadata),review:documentReviewSummary(row.metadata),documentNumber:row.metadata.documentNumber??row.metadata.number??null,year:row.metadata.year??null,vigencia:row.metadata.vigencia??null,topic:row.metadata.topic??null,amends:row.metadata.amends??null,articleCount:articles.filter(item=>item.document_id===row.id).length,pagesDetected:countReferencedPages(own),vectorCount:own.filter(item=>item.pinecone_vector_id).length,pineconeVerified,hasSummary:summaries.some(item=>item.document_id===row.id),concordanceCount:references.filter(item=>item.source_document_id===row.id).length,qualityStatus:warnings.length?"revisar":"lista" };
    });
    return NextResponse.json({norms,total,page,pages,pageSize:options.data.pageSize,warnings,facets:{entities:[...new Set(categoryRows.map(row=>canonicalSourceEntity(row.source_entity)).filter(Boolean))].sort(),years:[...new Set(categoryRows.map(row=>row.metadata.year).filter(value=>typeof value==="number"))].sort((a,b)=>Number(b)-Number(a)),categoryTotal:categoryRows.length}},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"No se pudo completar el listado. Intenta de nuevo; esto no significa que no existan documentos.",norms:[]},{status:503}); }
}
