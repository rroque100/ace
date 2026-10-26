import {beforeEach,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>vi.fn());vi.mock("@/lib/supabase-server",()=>({supabaseRest:mock}));
import {exactArticleEvidence} from "@/lib/normative-article-evidence";
const a="00000000-0000-4000-8000-000000000001",d="00000000-0000-4000-8000-000000000002";
beforeEach(()=>{mock.mockReset();});
it("recupera por UUID, documento institucional y cuerpo, conservando la versión",async()=>{
 mock.mockResolvedValue([{id:a,document_id:d,article_number:"1",section_title:null,content:"Texto del artículo",page_start:2,page_end:2,metadata:{normativeBody:{id:"reg",title:"Reglamento",reviewed:true}},documents:{id:d,title:"Documento",document_type:"reglamento",source_entity:"Entidad",file_name:"doc.pdf",metadata:{officialVersion:"Versión A"}}}]);
 const result=await exactArticleEvidence(a,d,"reg");expect(result[0].articleId).toBe(a);expect(result[0].bodyId).toBe("reg");expect(result[0].version).toBe("Versión A");expect(mock.mock.calls[0][0]).toContain("documents.es_institucional=eq.true");
 expect(await exactArticleEvidence(a,d,"otro")).toEqual([]);
});
it("no sustituye por otro artículo cuando no está disponible",async()=>{mock.mockResolvedValue([]);expect(await exactArticleEvidence(a,d)).toEqual([]);});
