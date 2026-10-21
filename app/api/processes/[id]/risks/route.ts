import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { detectRisksForProcess, type ProcessDocumentWithText } from "@/lib/process-agents";
import type { ProcurementProcess } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.risks");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

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

    const result = await detectRisksForProcess({ documents, process });
    const [riskRun] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      "process_risks",
      {
        body: JSON.stringify({
          items: result.items,
          model: result.model,
          owner_id: auth.user.id,
          process_id: id,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "process.detect_risks",
      actorReference: auth.user.id,
      details: { items: result.items.length },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ result, riskRun });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo detectar riesgos" },
      { status: 500 },
    );
  }
}
