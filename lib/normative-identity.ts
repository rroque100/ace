export type ArticleIdentityInput={id:string;articleNumber:string;bodyId?:string|null};
export function resolveArticleIdentity<T extends ArticleIdentityInput>(articles:T[], selection:{articleId?:string|null;articleNumber?:string|null;bodyId?:string|null}) {
  const candidates=articles.filter(article=>(!selection.articleId||article.id===selection.articleId)&&(!selection.articleNumber||article.articleNumber===selection.articleNumber)&&(!selection.bodyId||article.bodyId===selection.bodyId));
  if(candidates.length===1)return {status:"found" as const,article:candidates[0]};
  return {status:candidates.length?"ambiguous" as const:"missing" as const,article:null};
}
export function articleBodyIdentity(documentId:string,metadata?:Record<string,unknown>|null) {
  const body=metadata?.normativeBody as Record<string,unknown>|undefined;
  return {bodyId:typeof body?.id==="string"?body.id:`unreviewed:${documentId}`,bodyTitle:typeof body?.title==="string"?body.title:"Cuerpo normativo sin identificar",bodyReviewed:body?.reviewed===true};
}

export function checkReferenceDestination(reference:{targetDocumentId:string|null;targetArticleId:string|null;refArticleNumber:string|null;refDocumentNumber?:string|null;refType?:string|null;sourceDocumentId?:string},target:{documentId:string;articleId?:string|null;articleNumber?:string|null;documentNumber?:string|null;documentType?:string}|null) {
  if(!reference.targetDocumentId||!target)return {valid:false,reason:"Destino no disponible"};
  if(reference.refType==="interno"&&reference.sourceDocumentId&&reference.sourceDocumentId!==target.documentId)return {valid:false,reason:"La referencia interna apunta a otro documento"};
  if(reference.refType&&["ley","reglamento","directiva","opinion"].includes(reference.refType)&&target.documentType!==reference.refType)return {valid:false,reason:"El tipo del documento no coincide con la referencia"};
  if(reference.targetDocumentId!==target.documentId)return {valid:false,reason:"El artículo no pertenece al documento de destino"};
  if(reference.refArticleNumber&&!reference.targetArticleId)return {valid:false,reason:"Falta identificar el artículo exacto"};
  if(reference.targetArticleId!== (target.articleId??null))return {valid:false,reason:"El identificador del artículo no coincide"};
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(reference.refArticleNumber&&normalize(reference.refArticleNumber)!==normalize(target.articleNumber??""))return {valid:false,reason:"El número del artículo no coincide"};
  if(reference.refDocumentNumber&&normalize(reference.refDocumentNumber)!==normalize(target.documentNumber??""))return {valid:false,reason:"El número documental no coincide o no está registrado"};
  return {valid:true,reason:"Documento y artículo comprobados; relación jurídica sin revisar"};
}
