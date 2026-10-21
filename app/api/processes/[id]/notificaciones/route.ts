import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuditRow = {
  id: string;
  action: string;
  details: { message?: string; code?: string; cronograma?: { area: string; fecha: string }[] };
  created_at: string;
};

// GET /api/processes/[id]/notificaciones → notificaciones activas del proceso.
//
// ── Two-step (mismo patrón que /timeline) ────────────────────────────────────
// `audit_logs` está cerrado por RLS para el token del usuario, así que se lee
// con la clave de servicio. Pero saltarse la verificación de acceso permitía a
// cualquier usuario autenticado pasar un id ajeno y descubrir no solo que el
// expediente existe, sino si su fase A2 estaba completada.
//
// Primero se comprueba con el token del USUARIO que puede ver el expediente —si
// RLS no se lo permite, no hay fila y se responde 404—, y solo entonces se lee
// el registro con la clave de servicio.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const filas = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id`,
    );
    if (!filas[0]) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const rows = await supabaseRest<AuditRow[]>(
      `audit_logs?entity_id=eq.${id}&entity_type=eq.procurement_process&action=eq.fase1.cronograma_listo&order=created_at.desc&limit=10`,
    );
    return NextResponse.json({ notificaciones: rows ?? [] });
  } catch {
    return NextResponse.json({ notificaciones: [] });
  }
}
