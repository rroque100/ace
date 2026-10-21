import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { requireDec, requireUser } from "@/lib/auth";
import {
  type ArchivoDocumento,
  normalizeArchivoDocKind,
} from "@/lib/archivo";
import { processArchivoDocument } from "@/lib/archivo-processing";
import {
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT =
  "id,document_number,fecha,asunto,title,doc_kind,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at";

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    getSupabaseServerConfig();

    const url = new URL(request.url);
    const docKind = url.searchParams.get("docKind");
    const status = url.searchParams.get("status");

    let query = `archivo_documentos?select=${SELECT}&order=created_at.desc&limit=100`;
    if (docKind) {
      query += `&doc_kind=eq.${encodeURIComponent(docKind)}`;
    }
    if (status) {
      query += `&status=eq.${encodeURIComponent(status)}`;
    }

    const documentos = await supabaseRest<ArchivoDocumento[]>(query);
    return NextResponse.json({ documentos });
  } catch (error) {
    return NextResponse.json(
      {
        documentos: [],
        error: error instanceof Error ? error.message : "No se pudo listar el archivo",
        setupRequired: true,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireDec();
    if ("error" in auth) {
      return auth.error;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const { storageBucket } = getSupabaseServerConfig();
    const titleValue = formData.get("title");
    const title =
      typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;
    const docKind = normalizeArchivoDocKind(formData.get("docKind"));
    const numberValue = formData.get("documentNumber");
    const documentNumber =
      typeof numberValue === "string" && numberValue.trim() ? numberValue.trim().slice(0, 120) : null;
    const fechaValue = formData.get("fecha");
    const fecha =
      typeof fechaValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaValue.trim())
        ? fechaValue.trim()
        : null;
    const asuntoValue = formData.get("asunto");
    const asunto =
      typeof asuntoValue === "string" && asuntoValue.trim() ? asuntoValue.trim().slice(0, 500) : null;

    const storagePath = `archivo/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(storagePath, file);

    const [documento] = await supabaseRest<ArchivoDocumento[]>(`archivo_documentos?select=id`, {
      body: JSON.stringify({
        asunto,
        doc_kind: docKind,
        document_number: documentNumber,
        fecha,
        file_name: file.name,
        file_size: file.size,
        metadata: { uploadSource: "web" },
        mime_type: file.type,
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
        uploaded_by: auth.user.id,
      }),
      method: "POST",
    });

    await writeAuditLog({
      action: "archivo.upload",
      actorReference: auth.user.email ?? auth.user.id,
      details: { docKind, documentNumber, fileName: file.name },
      entityId: documento.id,
      entityType: "archivo_documento",
      module: "archivo",
    });

    // Procesa e indexa en segundo plano descargando el PDF desde Storage (releer el
    // File del request tras la respuesta da bytes corruptos para archivos pequenos).
    after(async () => {
      try {
        const blob = await downloadStorageObject(storageBucket, storagePath);
        const pdfFile = new File([blob], file.name, { type: "application/pdf" });
        const [full] = await supabaseRest<ArchivoDocumento[]>(
          `archivo_documentos?id=eq.${documento.id}&select=${SELECT}`,
        );
        if (full) {
          await processArchivoDocument(full, pdfFile);
        }
      } catch {
        // processArchivoDocument ya persiste el error en el documento.
      }
    });

    return NextResponse.json({ documento, processing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el documento" },
      { status: 500 },
    );
  }
}
