import { after, NextResponse } from "next/server";
import { requireDec, requireUser } from "@/lib/auth";
import { type ArchivoDocumento, getArchivoNamespace } from "@/lib/archivo";
import { processArchivoDocument } from "@/lib/archivo-processing";
import { deleteRecords } from "@/lib/pinecone";
import {
  deleteStorageObjects,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT =
  "id,document_number,fecha,asunto,title,doc_kind,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at";

type ChunkVector = { pinecone_vector_id: string | null };

async function getVectorIds(documentoId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `archivo_chunks?documento_id=eq.${documentoId}&select=pinecone_vector_id`,
  );
  return chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((id): id is string => Boolean(id));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [document] = await supabaseRest<ArchivoDocumento[]>(
      `archivo_documentos?id=eq.${id}&select=${SELECT}`,
    );
    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
    return new Response(blob, {
      headers: {
        "Content-Disposition": `inline; filename="${document.file_name.replaceAll('"', "")}"`,
        "Content-Type": document.mime_type || "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el documento" },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [document] = await supabaseRest<ArchivoDocumento[]>(
      `archivo_documentos?id=eq.${id}&select=${SELECT}`,
    );
    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    await supabaseRest(`archivo_documentos?id=eq.${id}`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    after(async () => {
      try {
        const namespace = getArchivoNamespace();
        const vectorIds = await getVectorIds(id);
        await deleteRecords(vectorIds, namespace);
        await supabaseRest(`archivo_chunks?documento_id=eq.${id}`, { method: "DELETE" });

        const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
        const file = new File([blob], document.file_name, {
          type: document.mime_type || "application/pdf",
        });
        const result = await processArchivoDocument(document, file);
        await writeAuditLog({
          action: "archivo.reindex",
          actorReference: auth.user.email ?? auth.user.id,
          details: { chunkCount: result.chunkCount, pageCount: result.pageCount },
          entityId: id,
          entityType: "archivo_documento",
          module: "archivo",
        });
      } catch {
        // processArchivoDocument ya persiste el error.
      }
    });

    return NextResponse.json({ documentId: id, reindexing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reindexar el documento" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [document] = await supabaseRest<ArchivoDocumento[]>(
      `archivo_documentos?id=eq.${id}&select=id,title,storage_bucket,storage_path`,
    );
    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const vectorIds = await getVectorIds(id);
    await deleteRecords(vectorIds, getArchivoNamespace());
    await deleteStorageObjects(document.storage_bucket, [document.storage_path]);
    await supabaseRest(`archivo_documentos?id=eq.${id}`, { method: "DELETE" });

    await writeAuditLog({
      action: "archivo.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { title: document.title, vectors: vectorIds.length },
      entityId: id,
      entityType: "archivo_documento",
      module: "archivo",
    });

    return NextResponse.json({ deleted: { documentId: id, vectors: vectorIds.length } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el documento" },
      { status: 500 },
    );
  }
}
