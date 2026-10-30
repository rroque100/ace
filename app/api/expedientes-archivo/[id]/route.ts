import { PdfReadError } from "@/lib/pdf-read-error";
import { advanceRagDocument } from "@/lib/archivo-rag-worker";
import { readArchivoFile } from "@/lib/archivo-upload-server";
import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { canAccessArchivoRow, requireDecOrAreaUsuaria, requireUser } from "@/lib/auth";
import {
  ARCHIVO_COLORES,
  type ExpedienteArchivo,
  getExpedientesNamespace,
  normalizeCatalogValue,
  normalizeContenedorTipo,
  normalizePersonaTipo,
} from "@/lib/expedientes-archivo";
import { processExpedienteDocument, reportArchivoProcessingFailure } from "@/lib/expedientes-archivo-processing";
import { deleteRecords } from "@/lib/pinecone";
import {
  deleteStorageObjects,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(0, 80);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,oficina_id,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at,expediente_id,numero_folio";

// Columnas editables vía PATCH (whitelist; nunca status/storage/uploaded_by).
const PATCHABLE_COLUMNS = new Set<string>([
  "sgd_expediente",
  "serie_documento",
  "anio",
  "tipo_documento",
  "asunto",
  "materia",
  "resumen",
  "title",
  "oficina",
  "tipo_almacenamiento",
  "nro_archivador",
  "nro_paquete",
  "empastado",
  "color_archivador",
  "nro_estante",
  "nro_piso",
  "nro_local",
  "folio",
  "observaciones",
  "persona_tipo",
  "persona_documento",
  "persona_nombre",
]);

type ChunkVector = { pinecone_vector_id: string | null };

async function getVectorIds(expedienteId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `expedientes_archivo_chunks?documento_id=eq.${expedienteId}&select=pinecone_vector_id`,
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

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=${SELECT}`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    if (!canAccessArchivoRow(auth.user, { oficina: expediente.oficina, oficinaId: expediente.oficina_id, owner: expediente.uploaded_by })) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const wantsMeta = new URL(_request.url).searchParams.get("meta") === "1";
    if (wantsMeta) {
      return NextResponse.json({ expediente });
    }

    const blob = await downloadStorageObject(expediente.storage_bucket, expediente.storage_path);
    return new Response(blob, {
      headers: {
        "Content-Disposition": `inline; filename="${expediente.file_name.replaceAll('"', "")}"`,
        "Content-Type": expediente.mime_type || "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el expediente" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(_request, auth.user.id, "reindex"),
      RATE_LIMITS.reindex,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();
    const { id } = await context.params;

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=${SELECT}`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (!canAccessArchivoRow(auth.user, { oficina: expediente.oficina, oficinaId: expediente.oficina_id, owner: expediente.uploaded_by })) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    after(async () => {
      try {
        if (expediente.metadata?.uploadSource === "rag-folder" && expediente.status !== "indexed") {
          await advanceRagDocument(expediente);
          return;
        }
        const blob = await downloadStorageObject(expediente.storage_bucket, expediente.storage_path);
        const file = new File([blob], expediente.file_name, {
          type: expediente.mime_type || "application/pdf",
        });
        const result = await processExpedienteDocument(expediente, file);
        await writeAuditLog({
          action: "expedientes.reindex",
          actorReference: auth.user.email ?? auth.user.id,
          details: { chunkCount: result.chunkCount, pageCount: result.pageCount },
          entityId: id,
          entityType: "expediente_archivo",
          module: "expedientes",
        });
      } catch (error) {
        await reportArchivoProcessingFailure(expediente, error);
      }
    });

    return NextResponse.json({ expedienteId: id, reindexing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reindexar el expediente" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=id,title,oficina,uploaded_by,storage_bucket,storage_path`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (!canAccessArchivoRow(auth.user, { oficina: expediente.oficina, oficinaId: expediente.oficina_id, owner: expediente.uploaded_by })) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const vectorIds = await getVectorIds(id);
    await deleteRecords(vectorIds, getExpedientesNamespace());
    await deleteStorageObjects(expediente.storage_bucket, [expediente.storage_path]);
    await supabaseRest(`expedientes_archivo?id=eq.${id}`, { method: "DELETE" });

    await writeAuditLog({
      action: "expedientes.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: { title: expediente.title, vectors: vectorIds.length },
      entityId: id,
      entityType: "expediente_archivo",
      module: "expedientes",
    });

    return NextResponse.json({ deleted: { expedienteId: id, vectors: vectorIds.length } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el expediente" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}

// PATCH: edita metadata del expediente (whitelist). No toca el PDF ni reindexa.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [existing] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=id,oficina,oficina_id,uploaded_by`,
    );
    if (!existing) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (!canAccessArchivoRow(auth.user, { oficina: existing.oficina, oficinaId: existing.oficina_id, owner: existing.uploaded_by })) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!PATCHABLE_COLUMNS.has(key)) {
        continue;
      }
      if (key === "oficina" && !auth.user.isAdmin) {
        continue;
      }
      if (key === "empastado") {
        if (typeof value === "boolean") updates.empastado = value;
        else if (value === "si" || value === "true") updates.empastado = true;
        else if (value === "no" || value === "false") updates.empastado = false;
      } else if (key === "tipo_almacenamiento") {
        updates.tipo_almacenamiento = normalizeContenedorTipo(value);
      } else if (key === "color_archivador") {
        updates.color_archivador = normalizeCatalogValue(value, ARCHIVO_COLORES);
      } else if (key === "persona_tipo") {
        updates.persona_tipo = normalizePersonaTipo(value);
      } else if (key === "anio") {
        const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
        updates.anio = Number.isFinite(n) ? n : null;
      } else if (value === null || typeof value === "string") {
        updates[key] = typeof value === "string" ? value.trim().slice(0, 2000) : null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
    }

    await supabaseRest(`expedientes_archivo?id=eq.${id}`, {
      body: JSON.stringify(updates),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "expedientes-archivo.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fields: Object.keys(updates) },
      entityId: id,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ updated: Object.keys(updates) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el expediente" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}

// PUT: reemplaza el PDF del expediente. Borra el PDF/vectores/chunks viejos y
// reprocesa el nuevo en segundo plano (status -> processing -> indexed/error).
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "reindex"), RATE_LIMITS.reindex);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const { storageBucket } = getSupabaseServerConfig();
    const { id } = await context.params;

    const formData = await request.formData();
    const file = await readArchivoFile(formData, auth.user.id);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo PDF" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (file.size > maxPdfSizeBytes) {
      return NextResponse.json({ error: `El PDF supera el limite de ${maxPdfSizeLabel}` }, { status: 400 });
    }

    const [expediente] = await supabaseRest<ExpedienteArchivo[]>(
      `expedientes_archivo?id=eq.${id}&select=${SELECT}`,
    );
    if (!expediente) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (!canAccessArchivoRow(auth.user, { oficina: expediente.oficina, oficinaId: expediente.oficina_id, owner: expediente.uploaded_by })) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const oldPath = expediente.storage_path;
    const newPath = `expedientes/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(newPath, file);

    const replacement = { ...expediente, file_name: file.name, file_size: file.size, mime_type: "application/pdf", storage_path: newPath };

    await writeAuditLog({
      action: "expedientes.replaceFile",
      actorReference: auth.user.email ?? auth.user.id,
      details: { newFileName: file.name, newSize: file.size },
      entityId: id,
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    });

    after(async () => {
      try {
        const blob = await downloadStorageObject(storageBucket, newPath);
        const pdfFile = new File([blob], file.name, { type: "application/pdf" });
        await processExpedienteDocument(replacement, pdfFile);
        if (oldPath && oldPath !== newPath) await deleteStorageObjects(storageBucket, [oldPath]).catch((error) => console.error("[archivo] limpieza PDF anterior", error));
      } catch (error) {
        await reportArchivoProcessingFailure(expediente, error);
      }
    });

    return NextResponse.json({ replaced: true, processing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reemplazar el PDF" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}
