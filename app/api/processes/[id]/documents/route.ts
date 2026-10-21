import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { type ProcessDocument, processDocKinds } from "@/lib/processes";
import { reconcileProcessStatus } from "@/lib/process-status";
import { extractPdfPlainText } from "@/lib/pdf-processing";
import {
  downloadStorageObject,
  esIdSeguro,
  getSupabaseServerConfig,
  type DocumentRecord,
  supabaseRest,
  supabaseUserRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_]+/g, "-").slice(0, 80);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const documents = await supabaseUserRest<ProcessDocument[]>(
    auth.user.accessToken,
    `process_documents?process_id=eq.${id}&select=id,process_id,library_document_id,kind,bidder_name,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,metadata,created_at&order=created_at.asc`,
  );
  return NextResponse.json({ documents });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.upload");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const formData = await request.formData();
    const libraryDocumentId = formData.get("libraryDocumentId");
    if (typeof libraryDocumentId === "string" && libraryDocumentId.trim()) {
      // Se valida como UUID ANTES de interpolarlo: esta consulta va con
      // service_role (salta RLS), así que un valor con `&`/`select` embebido
      // podría leer filas/columnas del corpus fuera del alcance del usuario.
      if (!esIdSeguro(libraryDocumentId.trim())) {
        return NextResponse.json({ error: "Documento de biblioteca inválido." }, { status: 400 });
      }
      const [libraryDocument] = await supabaseRest<DocumentRecord[]>(
        `documents?id=eq.${libraryDocumentId.trim()}&select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at&limit=1`,
      );
      if (!libraryDocument) {
        return NextResponse.json({ error: "Documento de biblioteca no encontrado" }, { status: 404 });
      }
      const kindValue = formData.get("kind");
      const kind =
        typeof kindValue === "string" && (processDocKinds as readonly string[]).includes(kindValue)
          ? kindValue
          : libraryDocument.document_type === "bases_integradas"
            ? "bases_integradas"
            : "otros";
      const [linked] = await supabaseUserRest<ProcessDocument[]>(auth.user.accessToken, "process_documents", {
        body: JSON.stringify({
          file_name: libraryDocument.file_name,
          kind,
          library_document_id: libraryDocument.id,
          metadata: {
            linkedFromLibrary: true,
            libraryDocumentType: libraryDocument.document_type,
            libraryProcessType: libraryDocument.process_type,
          },
          mime_type: libraryDocument.mime_type,
          owner_id: auth.user.id,
          process_id: id,
          status: libraryDocument.status === "indexed" ? "ready" : "processing",
          storage_bucket: libraryDocument.storage_bucket,
          storage_path: libraryDocument.storage_path,
          title: libraryDocument.title,
        }),
        method: "POST",
      });
      await writeAuditLog({
        action: "process.document.link_library",
        actorReference: auth.user.email ?? auth.user.id,
        details: { libraryDocumentId: libraryDocument.id, processId: id, user: { entity: auth.user.entity, id: auth.user.id, role: auth.user.role } },
        entityId: linked.id,
        entityType: "process_document",
      });
      const advancedTo = await reconcileProcessStatus(auth.user.accessToken, id);
      return NextResponse.json({ document: linked, linked: true, statusAdvancedTo: advancedTo }, { status: 201 });
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const kindValue = formData.get("kind");
    const kind =
      typeof kindValue === "string" && (processDocKinds as readonly string[]).includes(kindValue)
        ? kindValue
        : "otros";
    const bidderValue = formData.get("bidderName");
    const bidderName = typeof bidderValue === "string" && bidderValue.trim() ? bidderValue.trim() : null;
    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = `procesos/${id}/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(storagePath, file);

    const [document] = await supabaseUserRest<ProcessDocument[]>(auth.user.accessToken, "process_documents", {
      body: JSON.stringify({
        bidder_name: bidderName,
        file_name: file.name,
        kind,
        mime_type: file.type,
        owner_id: auth.user.id,
        process_id: id,
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "process.document.upload",
      details: { kind, fileName: file.name, processId: id },
      entityId: document.id,
      entityType: "process_document",
    });

    const advancedTo = await reconcileProcessStatus(auth.user.accessToken, id);

    // Extrae el texto en segundo plano (descargando de Storage para evitar el bug
    // de corrupcion del buffer del File). NO va a Pinecone: no es corpus.
    after(async () => {
      try {
        await supabaseRest(`process_documents?id=eq.${document.id}`, {
          body: JSON.stringify({ status: "processing" }),
          method: "PATCH",
        }).catch(() => undefined);
        const blob = await downloadStorageObject(storageBucket, storagePath);
        const pdfFile = new File([blob], file.name, { type: "application/pdf" });
        const { text } = await extractPdfPlainText(pdfFile);
        await supabaseRest(`process_documents?id=eq.${document.id}`, {
          body: JSON.stringify({
            extracted_text: text,
            status: text.trim().length > 40 ? "ready" : "error",
            error_message: text.trim().length > 40 ? null : "No se pudo extraer texto (¿PDF escaneado?).",
          }),
          method: "PATCH",
        });
      } catch (error) {
        await supabaseRest(`process_documents?id=eq.${document.id}`, {
          body: JSON.stringify({
            status: "error",
            error_message: error instanceof Error ? error.message.slice(0, 200) : "Error al extraer texto",
          }),
          method: "PATCH",
        }).catch(() => undefined);
      }
    });

    return NextResponse.json({ document, processing: true, statusAdvancedTo: advancedTo }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el documento" },
      { status: 500 },
    );
  }
}
