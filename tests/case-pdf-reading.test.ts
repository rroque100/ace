import {beforeEach,expect,it,vi} from "vitest";
import {PDFDocument,StandardFonts} from "pdf-lib";
const mocks=vi.hoisted(()=>({available:vi.fn(),transcribe:vi.fn()}));
vi.mock("@/lib/gemini-pdf",()=>({geminiPdfDisponible:mocks.available,transcribirPdfConGemini:mocks.transcribe}));
beforeEach(()=>{vi.resetAllMocks();mocks.available.mockReturnValue(false);});
import {readCasePdf} from "@/lib/case-pdf-reading";
it("lee PDFs válidos con streams y preserva páginas sin transferir el buffer original",async()=>{
 const document=await PDFDocument.create();const page=document.addPage();const font=await document.embedFont(StandardFonts.Helvetica);page.drawText("Synthetic case data. Not a legal source. ".repeat(5),{font,size:10});
 const bytes=await document.save();const before=Uint8Array.from(bytes);const result=await readCasePdf(bytes);
 expect(result.pageCount).toBe(1);expect(result.text).toContain("Synthetic case data");expect(result.method).toBe("pdf-text");expect(bytes).toEqual(before);
});

it("limita a diez páginas la transcripción alternativa y la declara parcial",async()=>{
 const document=await PDFDocument.create();for(let index=0;index<12;index++)document.addPage();mocks.available.mockReturnValue(true);
 let submittedPages=0;mocks.transcribe.mockImplementation(async(bytes:Uint8Array)=>{submittedPages=(await PDFDocument.load(bytes)).getPageCount();return "Página 1: transcripción sintética pendiente de revisión.";});
 const result=await readCasePdf(await document.save());expect(submittedPages).toBe(10);expect(result).toMatchObject({pageCount:12,partial:true,method:"gemini-pdf-review"});
});
it("no envía un archivo estructuralmente inválido a transcripción",async()=>{
 mocks.available.mockReturnValue(true);await expect(readCasePdf(new TextEncoder().encode("%PDF-invalid"))).rejects.toThrow();expect(mocks.transcribe).not.toHaveBeenCalled();
});
