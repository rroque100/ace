import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { type ObservacionNecesidad, observacionCreateSchema } from "@/lib/necesidades";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// public.necesidad_observaciones tiene RLS colaborativo (migración
// docs/supabase/necesidad-observaciones.sql): lee cualquier autenticado; escribe
// el dueño de la necesidad padre o un colaborador de expedientes. Se accede con
// el JWT del usuario (supabaseUserRest); el gate de capacidad respalda a nivel app.
const SELECT =
  "id,necesidad_id,campo,comentario,autor_referencia,autor_rol,resuelto,resuelto_por,created_at,resuelto_at";

// GET /api/necesidades/[id]/observaciones — lista las observaciones por campo.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const observaciones = await supabaseUserRest<ObservacionNecesidad[]>(
      auth.user.accessToken,
      `necesidad_observaciones?necesidad_id=eq.${id}&select=${SELECT}&order=created_at.asc`,
    );
    return NextResponse.json({ observaciones });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las observaciones", observaciones: [] },
      { status: 500 },
    );
  }
}

// POST /api/necesidades/[id]/observaciones — la DEC/área usuaria observa un campo.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const parsed = observacionCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }
  const { campo, comentario } = parsed.data;

  try {
    const necesidades = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=id`,
    );
    if (!necesidades[0]) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    const [observacion] = await supabaseUserRest<ObservacionNecesidad[]>(
      auth.user.accessToken,
      `necesidad_observaciones?select=${SELECT}`,
      {
        body: JSON.stringify({
          necesidad_id: id,
          campo,
          comentario,
          autor_referencia: auth.user.email ?? auth.user.id,
          autor_rol: auth.user.role,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "necesidad.observacion_campo",
      actorReference: auth.user.email ?? auth.user.id,
      details: { campo, role: auth.user.role },
      entityId: id,
      entityType: "necesidad",
    });

    return NextResponse.json({ observacion }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la observación" },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  resuelto: z.boolean(),
});

// PATCH /api/necesidades/[id]/observaciones — marca una observación resuelta o
// vuelve a abrirla (body: { id, resuelto }).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id: obsId, resuelto } = parsed.data;

  try {
    const [observacion] = await supabaseUserRest<ObservacionNecesidad[]>(
      auth.user.accessToken,
      `necesidad_observaciones?id=eq.${obsId}&necesidad_id=eq.${id}&select=${SELECT}`,
      {
        body: JSON.stringify({
          resuelto,
          resuelto_por: resuelto ? auth.user.email ?? auth.user.id : null,
          resuelto_at: resuelto ? new Date().toISOString() : null,
        }),
        method: "PATCH",
      },
    );
    if (!observacion) {
      return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ observacion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la observación" },
      { status: 500 },
    );
  }
}
