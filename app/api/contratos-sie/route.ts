import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/contratos-sie — lista los contratos guardados del usuario
export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const rows = await supabaseRest<Array<{
      id: string; created_at: string; updated_at: string;
      numero_contrato: string; nomenclatura: string; denominacion: string;
      contratista: string; estado: string;
    }>>(`contratos_sie?user_id=eq.${auth.user.id}&order=updated_at.desc`);

    return NextResponse.json(rows ?? []);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al listar contratos";
    console.error("GET /api/contratos-sie error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/contratos-sie — guarda un nuevo contrato
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    if (!body.data) {
      return NextResponse.json({ error: "Falta 'data' con los campos del contrato" }, { status: 400 });
    }

    const [row] = await supabaseRest<Array<{ id: string }>>("contratos_sie", {
      method: "POST",
      body: JSON.stringify({
        user_id: auth.user.id,
        numero_contrato: body.numeroContrato ?? "",
        nomenclatura: body.data?.proceso?.nomenclatura ?? "",
        denominacion: body.data?.proceso?.denominacion ?? "",
        contratista: body.data?.postor?.razonSocial ?? "",
        estado: body.estado ?? "borrador",
        data: body.data,
      }),
    });

    await writeAuditLog({
      action: "contratos.sie.crear",
      actorReference: auth.user.email ?? auth.user.id,
      details: { id: row?.id, nomenclatura: body.data?.proceso?.nomenclatura },
      entityType: "contrato_sie",
      entityId: row?.id,
      module: "contratos",
    }).catch(() => undefined);

    return NextResponse.json({ id: row?.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar contrato" },
      { status: 500 },
    );
  }
}
