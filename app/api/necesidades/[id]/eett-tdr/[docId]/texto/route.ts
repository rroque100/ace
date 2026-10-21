import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  mergeDocumentMetadata,
  supabaseRest,
} from "@/lib/supabase-server";
import { extractPdfPagedText } from "@/lib/pdf-processing";
import { geminiPdfDisponible, transcribirPdfConGemini } from "@/lib/gemini-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// GET → LEE EL PDF DEL EETT/TDR EN DETALLE (a demanda). Extrae el texto y, si el
// PDF es un escaneo sin texto seleccionable, aplica OCR (visión) para leer su
// contenido con su numeración. El resultado se CACHEA en metadata.textoExtraido
// para no re-OCR y para que la revisión/generación lo usen como base.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id, docId } = await context.params;
  const malos = idsDeRutaInvalidos(id, docId);
  if (malos) return malos;
  try {
    getSupabaseServerConfig();
    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}` +
        `&document_type=eq.bases_integradas&metadata->>kind=eq.eett_tdr&metadata->>necesidadId=eq.${id}` +
        `&select=id,file_name,storage_bucket,storage_path,mime_type,metadata`,
    );
    const doc = docs[0];
    if (!doc) return NextResponse.json({ error: "EETT/TDR no encontrado." }, { status: 404 });

    // Cache: si ya se leyó antes (metadata.textoExtraido), no se vuelve a OCR.
    const cacheado = typeof doc.metadata?.textoExtraido === "string" ? doc.metadata.textoExtraido : "";
    if (cacheado.trim()) {
      return NextResponse.json({ text: cacheado, pageCount: 0, cached: true });
    }

    const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
    const bufferPdf = Buffer.from(await blob.arrayBuffer());
    const pdfFile = new File([bufferPdf], doc.file_name, { type: doc.mime_type || "application/pdf" });

    // 1) Texto seleccionable (rápido) con marcadores de página.
    let text = "";
    let pageCount = 0;
    try {
      const r = await extractPdfPagedText(pdfFile);
      text = r.text;
      pageCount = r.pageCount;
    } catch {
      /* sin texto seleccionable → es un escaneo */
    }
    // 2) Escaneo (o texto insuficiente): LEER EL PDF DIRECTAMENTE con Gemini
    // nativo — decodifica escaneos que el OCR local (pdfjs/JBig2) no puede, y
    // respeta numeración y páginas. Es la lectura precisa del EETT/TDR.
    if (text.trim().length < 120 && geminiPdfDisponible()) {
      const g = await transcribirPdfConGemini(bufferPdf, doc.mime_type || "application/pdf");
      if (g.trim()) text = g;
    }
    // 3) Último recurso: OCR local por visión (por si no hay Gemini).
    if (text.trim().length < 120) {
      try {
        const r = await extractPdfPagedText(pdfFile, { forceOcr: true });
        if (r.text.trim()) {
          text = r.text;
          pageCount = r.pageCount;
        }
      } catch {
        /* nada legible */
      }
    }

    // Cachear el texto leído (capado) en la metadata del documento (merge atómico).
    if (text.trim()) {
      try {
        await mergeDocumentMetadata(docId, id, { textoExtraido: text.slice(0, 60000) });
      } catch (error) {
        // El texto se devuelve igual aunque no se cachee; se registra el fallo.
        console.error("[eett-tdr/texto] no se pudo cachear el texto:", error);
      }
    }
    return NextResponse.json({ text, pageCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el PDF." },
      { status: 500 },
    );
  }
}
