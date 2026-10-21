import { after, NextResponse } from "next/server";
import { requireDec, requireUser } from "@/lib/auth";
import { deleteRecords } from "@/lib/pinecone";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import {
  type DocumentRecord,
  deleteStorageObjects,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DocumentChunkVector = {
  pinecone_vector_id: string | null;
};

async function getDocumentVectors(documentId: string) {
  const chunks = await supabaseRest<DocumentChunkVector[]>(
    `document_chunks?document_id=eq.${documentId}&select=pinecone_vector_id`,
  );
  const vectorIds = chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((vectorId): vectorId is string => Boolean(vectorId));

  return { chunks, vectorIds };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    getSupabaseServerConfig();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id del documento" }, { status: 400 });
    }

    const documents = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${id}&select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at,oficina_id,es_institucional`,
    );
    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Mismo scope que el listado (GET /api/documents): sin esto, el filtro de
    // la biblioteca era solo cosmético — cualquiera con el id podía seguir
    // abriendo el PDF de otra oficina escribiendo la URL a mano.
    //
    // `auth.user.oficinaId != null` es necesario aparte: sin ella, dos
    // documentos sin oficina asignada (`null`) le darían acceso a un usuario
    // sin oficina asignada por la mera igualdad `null === null`.
    const puedeVerlo =
      auth.user.isAdmin ||
      document.es_institucional ||
      (auth.user.oficinaId != null && document.oficina_id === auth.user.oficinaId);
    if (!puedeVerlo) {
      return NextResponse.json({ error: "No tienes acceso a este documento" }, { status: 403 });
    }

    const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
    await writeAuditLog({
      action: "document.download",
      details: {
        fileName: document.file_name,
        storagePath: document.storage_path,
      },
      entityId: document.id,
      entityType: "document",
    });

    return new Response(blob, {
      headers: {
        "Content-Disposition": `inline; filename="${document.file_name.replaceAll('"', "")}"`,
        "Content-Type": document.mime_type || "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo abrir el documento",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Reindexar modifica el corpus compartido: editor o admin.
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    // Reindexar vuelve a pasar el PDF por OCR + IA + embeddings: mismo costo
    // que subirlo. Techo propio para no mezclar con subidas ni con bulk reindex.
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "documents-reindex"),
      RATE_LIMITS.reindex,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id del documento" }, { status: 400 });
    }

    const documents = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${id}&select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at`,
    );
    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Marca el estado de inmediato para feedback en la UI y para que el polling
    // detecte que hay trabajo en curso, antes de procesar en segundo plano.
    await supabaseRest(`documents?id=eq.${id}`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    after(async () => {
      try {
        const { chunks, vectorIds } = await getDocumentVectors(id);
        await deleteRecords(vectorIds);
        await supabaseRest(`document_chunks?document_id=eq.${id}`, {
          method: "DELETE",
        });

        const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
        const file = new File([blob], document.file_name, {
          type: document.mime_type || "application/pdf",
        });
        const indexing = await processPdfForSearch(document, file);

        await writeAuditLog({
          action: "document.reindex",
          details: {
            deletedChunks: chunks.length,
            deletedVectors: vectorIds.length,
            newChunks: indexing.chunkCount,
            pageCount: indexing.pageCount,
            textLength: indexing.textLength,
          },
          entityId: id,
          entityType: "document",
        });
      } catch {
        // processPdfForSearch ya persiste el error en el documento y el job.
      }
    });

    return NextResponse.json({ documentId: id, reindexing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo reindexar el documento",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    getSupabaseServerConfig();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Falta id del documento" }, { status: 400 });
    }

    const documents = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${id}&select=id,title,storage_bucket,storage_path`,
    );

    const document = documents[0];

    if (!document) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const { chunks, vectorIds } = await getDocumentVectors(id);

    await deleteRecords(vectorIds);
    await deleteStorageObjects(document.storage_bucket, [document.storage_path]);
    await supabaseRest(`documents?id=eq.${id}`, {
      method: "DELETE",
    });
    await writeAuditLog({
      action: "document.delete",
      details: {
        chunks: chunks.length,
        storagePath: document.storage_path,
        title: document.title,
        vectors: vectorIds.length,
      },
      entityId: id,
      entityType: "document",
    });

    return NextResponse.json({
      deleted: {
        chunks: chunks.length,
        documentId: id,
        storagePath: document.storage_path,
        vectors: vectorIds.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo eliminar el documento",
      },
      { status: 500 },
    );
  }
}
