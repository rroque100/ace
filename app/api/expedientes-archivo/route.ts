import { PdfReadError } from "@/lib/pdf-read-error";
import { readArchivoFile } from "@/lib/archivo-upload-server";
import { parseRagPath, restLiteral } from "@/lib/archivo-rag";
import { advanceRagDocument } from "@/lib/archivo-rag-worker";
import { createHash, randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { getArchivoScopeLevel, canAccessArchivoRow, requireDecOrAreaUsuaria, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import {
  ARCHIVO_COLORES,
  type ExpedienteArchivo,
  type ExpedienteLegajo,
  normalizeCatalogValue,
  normalizeContenedorTipo,
  normalizePersonaTipo,
} from "@/lib/expedientes-archivo";
import { processExpedienteDocument, reportArchivoProcessingFailure } from "@/lib/expedientes-archivo-processing";
import {
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  uploadPdfToStorage,
  writeAuditLog,
} from "@/lib/supabase-server";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at,expediente_id,numero_folio";

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(0, 80);
}

function formText(formData: FormData, key: string, max = 500): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function formInt(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    // Clave propia ("expedientes-list"), no genérica "list": esa cadena
    // también la usaba /api/expedientes-archivo/legajos, así que ambas rutas
    // compartían el mismo contador sin querer y se saturaban entre sí.
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "expedientes-list"),
      RATE_LIMITS.list,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const anio = url.searchParams.get("anio");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
    const offset = (page - 1) * limit;

    // Scope: admin todo; jefe su oficina; el resto SOLO lo que subió. Se filtra
    // por `oficina_id` (mismo criterio que las políticas RLS de la BD) cuando el
    // perfil del jefe lo tiene resuelto; si no, se cae al filtro por texto como
    // respaldo. Así el enforcement en código (service_role bypassa RLS) queda
    // alineado con la defensa en profundidad de la base de datos.
    const scope = getArchivoScopeLevel(auth.user);
    const useOficinaId = scope === "oficina" && Boolean(auth.user.oficinaId);
    const scopeClause = () => {
      if (scope === "oficina") {
        return useOficinaId
          ? `&oficina_id=eq.${encodeURIComponent(auth.user.oficinaId ?? "")}`
          : `&oficina=eq.${encodeURIComponent(auth.user.entity ?? "")}`;
      }
      if (scope === "own") {
        return `&uploaded_by=eq.${encodeURIComponent(auth.user.id)}`;
      }
      return "";
    };

    let query = `expedientes_archivo?select=${SELECT}&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (status) {
      query += `&status=eq.${encodeURIComponent(status)}`;
    }
    if (anio) {
      query += `&anio=eq.${encodeURIComponent(anio)}`;
    }
    query += scopeClause();

    const expedientes = await supabaseRest<ExpedienteArchivo[]>(query);

    // Con oficina_id el filtro ya es exacto; solo el respaldo por texto necesita
    // el post-filtro normalizado (cubre diferencias de tildes/mayúsculas).
    const filtered =
      scope === "oficina" && !useOficinaId
        ? expedientes.filter((e) => entitiesMatch(e.oficina, auth.user.entity))
        : expedientes;

    // Conteos globales (todo el archivo visible, no solo la página) para el dashboard.
    let countQuery = `expedientes_archivo?select=id,status,file_size,oficina`;
    if (status) countQuery += `&status=eq.${encodeURIComponent(status)}`;
    if (anio) countQuery += `&anio=eq.${encodeURIComponent(anio)}`;
    countQuery += scopeClause();
    const allRows = await supabaseRest<Array<{ id: string; status: string; file_size: number; oficina: string | null }>>(
      countQuery,
    );
    const countRows =
      scope === "oficina" && !useOficinaId
        ? allRows.filter((r) => entitiesMatch(r.oficina, auth.user.entity))
        : allRows;
    const total = countRows.length;
    const counts = {
      total,
      indexed: countRows.filter((r) => r.status === "indexed").length,
      pending: countRows.filter((r) => r.status === "uploaded" || r.status === "processing").length,
      error: countRows.filter((r) => r.status === "error").length,
      totalBytes: countRows.reduce((sum, r) => sum + (r.file_size ?? 0), 0),
    };

    return NextResponse.json({
      expedientes: filtered,
      counts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return NextResponse.json(
      {
        expedientes: [],
        error: error instanceof Error ? error.message : "No se pudo listar los expedientes",
        setupRequired: true,
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }

    const formData = await request.formData();
    // Subir RAG manda `relativePath` (la subida normal nunca lo hace): un lote
    // de carga masiva usa el límite generoso de `uploadBulk`, no el de `upload`
    // pensado para una persona subiendo un documento a la vez.
    const relativePath = formText(formData, "relativePath", 1000);
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, relativePath ? "upload-rag" : "upload"),
      relativePath ? RATE_LIMITS.uploadBulk : RATE_LIMITS.upload,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

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

    const rag = relativePath ? parseRagPath(relativePath) : null;
    let contentHash: string | undefined;
    if (rag) {
      // Explicit corrections win over filename inference; never use CP as SGD.
      rag.type = formText(formData, "tipoDocumento", 60) ?? rag.type;
      rag.cabinet = formText(formData, "nroArchivador", 60) ?? rag.cabinet;
      rag.cp = formText(formData, "ragCp", 30) ?? rag.cp;
      rag.siaf = formText(formData, "ragSiaf", 30) ?? rag.siaf;
      rag.date = formText(formData, "ragDate", 10) ?? rag.date;
      rag.year = String(formInt(formData, "anio") ?? rag.year);
      // Tipo, archivador y CP ya no son obligatorios (Subir RAG simplificado a
      // "solo sube el PDF"): se valida el FORMATO únicamente de lo que sí
      // llegó con valor, no que exista.
      if ((rag.cp && !/^CP\d+$/i.test(rag.cp)) || (rag.siaf && !/^\d+$/.test(rag.siaf))) return NextResponse.json({ error: "Si hay CP debe verse como CP1234; SIAF solo números" }, { status: 400 });
      contentHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
      const [existing] = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?metadata->>contentHash=eq.${contentHash}&uploaded_by=eq.${restLiteral(auth.user.id)}&select=id&limit=1`);
      if (existing) return NextResponse.json({ expediente: existing, duplicate: true }, { status: 200 });
    }
    const { storageBucket } = getSupabaseServerConfig();
    const title = formText(formData, "title", 300) ?? file.name;

    // Legajo: si viene `expedienteId`, se adjunta el documento a ese legajo
    // existente (debe existir y el usuario debe poder acceder a él); si no, se
    // crea un legajo nuevo con los campos de identificación del caso — mismo
    // comportamiento de siempre, ahora explícito en dos pasos.
    const expedienteIdInput = formText(formData, "expedienteId", 60);
    let legajoId: string;
    if (expedienteIdInput) {
      const [legajo] = await supabaseRest<ExpedienteLegajo[]>(
        `expedientes_archivo_legajos?id=eq.${expedienteIdInput}&select=id,oficina,oficina_id,uploaded_by`,
      );
      if (!legajo) {
        return NextResponse.json({ error: "El legajo indicado no existe" }, { status: 400 });
      }
      if (
        !canAccessArchivoRow(auth.user, {
          oficina: legajo.oficina,
          oficinaId: legajo.oficina_id,
          owner: legajo.uploaded_by,
        })
      ) {
        return NextResponse.json({ error: "El legajo indicado no existe" }, { status: 400 });
      }
      legajoId = legajo.id;
    } else {
      const legajoPayload: Record<string, unknown> = { uploaded_by: auth.user.id };
      const legajoFields: Array<[string, unknown]> = [
        ["sgd_expediente", formText(formData, "sgdExpediente", 120)],
        ["serie_documento", formText(formData, "serieDocumento", 120)],
        ["anio", formInt(formData, "anio")],
        ["asunto", formText(formData, "asunto")],
        ["materia", formText(formData, "materia", 200)],
        [
          "oficina",
          (() => {
            const fromForm = formText(formData, "oficina", 200);
            if (auth.user.isAdmin) return fromForm;
            if (fromForm && !entitiesMatch(fromForm, auth.user.entity)) return auth.user.entity;
            return fromForm || auth.user.entity;
          })(),
        ],
        ["persona_tipo", normalizePersonaTipo(formData.get("personaTipo"))],
        ["persona_documento", formText(formData, "personaDocumento", 20)],
        ["persona_nombre", formText(formData, "personaNombre", 200)],
        ["nro_archivador", formText(formData, "nroArchivador", 60)],
        ["nro_paquete", formText(formData, "nroPaquete", 60)],
        ["color_archivador", normalizeCatalogValue(formData.get("colorArchivador"), ARCHIVO_COLORES)],
        ["nro_estante", formText(formData, "nroEstante", 60)],
        ["nro_piso", formText(formData, "nroPiso", 60)],
        ["nro_local", formText(formData, "nroLocal", 60)],
        ["observaciones", formText(formData, "observaciones", 1000)],
      ];
      for (const [key, value] of legajoFields) {
        if (value !== null && value !== "" && value !== undefined) {
          legajoPayload[key] = value;
        }
      }
      const tipoAlmLegajo = formData.get("tipoAlmacenamiento");
      if (typeof tipoAlmLegajo === "string" && tipoAlmLegajo.trim()) {
        legajoPayload.tipo_almacenamiento = normalizeContenedorTipo(tipoAlmLegajo);
      }
      const empastadoLegajoRaw = formData.get("empastado");
      if (empastadoLegajoRaw === "si" || empastadoLegajoRaw === "true") legajoPayload.empastado = true;
      else if (empastadoLegajoRaw === "no" || empastadoLegajoRaw === "false") legajoPayload.empastado = false;

      const insertedLegajo = await supabaseRest<ExpedienteLegajo[]>(`expedientes_archivo_legajos?select=id`, {
        body: JSON.stringify(legajoPayload),
        method: "POST",
      });
      legajoId = insertedLegajo[0].id;
    }

    const storagePath = `expedientes/${randomUUID()}-${safeName(file.name)}`;
    await uploadPdfToStorage(storagePath, file);

    // tipo_documento es texto libre: la UI ofrece un catálogo + "otro" con valor libre.
    const tipoDocumentoRaw = formText(formData, "tipoDocumento", 60);
    const tipoDocumento =
      tipoDocumentoRaw === "otro" ? formText(formData, "tipoDocumentoCustom", 60) : tipoDocumentoRaw;

    const empastadoRaw = formData.get("empastado");
    const empastado =
      empastadoRaw === "si" || empastadoRaw === "true"
        ? true
        : empastadoRaw === "no" || empastadoRaw === "false"
          ? false
          : null;

    const payload: Record<string, unknown> = {
      title,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/pdf",
      storage_bucket: storageBucket,
      storage_path: storagePath,
      status: "uploaded",
      uploaded_by: auth.user.id,
      metadata: rag ? { uploadSource: "rag-folder", rag, contentHash } : { uploadSource: "web" },
      expediente_id: legajoId,
    };

    // Campos opcionales: solo se envian si tienen valor (esquema canónico).
    const optionalFields: Array<[string, unknown]> = [
      ["sgd_expediente", formText(formData, "sgdExpediente", 120)],
      ["serie_documento", formText(formData, "serieDocumento", 120)],
      ["tipo_documento", tipoDocumento],
      ["anio", formInt(formData, "anio")],
      ["asunto", formText(formData, "asunto")],
      ["materia", formText(formData, "materia", 200)],
      ["resumen", formText(formData, "resumen", 2000)],
      ["oficina", (() => {
        const fromForm = formText(formData, "oficina", 200);
        if (auth.user.isAdmin) return fromForm;
        if (fromForm && !entitiesMatch(fromForm, auth.user.entity)) return auth.user.entity;
        return fromForm || auth.user.entity;
      })()],
      ["folio", formText(formData, "folio", 60)],
      ["observaciones", formText(formData, "observaciones", 1000)],
      ["nro_archivador", formText(formData, "nroArchivador", 60)],
      ["nro_paquete", formText(formData, "nroPaquete", 60)],
      ["nro_estante", formText(formData, "nroEstante", 60)],
      ["nro_piso", formText(formData, "nroPiso", 60)],
      ["nro_local", formText(formData, "nroLocal", 60)],
      ["color_archivador", normalizeCatalogValue(formData.get("colorArchivador"), ARCHIVO_COLORES)],
      ["persona_tipo", normalizePersonaTipo(formData.get("personaTipo"))],
      ["persona_documento", formText(formData, "personaDocumento", 20)],
      ["persona_nombre", formText(formData, "personaNombre", 200)],
    ];
    for (const [key, value] of optionalFields) {
      if (value !== null && value !== "" && value !== undefined) {
        payload[key] = value;
      }
    }

    // tipo_almacenamiento: catálogo cerrado (la DB tiene default 'folder').
    const tipoAlm = formData.get("tipoAlmacenamiento");
    if (typeof tipoAlm === "string" && tipoAlm.trim()) {
      payload.tipo_almacenamiento = normalizeContenedorTipo(tipoAlm);
    }
    if (empastado !== null) {
      payload.empastado = empastado;
    }

    const inserted = await supabaseRest<ExpedienteArchivo[]>(`expedientes_archivo?select=id`, {
      body: JSON.stringify(payload),
      method: "POST",
    });
    const expediente = inserted[0];

    await writeAuditLog({
      action: "expedientes.upload",
      actorReference: auth.user.email ?? auth.user.id,
      details: { fileName: file.name, title },
      entityId: expediente.id,
      entityType: "expediente_archivo",
      module: "expedientes",
    });

    // Procesa e indexa en segundo plano descargando el PDF desde Storage (releer el
    // File del request tras la respuesta da bytes corruptos para archivos pequenos).
    after(async () => {
      try {
        const [full] = await supabaseRest<ExpedienteArchivo[]>(
          `expedientes_archivo?id=eq.${expediente.id}&select=${SELECT}`,
        );
        if (full) {
          if (rag) await advanceRagDocument(full);
          else {
            const blob = await downloadStorageObject(storageBucket, storagePath);
            const pdfFile = new File([blob], file.name, { type: "application/pdf" });
            await processExpedienteDocument(full, pdfFile);
          }
        }
      } catch (error) {
        await reportArchivoProcessingFailure(expediente, error);
      }
    });

    return NextResponse.json({ expediente, processing: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el expediente" },
      { status: error instanceof PdfReadError ? error.status : 500 },
    );
  }
}
