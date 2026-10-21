import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import type { Necesidad } from "@/lib/necesidades";
import { accionPorId, ladoDeRol, puedeEjecutar } from "@/lib/necesidad-workflow";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.string().trim().min(1).max(40),
  sustento: z.string().trim().max(2000).optional().or(z.literal("")),
  mecanismo: z.string().trim().max(120).optional().or(z.literal("")),
});

const SELECT = "id,status,tipo_area,cmn_verificado,no_objecion,no_objecion_sustento,no_objecion_mecanismo";

// Transiciones que guardan un snapshot del requerimiento (D3) y su etiqueta.
const SNAPSHOT_ACCIONES: Record<string, string> = {
  remitir: "Remitida por el área usuaria",
  solicitar_no_objecion: "Modificación propuesta por la DEC",
};

// POST /api/necesidades/[id]/transicion
// Body: { action, sustento?, mecanismo? }
// Ejecuta una transición del workflow del Requerimiento validando el estado
// origen y el actor (gating flexible: la DEC/admin puede ejecutar cualquier acción).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, sustento, mecanismo } = parsed.data;

  const accion = accionPorId(action);
  if (!accion) {
    return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  }

  try {
    // process_id hace falta para soltar el expediente en las acciones que
    // desvinculan (reabrir).
    const rows = await supabaseUserRest<Pick<Necesidad, "id" | "status" | "process_id">[]>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=id,status,process_id`,
    );
    const actual = rows[0];
    if (!actual) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    if (!accion.desde.includes(actual.status)) {
      return NextResponse.json(
        { error: `La acción "${accion.label}" no es válida desde el estado actual.` },
        { status: 409 },
      );
    }

    // Guarda de "solo sin expediente" (volver_borrador). Va en el servidor y no
    // solo en la UI: el botón puede no estar, pero la ruta sigue abierta, y
    // deshacer el avance de un requerimiento ya derivado dejaría la Fase 1
    // sembrada desde algo que ha vuelto a ser un borrador.
    if (accion.requiereSinExpediente && actual.process_id) {
      return NextResponse.json(
        {
          error:
            `No se puede "${accion.label}": esta necesidad ya tiene un expediente derivado. ` +
            "Usa «Reabrir necesidad» para desvincularlo primero.",
        },
        { status: 409 },
      );
    }

    const lado = ladoDeRol(auth.user.role);
    if (!puedeEjecutar(accion, lado)) {
      return NextResponse.json(
        { error: `Tu rol no puede ejecutar esta acción (corresponde a ${accion.actor === "dec" ? "la DEC" : "el área usuaria"}).` },
        { status: 403 },
      );
    }

    if (accion.requiereSustento && !(sustento && sustento.trim())) {
      return NextResponse.json({ error: "Esta acción requiere un sustento." }, { status: 400 });
    }

    const patch: Record<string, unknown> = { status: accion.hacia };
    if (accion.setNoObjecion !== undefined) patch.no_objecion = accion.setNoObjecion;
    if (accion.setCmnVerificado !== undefined) patch.cmn_verificado = accion.setCmnVerificado;
    if (accion.borrarProcessId) patch.process_id = null;
    if (accion.requiereSustento) {
      patch.no_objecion_sustento = sustento;
      if (mecanismo) patch.no_objecion_mecanismo = mecanismo;
    }

    // Desvincular es de DOS lados. La necesidad soltaba su `process_id` pero el
    // expediente seguía apuntando a ella con `necesidad_id`, así que quedaban
    // punteros rotos: el expediente creía tener requerimiento y la necesidad no
    // sabía nada de él. Se suelta el expediente ANTES de tocar la necesidad; si
    // esto falla, la transición no se aplica y no se rompe nada a medias.
    if (accion.borrarProcessId && actual.process_id) {
      await supabaseUserRest(
        auth.user.accessToken,
        `procurement_processes?id=eq.${actual.process_id}`,
        { body: JSON.stringify({ necesidad_id: null }), method: "PATCH" },
      );
    }

    const [necesidad] = await supabaseUserRest<Necesidad[]>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=${SELECT}`,
      { body: JSON.stringify(patch), method: "PATCH" },
    );

    // Snapshot de versión (D3): al REMITIR se guarda la versión del área usuaria;
    // al PROPONER MODIFICACIÓN, la de la DEC. El diff del ciclo de no objeción
    // compara ambas. No bloquea la transición si el guardado del snapshot falla.
    if (SNAPSHOT_ACCIONES[accion.action]) {
      const [fila] = await supabaseUserRest<Record<string, unknown>[]>(
        auth.user.accessToken,
        `necesidades?id=eq.${id}&select=*`,
      ).catch(() => []);
      if (fila) {
        await supabaseUserRest(auth.user.accessToken, `necesidad_versiones`, {
          body: JSON.stringify({
            necesidad_id: id,
            snapshot: fila,
            transicion: accion.action,
            etiqueta: SNAPSHOT_ACCIONES[accion.action],
            autor_referencia: auth.user.email ?? auth.user.id,
            autor_rol: auth.user.role,
          }),
          method: "POST",
        }).catch(() => undefined);
      }
    }

    await writeAuditLog({
      action: `necesidad.${accion.action}`,
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        from: actual.status,
        to: accion.hacia,
        role: auth.user.role,
        // El sustento/mecanismo viaja al log para poder mostrarlos en el
        // historial (observaciones, no objeción): sin esto, la línea de tiempo
        // diría "observó" sin el porqué.
        ...(sustento?.trim() ? { sustento: sustento.trim() } : {}),
        ...(mecanismo?.trim() ? { mecanismo: mecanismo.trim() } : {}),
      },
      entityId: id,
      entityType: "necesidad",
    });

    return NextResponse.json({ necesidad });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la transición" },
      { status: 500 },
    );
  }
}
