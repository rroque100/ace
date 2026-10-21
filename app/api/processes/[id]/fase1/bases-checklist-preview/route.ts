import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { previewChecklistBases } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcesoRow = {
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  hitos: HitosMap | null;
};

// GET /api/processes/[id]/fase1/bases-checklist-preview
//
// Vista previa del Checklist de Bases (A9) antes de descargarlo. Sale de la
// misma lista de filas (`filasChecklistBases`, vía `previewChecklistBases`)
// que escribe el .xlsx, así que lo que se ve aquí es la hoja que se descarga.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,entity,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    // Quién genera el documento: el usuario en sesión, mismo criterio que la
    // previa del Anexo N° 1/N° 2.
    const responsable = [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email;

    const hoja = previewChecklistBases({
      hitos: proceso.hitos ?? {},
      proceso: {
        amount: proceso.amount,
        entity: proceso.entity,
        nomenclature: proceso.nomenclature,
        object_type: proceso.object_type,
        procedure_type: proceso.procedure_type,
      },
      responsable,
    });

    return NextResponse.json({ hoja });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
