import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { type ProcessDocument, type ProcurementProcess, processUpdateSchema } from "@/lib/processes";
import { deleteStorageObjects, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EvaluationRow = {
  id: string;
  bidder_name: string | null;
  result: string | null;
  matrix: unknown[];
  created_at: string;
};

type RiskRow = { id: string; items: unknown[]; created_at: string };

const SELECT =
  "id,nomenclature,object_type,procedure_type,amount,entity,status,summary,necesidad_id,valor_estimado,moneda,tipo_cambio,certificacion_presupuestal,sistema_contratacion,modalidad_ejecucion,formula_reajuste,pluralidad_marcas,resumen_ejecutivo,requisitos_calificacion,requisitos_precalificacion,tipo_evaluador_perfil,factores_evaluacion,garantias_adelantos,cronograma_contratacion,tipo_interaccion_mercado,tipo_procedimiento,hitos,autoridad_aprobacion,delegacion_facultades,doc_aprobacion_expediente,created_at,updated_at";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const [processes, documents, evaluations, risks] = await Promise.all([
      supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=${SELECT}`,
      ),
      supabaseUserRest<ProcessDocument[]>(
        auth.user.accessToken,
        `process_documents?process_id=eq.${id}&select=id,process_id,kind,bidder_name,title,file_name,storage_bucket,storage_path,mime_type,status,error_message,metadata,created_at&order=created_at.asc`,
      ),
      supabaseUserRest<EvaluationRow[]>(
        auth.user.accessToken,
        `process_evaluations?process_id=eq.${id}&select=id,bidder_name,result,matrix,created_at&order=created_at.desc`,
      ).catch(() => []),
      supabaseUserRest<RiskRow[]>(
        auth.user.accessToken,
        `process_risks?process_id=eq.${id}&select=id,items,created_at&order=created_at.desc`,
      ).catch(() => []),
    ]);

    const process = processes[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ process, documents, evaluations, risks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el expediente" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const payload = processUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 });
  }

  const data = payload.data;
  const patch: Record<string, unknown> = {};
  if (data.nomenclature !== undefined) patch.nomenclature = data.nomenclature;
  if (data.procedureType !== undefined) patch.procedure_type = data.procedureType || null;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.entity !== undefined) patch.entity = data.entity || null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.summary !== undefined) patch.summary = data.summary || null;

  // Campos Ley 32069
  if (data.valorEstimado !== undefined) patch.valor_estimado = data.valorEstimado || null;
  if (data.moneda !== undefined) patch.moneda = data.moneda || null;
  if (data.tipoCambio !== undefined) patch.tipo_cambio = data.tipoCambio || null;
  if (data.certificacionPresupuestal !== undefined) patch.certificacion_presupuestal = data.certificacionPresupuestal || null;
  if (data.sistemaContratacion !== undefined) patch.sistema_contratacion = data.sistemaContratacion || null;
  if (data.modalidadEjecucion !== undefined) patch.modalidad_ejecucion = data.modalidadEjecucion || null;
  if (data.formulaReajuste !== undefined) patch.formula_reajuste = data.formulaReajuste || null;
  if (data.pluralidadMarcas !== undefined) patch.pluralidad_marcas = data.pluralidadMarcas;
  if (data.resumenEjecutivo !== undefined) patch.resumen_ejecutivo = data.resumenEjecutivo || null;
  
  if (data.requisitosCalificacion !== undefined) patch.requisitos_calificacion = data.requisitosCalificacion || null;
  if (data.requisitosPrecalificacion !== undefined) patch.requisitos_precalificacion = data.requisitosPrecalificacion || null;
  if (data.tipoEvaluadorPerfil !== undefined) patch.tipo_evaluador_perfil = data.tipoEvaluadorPerfil || null;
  if (data.factoresEvaluacion !== undefined) patch.factores_evaluacion = data.factoresEvaluacion || null;
  if (data.garantiasAdelantos !== undefined) patch.garantias_adelantos = data.garantiasAdelantos || null;
  if (data.cronogramaContratacion !== undefined) patch.cronograma_contratacion = data.cronogramaContratacion || null;
  if (data.tipoInteraccionMercado !== undefined) patch.tipo_interaccion_mercado = data.tipoInteraccionMercado || null;
  if (data.tipoProcedimiento !== undefined) patch.tipo_procedimiento = data.tipoProcedimiento || null;
  
  if (data.autoridadAprobacion !== undefined) patch.autoridad_aprobacion = data.autoridadAprobacion || null;
  if (data.delegacionFacultades !== undefined) patch.delegacion_facultades = data.delegacionFacultades;
  if (data.docAprobacionExpediente !== undefined) patch.doc_aprobacion_expediente = data.docAprobacionExpediente || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const [process] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}`,
      { body: JSON.stringify(patch), method: "PATCH" },
    );
    return NextResponse.json({ process });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el expediente" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    // Necesidad vinculada: se revierte tras borrar el expediente.
    const [proc] = await supabaseUserRest<Array<{ necesidad_id: string | null }>>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=necesidad_id`,
    ).catch(() => []);

    // Limpia los archivos en Storage antes de borrar (el cascade borra las filas).
    const documents = await supabaseUserRest<Array<{ storage_bucket: string | null; storage_path: string | null }>>(
      auth.user.accessToken,
      `process_documents?process_id=eq.${id}&select=storage_bucket,storage_path`,
    ).catch(() => []);

    const byBucket = new Map<string, string[]>();
    for (const document of documents) {
      if (document.storage_bucket && document.storage_path) {
        byBucket.set(document.storage_bucket, [
          ...(byBucket.get(document.storage_bucket) ?? []),
          document.storage_path,
        ]);
      }
    }
    for (const [bucket, paths] of byBucket) {
      await deleteStorageObjects(bucket, paths).catch(() => undefined);
    }

    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, { method: "DELETE" });

    // Revierte la necesidad de origen para que vuelva a ser editable/eliminable
    // (deja de estar "incorporada al CMN" al desaparecer su expediente).
    if (proc?.necesidad_id) {
      await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${proc.necesidad_id}`, {
        body: JSON.stringify({ process_id: null, status: "conforme" }),
        method: "PATCH",
      }).catch(() => undefined);
    }

    await writeAuditLog({
      action: "process.delete",
      details: { documents: documents.length },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el expediente" },
      { status: 500 },
    );
  }
}
