import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { objectTypeDeNecesidad, type ProcurementProcess, processCreateSchema } from "@/lib/processes";
import { construirQueryProcesos } from "@/lib/procesos-query";
import { FASES, type HitosMap, progresoDeFase } from "@/lib/procurement-fases";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10) || 24));

  const query = construirQueryProcesos({
    fase: searchParams.get("fase")?.trim() || "",
    limit,
    meta: searchParams.get("meta")?.trim() || "",
    objectType: searchParams.get("object_type")?.trim() || "",
    offset: (page - 1) * limit,
    oficina: searchParams.get("oficina")?.trim() || "",
    procedureType: searchParams.get("procedure_type")?.trim() || "",
    search: searchParams.get("search")?.trim() || "",
    status: searchParams.get("status")?.trim() || "",
  });

  try {
    // RLS limita a los expedientes del usuario (o todos si es admin).
    const processes = await supabaseUserRest<Array<ProcurementProcess & { status: string; hitos?: HitosMap | null }>>(
      auth.user.accessToken,
      `procurement_processes?${query}`,
    );
    // El `hitos` jsonb (~10 KB/fila) NO se manda al cliente: la tarjeta de la
    // lista solo pinta "completados/total" de la fase actual. Se calcula ese
    // avance aquí y se devuelve en su lugar; el jsonb entero era la mayor parte
    // del peso de la lista (~150 KB por página, de los que se usaban 2 enteros).
    const conAvance = processes.map(({ hitos, ...resto }) => {
      const fase = FASES.find((f) => f.statuses.includes(resto.status));
      return { ...resto, avance: fase ? progresoDeFase(fase.id, hitos ?? {}) : null };
    });
    return NextResponse.json({ processes: conAvance, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar los expedientes", processes: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const payload = processCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: payload.error.flatten() },
      { status: 400 },
    );
  }

  const data = payload.data;

  try {
    const [process] = await supabaseUserRest<ProcurementProcess[]>(
      auth.user.accessToken,
      "procurement_processes",
      {
        body: JSON.stringify({
          amount: typeof data.amount === "number" ? data.amount : null,
          entity: data.entity || auth.user.entity || null,
          nomenclature: data.nomenclature,
          // El copiloto (Mi Yo) puede interpretar "consultoria_obra".
          object_type: objectTypeDeNecesidad(data.objectType),
          owner_id: auth.user.id,
          procedure_type: data.procedureType || null,
          summary: data.summary || null,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "process.create",
      details: {
        entity: process.entity,
        nomenclature: data.nomenclature,
        objectType: data.objectType,
        processType: process.procedure_type,
      },
      entityId: process.id,
      entityType: "procurement_process",
      module: "expedientes",
      processType: process.procedure_type,
      user: {
        email: auth.user.email,
        entity: process.entity ?? auth.user.entity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el expediente" },
      { status: 500 },
    );
  }
}
