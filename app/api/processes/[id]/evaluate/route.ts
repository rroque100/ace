import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { evaluateOfferForProcess, type ProcessDocumentWithText } from "@/lib/process-agents";
import type { ProcurementProcess } from "@/lib/processes";
import { reconcileProcessStatus } from "@/lib/process-status";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.evaluate");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const payload = (await request.json().catch(() => ({}))) as { bidderName?: string };

  try {
    const [processes, documents] = await Promise.all([
      supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at`,
      ),
      supabaseUserRest<ProcessDocumentWithText[]>(
        auth.user.accessToken,
        `process_documents?process_id=eq.${id}&select=id,kind,bidder_name,title,extracted_text,status&order=created_at.asc`,
      ),
    ]);
    const process = processes[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const result = await evaluateOfferForProcess({
      bidderName: payload.bidderName?.trim() || null,
      documents,
      process,
    });

    const [evaluation] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      "process_evaluations",
      {
        body: JSON.stringify({
          bidder_name: result.bidderName,
          matrix: result.matrix,
          model: result.model,
          observations: result.observations,
          owner_id: auth.user.id,
          process_id: id,
          result: result.result,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "process.evaluate_offer",
      actorReference: auth.user.id,
      details: { bidderName: result.bidderName, result: result.result, rows: result.matrix.length },
      entityId: id,
      entityType: "procurement_process",
    });

    const advancedTo = await reconcileProcessStatus(auth.user.accessToken, id);

    return NextResponse.json({ evaluation, result, statusAdvancedTo: advancedTo });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo evaluar la oferta" },
      { status: 500 },
    );
  }
}
