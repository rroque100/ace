import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import type { ProcurementProcess } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at";

// Estados desde los que tiene sentido declarar desierto (etapa de selección).
const ESTADOS_DECLARABLES = new Set(["seleccion", "buena_pro"]);

// Declara el procedimiento DESIERTO: salida terminal de la etapa Buena pro
// (no hubo ofertas válidas o quedó sin adjudicación). Lo declara el comité de
// selección o la DEC (capacidad expediente.evaluate). El acta de declaratoria
// se genera aparte con el generador documental (acta_desierto).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.evaluate");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const payload = (await request.json().catch(() => ({}))) as { motivo?: string };
  const motivo = typeof payload.motivo === "string" ? payload.motivo.trim().slice(0, 500) : "";

  try {
    const [processes] = await Promise.all([
      supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=${SELECT}`,
      ),
    ]);
    const process = processes[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    if (process.status === "desierto") {
      return NextResponse.json({ error: "El procedimiento ya está declarado desierto." }, { status: 409 });
    }
    if (!ESTADOS_DECLARABLES.has(process.status)) {
      return NextResponse.json(
        { error: "Solo se puede declarar desierto durante la etapa de selección o buena pro." },
        { status: 409 },
      );
    }

    const [updated] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=${SELECT}`,
      { body: JSON.stringify({ status: "desierto" }), method: "PATCH" },
    );

    await writeAuditLog({
      action: "process.declare_desierto",
      actorReference: auth.user.email ?? auth.user.id,
      details: { from: process.status, motivo: motivo || null },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ process: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo declarar desierto" },
      { status: 500 },
    );
  }
}
