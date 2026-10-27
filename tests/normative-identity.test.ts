import {expect,it} from "vitest";
import {resolveArticleIdentity,articleBodyIdentity,checkReferenceDestination} from "@/lib/normative-identity";
it("no escoge el primero cuando se repite el número",()=>{
 const rows=[{id:"a",articleNumber:"1",bodyId:"decreto"},{id:"b",articleNumber:"1",bodyId:"reglamento"}];
 expect(resolveArticleIdentity(rows,{articleNumber:"1"}).status).toBe("ambiguous");
 expect(resolveArticleIdentity(rows,{articleId:"b"}).article?.id).toBe("b");
 expect(resolveArticleIdentity(rows,{articleNumber:"1",bodyId:"decreto"}).article?.id).toBe("a");
});
it("no inventa un cuerpo revisado cuando falta el metadato",()=>{expect(articleBodyIdentity("doc").bodyReviewed).toBe(false);});
it("rechaza un artículo que pertenece a otro documento o lleva otro número",()=>{
 const ref={targetDocumentId:"a",targetArticleId:"x",refArticleNumber:"13"};
 expect(checkReferenceDestination(ref,{documentId:"b",articleId:"x",articleNumber:"13"}).valid).toBe(false);
 expect(checkReferenceDestination(ref,{documentId:"a",articleId:"x",articleNumber:"113"}).valid).toBe(false);
 expect(checkReferenceDestination(ref,{documentId:"a",articleId:"x",articleNumber:"13"}).valid).toBe(true);
});
