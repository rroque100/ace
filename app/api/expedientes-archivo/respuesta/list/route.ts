import { NextResponse } from "next/server";
import { getArchivoScopeLevel, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIST_SELECT =
  "id,nro_oficio,tipo_documento,anio,asunto,destinatario,remitente,cuerpo,base_legal,antecedentes,antecedente_id,documento_texto,entity,expediente_id,oficina_id,tone,length,token_usage,version,parent_version_id,created_by,created_at";

// Sin las columnas de respuesta-archivo-tables.sql (antecedente_id, version,
// parent_version_id): permite listar aunque ese SQL siga pendiente en la BD.
const LIST_SELECT_LEGACY =
  "id,nro_oficio,tipo_documento,anio,asunto,destinatario,remitente,cuerpo,base_legal,antecedentes,documento_texto,entity,expediente_id,oficina_id,tone,length,token_usage,created_by,created_at";


type RespuestaRow = {
  anio: number | null;
  antecedente_id: string | null;
  antecedentes: unknown[] | null;
  asunto: string | null;
  base_legal: unknown[] | null;
  body: string | null;
  cuerpo: string | null;
  created_at: string;
  created_by: string | null;
  destino_cargo: string | null;
  destinatario: string | null;
  documento_texto: string | null;
  entity: Record<string, unknown> | null;
  expediente_id: string | null;
  id: string;
  length: string | null;
  nro_oficio: string | null;
  oficina_id: string | null;
  parent_version_id: string | null;
  remitente: string | null;
  tipo_documento: string | null;
  token_usage: Record<string, unknown> | null;
  tone: string | null;
  version: number | null;
};

function shapeRespuesta(row: RespuestaRow) {
  return {
    anio: row.anio,
    antecedente_id: row.antecedente_id,
    antecedentes: row.antecedentes ?? [],
    asunto: row.asunto,
    base_legal: row.base_legal ?? [],
    cuerpo: row.cuerpo ?? row.body ?? "",
    created_at: row.created_at,
    created_by: row.created_by,
    destinatario: row.destinatario,
    documento_texto: row.documento_texto,
    entity: row.entity ?? {},
    expediente_id: row.expediente_id,
    id: row.id,
    length: row.length,
    nro_oficio: row.nro_oficio,
    oficina_id: row.oficina_id,
    parent_version_id: row.parent_version_id,
    remitente: row.remitente,
    tipo_documento: row.tipo_documento,
    token_usage: row.token_usage,
    tone: row.tone,
    version: row.version,
  };
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    // Scope: admin ve todo; jefe lo de su oficina; el resto SOLO lo que creó.
    const scope = getArchivoScopeLevel(auth.user);
    let allowedOficinaIds: Set<string> | null = null;
    if (scope === "oficina") {
      // El entity del usuario es SU OFICINA (match por nombre); el match por
      // entidad queda como compatibilidad para entities a nivel entidad.
      type OfiRow = { id: string; nombre: string | null; entidad: string | null };
      const oficinas = await supabaseRest<OfiRow[]>(
        `expedientes_oficinas?select=id,nombre,entidad`,
      ).catch(() => [] as OfiRow[]);
      allowedOficinaIds = new Set(
        oficinas
          .filter(
            (o) =>
              entitiesMatch(o.nombre, auth.user.entity) ||
              entitiesMatch(o.entidad, auth.user.entity),
          )
          .map((o) => o.id),
      );
    }

    const ownerFilter = scope === "own" ? `&created_by=eq.${encodeURIComponent(auth.user.id)}` : "";
    const oficinaQuery = allowedOficinaIds && allowedOficinaIds.size > 0
      ? `&oficina_id=in.(${[...allowedOficinaIds].map(encodeURIComponent).join(",")})`
      : allowedOficinaIds // scope=oficina pero sin match → ninguna fila
        ? `&oficina_id=is.null`
        : "";
    const respuestas = await supabaseRest<RespuestaRow[]>(
      `expedientes_respuestas?select=${LIST_SELECT}${ownerFilter}${oficinaQuery}&order=created_at.desc&limit=${limit}&offset=${offset}`,
    ).catch((err) => {
      if (err instanceof Error && /antecedente_id|parent_version_id|version/i.test(err.message)) {
        return supabaseRest<RespuestaRow[]>(
          `expedientes_respuestas?select=${LIST_SELECT_LEGACY}${ownerFilter}${oficinaQuery}&order=created_at.desc&limit=${limit}&offset=${offset}`,
        );
      }
      throw err;
    });
    const filtered = respuestas ?? [];
    return NextResponse.json({
      respuestas: filtered.map((r) => shapeRespuesta(r)),
    });
  } catch (error) {
    return NextResponse.json(
      { respuestas: [], error: error instanceof Error ? error.message : "No se pudo listar" },
      { status: 200 },
    );
  }
}
