import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { accionPorId, estadoNecesidad } from "@/lib/necesidad-workflow";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditRow = {
  action: string;
  actor_reference: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

// GET /api/necesidades/[id]/historial
//
// Línea de tiempo del requerimiento: creación + transiciones del workflow, tal
// como quedaron registradas en `audit_logs`. No hay tabla propia de historial;
// el rastro ya existe, aquí solo se lee y se limpia para pintarlo.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  // El log se lee con la clave de servicio (RLS de audit_logs no expone al
  // usuario), así que ANTES se comprueba que el usuario puede ver ESTA necesidad
  // con SU token: si no la ve, tampoco su historial.
  const visible = await supabaseUserRest<Array<{ id: string }>>(
    auth.user.accessToken,
    `necesidades?id=eq.${id}&select=id&limit=1`,
  ).catch(() => []);
  if (!visible[0]) {
    return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
  }

  try {
    const rows = await supabaseRest<AuditRow[]>(
      `audit_logs?entity_type=eq.necesidad&entity_id=eq.${id}&select=action,actor_reference,details,created_at&order=created_at.asc`,
    );

    const eventos = rows.map((r) => {
      const accionId = r.action.replace(/^necesidad\./, "");
      const accion = accionPorId(accionId);
      const d = (r.details ?? {}) as Record<string, unknown>;
      const hacia = accion?.hacia;
      return {
        fecha: r.created_at,
        actor: r.actor_reference ?? "sistema",
        etiqueta: accionId === "create" ? "Necesidad creada" : accion?.label ?? accionId,
        // Tono del ESTADO al que llevó la acción (crear = borrador → neutral).
        tono: hacia ? estadoNecesidad(hacia)?.tono ?? "neutral" : "neutral",
        sustento: typeof d.sustento === "string" ? d.sustento : "",
        mecanismo: typeof d.mecanismo === "string" ? d.mecanismo : "",
      };
    });

    return NextResponse.json({ eventos });
  } catch {
    // Sin historial la ficha sigue funcionando: no se convierte en error de página.
    return NextResponse.json({ eventos: [] });
  }
}
