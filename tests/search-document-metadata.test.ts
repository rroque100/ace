import { expect, it } from "vitest";
import { canonicalSourceEntity, documentaryDates, normalizedDocumentNumber, normalizedArticle, documentFamily } from "@/lib/search-document-metadata";
import { readSearchSession, searchSessionKey } from "@/lib/document-search-session";
it("normaliza alias sin mezclar unidades emisoras",()=>{
 expect(canonicalSourceEntity("Congreso de la República del Perú")).toBe("Congreso de la República");
 expect(canonicalSourceEntity("Organismo Especializado para las Contrataciones Públicas Eficientes")).toBe("OECE");
 expect(canonicalSourceEntity("OECE - Dirección Técnico Normativa")).toBe("OECE - Dirección Técnico Normativa");
});
it("separa fechas sin convertir año de carga en publicación",()=>{
 expect(documentaryDates({year:2026,importedAt:"2026-10-23T12:00:00Z",publicationDate:"2025-02-30",officialVersion:"Versión A"})).toEqual({published:null,updated:null,imported:"2026-10-23",version:"Versión A"});
});
it("identifica números y artículos con puntuación alternativa",()=>{
 expect(normalizedDocumentNumber("Opinión N.º D000102–2026/OECE-DTN")).toBe(normalizedDocumentNumber("D102-2026-OECE-DTN"));
 expect(normalizedArticle("Art. 17.2º")).toBe("17.2");
});
it("relaciona versiones de la misma identidad pero no tipos diferentes",()=>{
 expect(documentFamily("ley","Texto A",{number:"0099"})).toBe(documentFamily("ley","Texto B",{number:"99"}));
 expect(documentFamily("ley","Texto A",{number:"99"})).not.toBe(documentFamily("reglamento","Texto A",{number:"99"}));
});
it("restaura únicamente estados válidos y recientes por usuario",()=>{
 const raw=JSON.stringify({version:1,savedAt:1000,input:{query:"ejemplo",mode:"all_words",page:2,pageSize:5,filters:{year:2026}}});
 expect(readSearchSession(raw,2000)?.input.page).toBe(2);
 expect(readSearchSession(raw,5*60*60*1000)).toBeNull();
 expect(readSearchSession(raw,999)).toBeNull();
 expect(readSearchSession('{"version":9}',2000)).toBeNull();
 expect(searchSessionKey("alice")).not.toBe(searchSessionKey("bob"));
});

it("compara entradas restauradas sin depender del orden de las claves",async()=>{
 const {sameSearchInput}=await import("@/lib/document-search-session");
 const {documentSearchRequestSchema}=await import("@/lib/document-search");
 const restored=documentSearchRequestSchema.parse({query:"ejemplo",mode:"literal",page:2,pageSize:5,filters:{year:2026,documentType:"ley"}});
 expect(sameSearchInput(restored,{query:"ejemplo",filters:{documentType:"ley",year:2026},pageSize:5,page:1,mode:"literal",sort:"relevance"})).toBe(true);
 expect(sameSearchInput(restored,{...restored,query:"otro"})).toBe(false);
 expect(documentaryDates({importedAt:"2026-10-24T00:07:00Z"}).imported).toBe("2026-10-23");
});

it("una identidad familiar explícita prevalece sobre título y número sin mezclar tipos",()=>{
 expect(documentFamily("bases_estandar","Original",{documentFamilyId:"BASES-LP-OBRAS"})).toBe(documentFamily("bases_estandar","Rectificado",{documentFamilyId:"BASES-LP-OBRAS",number:"99"}));
 expect(documentFamily("ley","Ley A",{documentNumber:"",number:"0099"})).toBe(documentFamily("ley","Ley B",{number:"99"}));
});
