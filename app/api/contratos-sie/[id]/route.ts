import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/contratos-sie/[id] — obtiene un contrato guardado
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const rows = await supabaseRest<Array<Record<string, unknown>>>(`contratos_sie?id=eq.${id}&user_id=eq.${auth.user.id}&select=*`);
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener contrato" },
      { status: 500 },
    );
  }
}

// PATCH /api/contratos-sie/[id] — actualiza un contrato guardado
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    if (!body.data) {
      return NextResponse.json({ error: "Falta 'data' con los campos del contrato" }, { status: 400 });
    }

    await supabaseRest(`contratos_sie?id=eq.${id}&user_id=eq.${auth.user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        numero_contrato: body.numeroContrato ?? "",
        nomenclatura: body.data?.proceso?.nomenclatura ?? "",
        denominacion: body.data?.proceso?.denominacion ?? "",
        contratista: body.data?.postor?.razonSocial ?? "",
        estado: body.estado ?? "borrador",
        data: body.data,
      }),
    });

    await writeAuditLog({
      action: "contratos.sie.actualizar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id, nomenclatura: body.data?.proceso?.nomenclatura },
      entityType: "contrato_sie",
      entityId: id,
      module: "contratos",
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar contrato" },
      { status: 500 },
    );
  }
}

// DELETE /api/contratos-sie/[id] — elimina un contrato guardado
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    await supabaseRest(`contratos_sie?id=eq.${id}&user_id=eq.${auth.user.id}`, {
      method: "DELETE",
    });

    await writeAuditLog({
      action: "contratos.sie.eliminar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id },
      entityType: "contrato_sie",
      entityId: id,
      module: "contratos",
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al eliminar contrato" },
      { status: 500 },
    );
  }
}
