import { PDFDocument } from "pdf-lib";
import { loadServerPdfJs } from "./pdf-server";
import { geminiPdfDisponible, transcribirPdfConGemini } from "./gemini-pdf";

/** Lector privado acotado: no indexa ni comparte el documento con el corpus. */
export async function readCasePdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(Uint8Array.from(bytes));
  const pageCount = document.getPageCount();
  const pages: Array<{ pageNumber: number; text: string }> = [];
  let readerError: unknown;
  try {
    const pdfjs = await loadServerPdfJs();
    const loadingTask = pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
    const parsed = await loadingTask.promise;
    try {
      for (let number = 1; number <= Math.min(parsed.numPages, 10); number++) {
        const page = await parsed.getPage(number);
        const content = await page.getTextContent();
        const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g," ").trim();
        pages.push({pageNumber:number,text});
      }
    } finally { if ("destroy" in loadingTask && typeof loadingTask.destroy === "function") await loadingTask.destroy(); }
    const text = pages.map(page => `Página ${page.pageNumber}: ${page.text}`).join("\n");
    if (text.trim().length >= 120 && pages.length && pages.every(page => page.text.length >= 20)) return { text:text.slice(0,20000),pageCount,partial:pageCount>pages.length || text.length>20000,method:"pdf-text" };
  } catch (error) { readerError = error; }
  if (!geminiPdfDisponible()) throw new Error("El PDF requiere un lector alternativo u OCR.", { cause: readerError });
  const preview = await PDFDocument.create();
  const copied = await preview.copyPages(document,Array.from({length:Math.min(pageCount,10)},(_,index)=>index));
  copied.forEach(page=>preview.addPage(page));
  const text = await transcribirPdfConGemini(Buffer.from(await preview.save()));
  if (text.trim().length < 10) throw new Error("No se pudo leer el contenido del PDF.");
  // La transcripción por IA no permite acreditar lectura íntegra: se declara
  // parcial incluso si el proveedor devuelve un texto aparentemente completo.
  return { text:text.slice(0,20000),pageCount,partial:true,method:"gemini-pdf-review" };
}
