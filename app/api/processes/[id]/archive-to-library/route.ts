import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireDec } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type ProcessRow = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  summary: string | null;
  valor_estimado: number | null;
  moneda: string | null;
  necesidad_id: string | null;
};

type ProcessDoc = {
  id: string;
  title: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  kind: string;
};

export async function POST(
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
    const malos = idsDeRutaInvalidos(id);
    if (malos) return malos;

    // Lectura por JWT del usuario (RESPETA RLS): antes se leía con service_role,
    // que SALTA RLS, así que un DEC podía archivar el expediente de otra oficina
    // que RLS le oculta. Con userRest, solo se archiva lo que el usuario puede ver.
    const [process] = await supabaseUserRest<ProcessRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,valor_estimado,moneda,necesidad_id`,
    );
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (process.status === "archivo") {
      return NextResponse.json({ error: "El expediente ya está archivado" }, { status: 409 });
    }

    const docs = await supabaseRest<ProcessDoc[]>(
      `process_documents?process_id=eq.${id}&select=id,title,file_name,storage_bucket,storage_path,mime_type,kind&status=eq.ready&order=created_at.asc&limit=50`,
    );

    const { storageBucket } = getSupabaseServerConfig();

    const mainDoc = docs.find((d) => d.storage_path) ?? null;

    const anio = new Date().getFullYear();
    const title = process.nomenclature;
    const asunto = process.summary ?? null;
    const materia = process.object_type
      ? { bienes: "Contratación de bienes", servicios: "Contratación de servicios", obras: "Contratación de obras", consultoria_obra: "Consultoría de obras" }[process.object_type] ?? null
      : null;

    const storagePath = mainDoc
      ? mainDoc.storage_path
      : `expedientes/${randomUUID()}-sin-pdf.txt`;

    // Los documentos vinculados van en el METADATA del propio POST: `docs` ya se
    // leyó arriba, así que no hace falta un PATCH posterior sobre la fila recién
    // creada (era un round-trip redundante).
    const docRefs = docs
      .filter((d) => d.storage_path)
      .map((d) => ({ docId: d.id, title: d.title, kind: d.kind, storagePath: d.storage_path }));

    const [archived] = await supabaseRest<Array<{ id: string }>>("expedientes_archivo?select=id", {
      body: JSON.stringify({
        anio,
        asunto,
        file_name: mainDoc?.file_name ?? `${title}.pdf`,
        file_size: 1,
        materia,
        mime_type: mainDoc?.mime_type ?? "application/pdf",
        numero_expediente: id.slice(0, 8),
        status: "uploaded",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        title,
        tipo_almacenamiento: "folder",
        metadata: {
          archivedFrom: { processId: id, status: process.status, docsCount: docs.length },
          originalProcessId: id,
          documents: docRefs,
        },
      }),
      method: "POST",
    });

    // Flip de estado también por userRest (RLS): la escritura queda acotada a lo
    // que el usuario puede editar, como el resto de las rutas del expediente.
    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, {
      body: JSON.stringify({ status: "archivo" }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "process.archive_to_library",
      actorReference: auth.user.email ?? auth.user.id,
      details: { processId: id, archivedId: archived.id, title, docCount: docs.length },
      entityId: id,
      entityType: "procurement_process",
      module: "expedientes",
    });

    return NextResponse.json({
      archived: {
        id: archived.id,
        title,
        url: `/expedientes-archivo`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo archivar el expediente" },
      { status: 500 },
    );
  }
}
