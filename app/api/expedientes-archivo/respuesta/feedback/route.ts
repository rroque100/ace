import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeFilter, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  oficinaId: z.string().uuid().optional(),
  tipoDocumento: z.string().trim().max(40).optional(),
  rating: z.enum(["like", "dislike"]),
  // Comentario del usuario: que estuvo mal / que mejorar (opcional).
  comentario: z.string().trim().max(1000).optional(),
  // Snapshot del borrador evaluado.
  cuerpo: z.string().trim().min(20).max(30000),
  intencion: z.string().trim().max(8000).optional(),
});

// POST /api/expedientes-archivo/respuesta/feedback
// Guarda la evaluacion del borrador (correcto/incorrecto). Los "like" se usan
// luego como ejemplos de estilo de la oficina al generar nuevos documentos;
// los "dislike" (con comentario) como defectos a evitar.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    getSupabaseServerConfig();

    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Solicitud inválida" },
        { status: 400 },
      );
    }
    const { oficinaId, tipoDocumento, rating, comentario, cuerpo, intencion } = parsed.data;

    // Validar que la oficina pertenece al usuario (no admite cross-oficina).
    const officeFilter = getOfficeFilter(auth.user);
    const safeOficinaId = oficinaId ?? null;
    if (officeFilter && safeOficinaId) {
      type OfiRow = { id: string; nombre: string | null; entidad: string | null };
      const [ofi] = await supabaseRest<OfiRow[]>(
        `expedientes_oficinas?id=eq.${encodeURIComponent(safeOficinaId)}&select=id,nombre,entidad&limit=1`,
      ).catch(() => [] as OfiRow[]);
      const allowed = ofi && (entitiesMatch(ofi.nombre, auth.user.entity) || entitiesMatch(ofi.entidad, auth.user.entity));
      if (!allowed) {
        return NextResponse.json({ error: "No tienes acceso a esta oficina" }, { status: 403 });
      }
    }

    await supabaseRest("respuesta_feedback", {
      body: JSON.stringify({
        oficina_id: safeOficinaId,
        tipo_documento: tipoDocumento ?? null,
        rating,
        comentario: comentario || null,
        cuerpo,
        intencion: intencion || null,
        created_by: auth.user.id,
      }),
      headers: { Prefer: "return=minimal" },
      method: "POST",
    });

    await writeAuditLog({
      action: "respuesta.feedback",
      actorReference: auth.user.email ?? auth.user.id,
      details: { rating, tipoDocumento: tipoDocumento ?? null, comentario: comentario?.slice(0, 200) ?? null },
      entityType: "respuesta",
      module: "expedientes-archivo",
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la evaluación" },
      { status: 500 },
    );
  }
}
