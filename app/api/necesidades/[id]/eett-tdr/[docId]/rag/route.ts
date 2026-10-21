import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { normalizarMetadatosRag, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { type DocumentRecord, getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET → estado de indexación del EETT/TDR + metadatos del pipeline + último job
// + resumen ejecutivo. Es la columna izquierda del modal «Analiza».
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const malos = idsDeRutaInvalidos(docId);
    if (malos) return malos;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,status,error_message,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const [jobs, summaries] = await Promise.all([
      supabaseRest<Array<{ status: string; error_message: string | null; started_at: string | null; completed_at: string | null; metadata: Record<string, unknown> }>>(
        `processing_jobs?document_id=eq.${docId}&select=status,error_message,started_at,completed_at,metadata&order=created_at.desc&limit=1`,
      ).catch(() => []),
      supabaseRest<Array<{ content: string; model: string | null; metadata: Record<string, unknown> }>>(
        `document_summaries?document_id=eq.${docId}&summary_type=eq.executive&select=content,model,metadata&order=created_at.desc&limit=1`,
      ).catch(() => []),
    ]);

    return NextResponse.json({
      documento: {
        id: doc.id,
        file_name: doc.file_name,
        status: doc.status,
        error_message: doc.error_message ?? null,
        metadatos: normalizarMetadatosRag(doc.metadata),
      },
      job: jobs[0] ?? null,
      resumen: summaries[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el estado del RAG" },
      { status: 500 },
    );
  }
}
