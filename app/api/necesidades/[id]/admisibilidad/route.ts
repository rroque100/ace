import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireDec, requireUser } from "@/lib/auth";
import { type AdmisibilidadEstado } from "@/lib/necesidad-admisibilidad";
import { admisibilidadUpdateSchema } from "@/lib/necesidad-admisibilidad-schema";
import { supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdmisibilidadRow = {
  necesidad_id: string;
  items: AdmisibilidadEstado;
  actualizado_por: string | null;
  updated_at: string;
};

const SELECT = "necesidad_id,items,actualizado_por,updated_at";

// GET: cualquiera que vea la necesidad puede leer el checklist (RLS select=true).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const [row] = await supabaseUserRest<AdmisibilidadRow[]>(
      auth.user.accessToken,
      `necesidad_admisibilidad?necesidad_id=eq.${id}&select=${SELECT}`,
    );
    return NextResponse.json({
      items: row?.items ?? {},
      actualizadoPor: row?.actualizado_por ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer la admisibilidad." },
      { status: 500 },
    );
  }
}

// PUT: solo la DEC/admin marca la admisibilidad. Se escribe con service-role
// (la DEC puede no ser dueña ni colaboradora de la necesidad); requireDec es el
// enforcement del rol. Upsert por `necesidad_id`.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireDec();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const parsed = admisibilidadUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [row] = await supabaseRest<AdmisibilidadRow[]>(
      `necesidad_admisibilidad?on_conflict=necesidad_id&select=${SELECT}`,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          necesidad_id: id,
          items: parsed.data.items,
          actualizado_por: auth.user.email ?? auth.user.id,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    await writeAuditLog({
      action: "necesidad.admisibilidad",
      actorReference: auth.user.email ?? auth.user.id,
      entityId: id,
      entityType: "necesidad",
      details: { marcados: Object.values(parsed.data.items).filter((v) => v.ok).length },
    });

    return NextResponse.json({
      items: row?.items ?? parsed.data.items,
      actualizadoPor: row?.actualizado_por ?? (auth.user.email ?? auth.user.id),
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la admisibilidad." },
      { status: 500 },
    );
  }
}
