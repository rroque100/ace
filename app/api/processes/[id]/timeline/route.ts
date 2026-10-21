import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";
import {
  entradasDeAuditoria,
  entradasDePasos,
  unirTimeline,
  type EventoAuditoria,
  type HitoConFecha,
} from "@/lib/timeline-expediente";
import { hitoLabel } from "@/lib/procurement-fases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tope de eventos: la historia de un expediente no llega a tanto, y evita que
 *  un expediente patológico devuelva miles de filas a la barra lateral. */
const MAX_EVENTOS = 200;

// GET /api/processes/[id]/timeline
//
// Historia del expediente: quién hizo qué y cuándo.
//
// ── Por qué hay dos clientes de Supabase aquí ─────────────────────────────────
//
// `audit_logs` está cerrado por RLS: consultado con la clave anónima devuelve
// `[]` —lo comprobé—, así que el token del usuario no sirve para leerlo. Pero
// leerlo con la clave de servicio sin más sería saltarse el control de acceso:
// cualquiera con un id de expediente vería su historia.
//
// La solución es partirlo en dos: PRIMERO se comprueba con el token del USUARIO
// que puede ver el expediente —si RLS no se lo permite, no hay fila y se
// responde 404—, y solo entonces se lee el registro con la clave de servicio. El
// permiso lo decide la política de siempre; el privilegio solo lo usa la lectura
// que la política no cubre.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const filas = await supabaseUserRest<Array<{ hitos: Record<string, HitoConFecha> | null }>>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=hitos`,
    );
    if (!filas[0]) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const eventos = await supabaseRest<EventoAuditoria[]>(
      `audit_logs?entity_id=eq.${id}&select=action,actor_reference,created_at,details` +
        `&order=created_at.desc&limit=${MAX_EVENTOS}`,
    ).catch(() => [] as EventoAuditoria[]);

    return NextResponse.json({
      entradas: unirTimeline(
        entradasDeAuditoria(eventos),
        entradasDePasos(filas[0].hitos, hitoLabel),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la línea de tiempo." },
      { status: 500 },
    );
  }
}
