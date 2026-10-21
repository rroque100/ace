import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SourceRow = {
  id: string;
  anio: number | null;
  antecedente_id: string | null;
  antecedentes: unknown[] | null;
  asunto: string | null;
  base_legal: unknown[] | null;
  cuerpo: string | null;
  created_at: string;
  destinatario: string | null;
  documento_texto: string | null;
  entity: Record<string, unknown> | null;
  expediente_id: string | null;
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

// POST /api/respuesta/[id]/version
// Crea una nueva version (vN+1) clonando el cuerpo y la metadata de la
// version original. El original queda intacto y se vincula via parent_version_id.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    getSupabaseServerConfig();

    // Carga la version original
    const original = await supabaseRest<SourceRow[]>(
      `expedientes_respuestas?id=eq.${id}&select=*&limit=1`,
    ).catch(() => []);
    const source = original?.[0];
    if (!source) {
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 });
    }

    // Encuentra la siguiente version disponible para esta respuesta
    const siblings = await supabaseRest<Array<{ version: number | null }>>(
      `expedientes_respuestas?or=(id.eq.${id},parent_version_id.eq.${id})&select=version`,
    ).catch(() => []);
    const nextVersion = ((siblings ?? []).reduce(
      (max, r) => Math.max(max, r.version ?? 0),
      source.version ?? 0,
    ) ?? 0) + 1;

    // Clonar sin el id ni created_at (los genera Supabase)
    const clone: Record<string, unknown> = {
      anio: source.anio,
      antecedente_id: source.antecedente_id,
      antecedentes: source.antecedentes ?? [],
      asunto: source.asunto,
      base_legal: source.base_legal ?? [],
      body: source.cuerpo,
      created_by: auth.user.id,
      destino_cargo: null,
      destinatario: source.destinatario,
      documento_texto: source.documento_texto,
      entity: source.entity ?? {},
      expediente_id: source.expediente_id,
      length: source.length,
      nro_oficio: source.nro_oficio,
      oficina_id: source.oficina_id,
      parent_version_id: id,
      remitente: source.remitente,
      tipo_documento: source.tipo_documento,
      token_usage: source.token_usage,
      tone: source.tone,
      version: nextVersion,
    };

    const inserted = (await supabaseRest<Array<{ id: string }> | { id: string }>(
      "expedientes_respuestas?select=id",
      { body: JSON.stringify(clone), method: "POST" },
    )) as Array<{ id: string }> | { id: string } | null;
    const newId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    if (!newId) {
      return NextResponse.json(
        { error: "No se pudo crear la nueva version" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      action: "respuesta.version.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        originalId: id,
        newId,
        newVersion: nextVersion,
        nroOficio: source.nro_oficio,
      },
      entityId: newId,
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ id: newId, parentId: id, version: nextVersion }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la version" },
      { status: 500 },
    );
  }
}
