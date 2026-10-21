import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { borrarFicherosDe, type DocumentoConFichero } from "@/lib/necesidad-borrado";
import { type NecesidadDocumento, necesidadDocKinds } from "@/lib/necesidades";
import {
  getSupabaseServerConfig,
  supabaseUserRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SELECT =
  "id,necesidad_id,kind,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,created_at";

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
  const documentos = await supabaseUserRest<NecesidadDocumento[]>(
    auth.user.accessToken,
    `necesidad_documentos?necesidad_id=eq.${id}&select=${SELECT}&order=created_at.asc`,
  );
  return NextResponse.json({ documentos });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const formData = await request.formData();
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
      typeof kindValue === "string" && (necesidadDocKinds as readonly string[]).includes(kindValue)
        ? kindValue
        : "otros";
    const titleValue = formData.get("title");
    const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : file.name;

    const { storageBucket } = getSupabaseServerConfig();
    const storagePath = `necesidades/${id}/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(storagePath, file);

    const [documento] = await supabaseUserRest<NecesidadDocumento[]>(
      auth.user.accessToken,
      `necesidad_documentos?select=${SELECT}`,
      {
        body: JSON.stringify({
          file_name: file.name,
          kind,
          mime_type: file.type,
          necesidad_id: id,
          owner_id: auth.user.id,
          status: "ready",
          storage_bucket: storageBucket,
          storage_path: storagePath,
          title,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "necesidad.document.upload",
      actorReference: auth.user.email ?? auth.user.id,
      details: { kind, fileName: file.name, necesidadId: id },
      entityId: documento.id,
      entityType: "necesidad_documento",
    });

    return NextResponse.json({ documento }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el documento" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const documentoId = new URL(request.url).searchParams.get("documentoId");
  if (!documentoId) {
    return NextResponse.json({ error: "Falta el documento a eliminar" }, { status: 400 });
  }
  const malos = idsDeRutaInvalidos(id, documentoId);
  if (malos) return malos;

  try {
    // El fichero, antes que la fila: al revés se pierde la ruta y el PDF se
    // queda en el almacén sin nadie que lo referencie.
    const [doc] = await supabaseUserRest<DocumentoConFichero[]>(
      auth.user.accessToken,
      `necesidad_documentos?id=eq.${documentoId}&necesidad_id=eq.${id}&select=storage_bucket,storage_path`,
    );
    if (doc) await borrarFicherosDe([doc]);
    await supabaseUserRest(
      auth.user.accessToken,
      `necesidad_documentos?id=eq.${documentoId}&necesidad_id=eq.${id}`,
      { method: "DELETE" },
    );
    await writeAuditLog({
      action: "necesidad.document.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { necesidadId: id },
      entityId: documentoId,
      entityType: "necesidad_documento",
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el documento" },
      { status: 500 },
    );
  }
}
