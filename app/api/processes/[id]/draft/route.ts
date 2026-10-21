import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import {
  buildAdministrativeDraftDocx,
  draftKinds,
  type DraftDocumentRow,
  type ProcessEvaluationResult,
  type ProcessRiskResult,
} from "@/lib/process-agents";
import type { ProcurementProcess } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const draftSchema = z.object({
  draftKind: z.enum(draftKinds.map((item) => item.value) as [string, ...string[]]),
});

type EvaluationRow = {
  bidder_name: string | null;
  result: ProcessEvaluationResult["result"];
  matrix: ProcessEvaluationResult["matrix"];
  observations: string[];
  model: string | null;
};

type RiskRow = {
  items: ProcessRiskResult["items"];
  model: string | null;
};

function safeFileName(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.draft");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const payload = draftSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Selecciona un tipo de documento valido" }, { status: 400 });
  }

  try {
    const [processes, evaluations, risks, documents] = await Promise.all([
      supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at`,
      ),
      supabaseUserRest<EvaluationRow[]>(
        auth.user.accessToken,
        `process_evaluations?process_id=eq.${id}&select=bidder_name,result,matrix,observations,model&order=created_at.desc&limit=1`,
      ).catch(() => []),
      supabaseUserRest<RiskRow[]>(
        auth.user.accessToken,
        `process_risks?process_id=eq.${id}&select=items,model&order=created_at.desc&limit=1`,
      ).catch(() => []),
      supabaseUserRest<DraftDocumentRow[]>(
        auth.user.accessToken,
        `process_documents?process_id=eq.${id}&select=kind,title,bidder_name,created_at&order=created_at.asc`,
      ).catch(() => []),
    ]);
    const process = processes[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const evaluation = evaluations[0]
      ? {
          bidderName: evaluations[0].bidder_name,
          matrix: evaluations[0].matrix,
          model: evaluations[0].model ?? "stored-evaluation",
          observations: evaluations[0].observations ?? [],
          result: evaluations[0].result,
        }
      : null;
    const riskResult = risks[0] ? { items: risks[0].items, model: risks[0].model ?? "stored-risks" } : null;
    const buffer = await buildAdministrativeDraftDocx({
      draftKind: payload.data.draftKind as Parameters<typeof buildAdministrativeDraftDocx>[0]["draftKind"],
      documents,
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
      evaluation,
      process,
      risks: riskResult,
    });

    await writeAuditLog({
      action: "process.draft_generate",
      actorReference: auth.user.id,
      details: { draftKind: payload.data.draftKind },
      entityId: id,
      entityType: "procurement_process",
    });

    const body = new Uint8Array(buffer);

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFileName(`${payload.data.draftKind}-${process.nomenclature}`)}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el documento" },
      { status: 500 },
    );
  }
}
