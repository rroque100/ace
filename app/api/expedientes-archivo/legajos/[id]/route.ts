import { NextResponse } from "next/server";
import { canAccessArchivoRow, requireUser } from "@/lib/auth";
import type { ExpedienteArchivo, ExpedienteLegajo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEGAJO_SELECT =
  "id,sgd_expediente,serie_documento,anio,asunto,materia,oficina,oficina_id,persona_tipo,persona_documento,persona_nombre,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,observaciones,documentos_count,documentos_error_count,documentos_pending_count,uploaded_by,created_at,updated_at";

const DOCUMENTO_SELECT =
  "id,numero_folio,tipo_documento,title,anio,status,error_message,file_name,file_size,created_at";

type DocumentoResumen = Pick<
  ExpedienteArchivo,
  "id" | "numero_folio" | "tipo_documento" | "title" | "anio" | "status" | "error_message" | "file_name" | "file_size" | "created_at"
>;

// Detalle de un legajo + la lista de sus documentos (folios), ordenados por
// numero_folio. Base del futuro slide-over multi-documento (fase de UI, fuera
// de este plan).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [legajo] = await supabaseRest<ExpedienteLegajo[]>(
      `expedientes_archivo_legajos?id=eq.${id}&select=${LEGAJO_SELECT}`,
    );
    if (!legajo) {
      return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
    }
    if (
      !canAccessArchivoRow(auth.user, {
        oficina: legajo.oficina,
        oficinaId: legajo.oficina_id,
        owner: legajo.uploaded_by,
      })
    ) {
      return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
    }

    const documentos = await supabaseRest<DocumentoResumen[]>(
      `expedientes_archivo?expediente_id=eq.${id}&select=${DOCUMENTO_SELECT}&order=numero_folio.asc`,
    );

    return NextResponse.json({ legajo, documentos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener el legajo" },
      { status: 500 },
    );
  }
}
