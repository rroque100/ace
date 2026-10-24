import { describe,it,expect } from "vitest";
import { catalogueSuggestions, fallbackProposal, parseAssistantProposal, readableSearchPreview } from "../lib/search-assistant";
import { documentSearchRequestSchema,matchesSearchCatalogue } from "../lib/document-search";
const proposal=(overrides:Record<string,unknown>={})=>JSON.stringify({destination:"/busqueda",explanation:"Buscar documentos",search:{query:"garantías",mode:"semantic",filters:{}},...overrides});
describe("search assistant boundaries",()=>{
  it("accepts navigation without document criteria but still validates the destination",()=>{
    expect(parseAssistantProposal(JSON.stringify({destination:"/guardado",explanation:"Abrir guardados"}),"global","consultas guardadas").destination).toBe("/guardado");
    expect(()=>parseAssistantProposal(JSON.stringify({destination:"/configuracion",explanation:"Abrir"}),"global","configuración")).toThrow();
  });
  it("normalizes provider filter lists and rejects duplicate ambiguous criteria",()=>{
    const search={query:"garantía de fiel cumplimiento",mode:"all_words",filters:[{documentType:"opinion"},{year:"2026"}]};
    expect(parseAssistantProposal(proposal({search}),"search","opiniones de 2026 sobre garantías").search.filters).toEqual({documentType:"opinion",year:2026});
    expect(()=>parseAssistantProposal(proposal({search:{...search,filters:[{year:2026},{year:2025}]}}),"search","2026")).toThrow();
  });
  it("rejects arbitrary and privileged destinations",()=>{
    for(const destination of ["https://evil.test","/configuracion","javascript:alert(1)"]) expect(()=>parseAssistantProposal(proposal({destination}),"global","garantías")).toThrow();
  });
  it("keeps quoted exact searches even when AI proposes broadening",()=>{
    expect(parseAssistantProposal(proposal(),"search",'buscar "fiel cumplimiento"').search).toMatchObject({query:"fiel cumplimiento",mode:"literal"});
    expect(fallbackProposal('buscar "fiel cumplimiento"').search.mode).toBe("literal");
  });
  it("removes inferred regime, dates and private document constraints",()=>{
    const result=parseAssistantProposal(proposal({search:{query:"garantías",filters:{regime:"32069",year:2026,article:"113",documentId:"00000000-0000-4000-8000-000000000000"}}}),"search","garantías");
    expect(result.search.filters).toEqual({});
  });
  it("suggests only real titles and folds accents",()=>{
    const rows=[{documentId:"1",title:"Opinión sobre garantías"},{documentId:"2",title:"Directiva de pagos"}];
    expect(catalogueSuggestions(rows,"opinion garan")).toEqual([rows[0]]);
    expect(catalogueSuggestions(rows,"inexistente")).toEqual([]);
  });
  it("removes standalone signature noise without changing substantive statements",()=>{
    expect(readableSearchPreview("Firmado digitalmente por Juan\nArtículo 10. La firma digital es válida.")).toBe("Artículo 10. La firma digital es válida.");
    const original="https://apps.firmaperu.gob.pe/web/ validador.xhtml Expediente N° 114947 T.D. 33507508 Solicitante: Entidad Asunto: Garantías";
    expect(readableSearchPreview(original)).not.toContain("114947");
    expect(readableSearchPreview(original)).toContain("Asunto: Garantías");
  });
  it("never treats import date as original publication",()=>{
    const row={id:"1",title:"Norma",document_type:"ley",source_entity:null,process_type:null,metadata:{importedAt:"2026-01-01T00:00:00Z",year:2026}};
    expect(matchesSearchCatalogue(row,{publishedFrom:"2026-01-01"})).toBe(false);
    expect(matchesSearchCatalogue({...row,metadata:{publicationDate:"2026-01-01"}},{publishedFrom:"2026-01-01",publishedTo:"2026-01-01"})).toBe(true);
    expect(documentSearchRequestSchema.safeParse({query:"garantías",filters:{publishedFrom:"2026-02-01",publishedTo:"2026-01-01"}}).success).toBe(false);
  });
});
