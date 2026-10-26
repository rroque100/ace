import {z} from "zod";
import {supabaseRest} from "./supabase-server";
import {articleBodyIdentity} from "./normative-identity";
import {documentaryDates} from "./search-document-metadata";
import type {LegalSource} from "./legal-chat";
export async function exactArticleEvidence(articleId:string,documentId?:string,bodyId?:string):Promise<LegalSource[]> {
 if(!z.string().uuid().safeParse(articleId).success||(documentId&&!z.string().uuid().safeParse(documentId).success))return [];
 const rows=await supabaseRest<Array<{id:string;document_id:string;article_number:string;section_title:string|null;content:string;page_start:number|null;page_end:number|null;metadata:Record<string,unknown>;documents:{id:string;title:string;document_type:string;source_entity:string|null;file_name:string;metadata:Record<string,unknown>}}>>(`norma_articulos?id=eq.${articleId}${documentId?`&document_id=eq.${documentId}`:""}&documents.es_institucional=eq.true&documents.status=eq.indexed&select=id,document_id,article_number,section_title,content,page_start,page_end,metadata,documents!inner(id,title,document_type,source_entity,file_name,metadata)`);
 const article=rows[0];if(!article?.documents)return [];
 const body=articleBodyIdentity(article.document_id,article.metadata);if(bodyId&&body.bodyId!==bodyId)return [];
 const doc=article.documents;
 return [{articleId:article.id,bodyId:body.bodyId,bodyTitle:body.bodyTitle,version:documentaryDates(doc.metadata).version,selectionOrigin:"selected",requestedOriginal:true,referenceRelation:"original",citation:`${doc.title} · ${body.bodyTitle} · art. ${article.article_number} · pág. ${article.page_start??"sin registrar"}`,chunkId:article.id,documentId:article.document_id,documentTitle:doc.title,documentNumber:typeof doc.metadata.documentNumber==="string"?doc.metadata.documentNumber:null,documentType:doc.document_type,fileName:doc.file_name,sourceEntity:doc.source_entity,chunkIndex:0,pageStart:article.page_start,pageEnd:article.page_end,article:article.article_number,sectionTitle:article.section_title,topic:null,processType:null,status:null,vigencia:typeof doc.metadata.vigencia==="string"?doc.metadata.vigencia:null,year:null,score:0.6,semanticScore:0,lexicalScore:0.6,rerankScore:0,evidenceQuality:0.6,matchType:"lexical",excerpt:article.content}];
}
