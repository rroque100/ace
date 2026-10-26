import {createServer} from "vite";
import {writeFile} from "node:fs/promises";
process.loadEnvFile(".env.local");
const server=await createServer({server:{middlewareMode:true},appType:"custom"});
try {
  const {loadSearchCatalogue}=await server.ssrLoadModule("/lib/document-search-server.ts");
  const {loadNormativeRows}=await server.ssrLoadModule("/lib/normative-server.ts");
  const {normativeVersions,matchesNormValidity,annotateArticleSections}=await server.ssrLoadModule("/lib/normative-library.ts");
  const rows=await loadSearchCatalogue();
  const document=rows.find(row=>row.document_type==="reglamento");
  if(!document)throw Error("Falta documento de comprobación");
  const articles=await loadNormativeRows(`norma_articulos?document_id=eq.${document.id}&select=id,article_number,content,section_title,ordinal,page_start,page_end`);
  const chunks=await loadNormativeRows(`document_chunks?document_id=eq.${document.id}&select=id,page_start,page_end`);
  const refs=await loadNormativeRows(`norma_concordancias?source_document_id=eq.${document.id}&select=id,source_article_id,ref_type,ref_document_number,ref_article_number,relation_type,raw_text,resolved,target_document_id,target_article_id,targetDoc:documents!target_document_id(id,title),targetArt:norma_articulos!target_article_id(article_number)`);
  const citing=articles.length?await loadNormativeRows(`norma_concordancias?target_article_id=eq.${articles[0].id}&resolved=eq.true&sourceDoc.es_institucional=eq.true&select=id,source_article_id,raw_text,sourceDoc:documents!source_document_id!inner(id,title),sourceArt:norma_articulos!source_article_id(article_number)`):[];
  const groups=normativeVersions(rows);
  const report={checkedAt:new Date().toISOString(),institutionalDocuments:rows.length,types:[...new Set(rows.map(row=>row.document_type))],versionFamilies:groups.length,relatedFamilies:groups.filter(group=>group.total>1).map(group=>({key:group.key,documents:group.documents.map(row=>({id:row.id,title:row.title,dates:row.dates}))})),readingCheck:{documentId:document.id,articles:articles.length,articlesWithSection:articles.filter(row=>row.section_title).length,articlesWithExplicitHeading:annotateArticleSections([...articles].sort((a,b)=>a.ordinal-b.ordinal)).filter(row=>row.section_title).length,articlesWithoutPage:articles.filter(row=>!row.page_start).length,chunks:chunks.length,references:refs.length,incomingReferences:citing.length},validityChecks:{currentExcludedNonCurrent:!matchesNormValidity("no vigente",null,"vigente")},humanLegalReview:"pending"};
  await writeFile("docs/evaluaciones/normativa-audit-2026-10-26.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
}finally{await server.close();}
