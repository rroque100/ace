import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET → transmite el PDF del EETT/TDR (para el visor del modal). Solo sirve
// documentos que sean REALMENTE un EETT/TDR de esta necesidad.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id, docId } = await context.params;
  const malos = idsDeRutaInvalidos(id, docId);
  if (malos) return malos;
  try {
    getSupabaseServerConfig();
    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}` +
        `&document_type=eq.bases_integradas&metadata->>kind=eq.eett_tdr&metadata->>necesidadId=eq.${id}` +
        `&select=id,file_name,storage_bucket,storage_path,mime_type`,
    );
    const doc = docs[0];
    if (!doc) return NextResponse.json({ error: "EETT/TDR no encontrado." }, { status: 404 });

    const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
    const bufferPdf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(new Uint8Array(bufferPdf), {
      headers: {
        "Content-Type": doc.mime_type || "application/pdf",
        "Content-Disposition": `inline; filename="${doc.file_name}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el PDF." },
      { status: 500 },
    );
  }
}
