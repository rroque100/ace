import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { type NecesidadExport, previewAnexo1, previewHoja } from "@/lib/fase1-export";
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
  valor_estimado: number | null;
  entity: string | null;
  necesidad_id: string | null;
  hitos: HitosMap | null;
};

const SELECT_NECESIDAD = "nombre,area_usuaria,monto_estimado,tipo_objeto";

/**
 * Busca la necesidad del expediente por LOS DOS extremos del vínculo:
 * `procurement_processes.necesidad_id` o `necesidades.process_id`.
 *
 * Existen filas con el vínculo cojo —solo un lado apunta al otro—, y mirar un
 * único extremo deja el formato sin la denominación. Mismo criterio que el
 * informe de segmentación (A2).
 */
async function buscarNecesidad(
  token: string,
  procesoId: string,
  necesidadId: string | null,
): Promise<NecesidadExport | null> {
  if (necesidadId) {
    const porId = await supabaseUserRest<NecesidadExport[]>(
      token,
      `necesidades?id=eq.${necesidadId}&select=${SELECT_NECESIDAD}`,
    ).catch(() => []);
    if (porId[0]) return porId[0];
  }
  const porProceso = await supabaseUserRest<NecesidadExport[]>(
    token,
    `necesidades?process_id=eq.${procesoId}&select=${SELECT_NECESIDAD}&limit=1`,
  ).catch(() => []);
  return porProceso[0] ?? null;
}

// GET /api/processes/[id]/fase1/anexo1-preview
//
// Vista previa del Anexo N° 1 para revisar ANTES de descargar. Sale del mismo
// `llenarAnexo1` que el .xlsx: una previa con su propio código podría mentir
// sobre lo que acabas descargando.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,valor_estimado,entity,necesidad_id,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const necesidad = await buscarNecesidad(auth.user.accessToken, id, proceso.necesidad_id);

    // El responsable de la DEC del Anexo es quien descarga: nombre y cargo salen
    // de su perfil. La previa muestra lo mismo que saldrá al exportar.
    const responsable = [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email;

    // La hoja tal y como se exporta, para revisarla antes de descargar.
    const hoja = await previewHoja("anexo1", {
      hitos: proceso.hitos ?? {},
      necesidad,
      responsable,
      proceso: {
        amount: proceso.amount,
        entity: proceso.entity,
        nomenclature: proceso.nomenclature,
        object_type: proceso.object_type,
        procedure_type: proceso.procedure_type,
        valor_estimado: proceso.valor_estimado,
      },
    });

    const preview = await previewAnexo1({
      hitos: proceso.hitos ?? {},
      necesidad,
      responsable,
      proceso: {
        amount: proceso.amount,
        entity: proceso.entity,
        nomenclature: proceso.nomenclature,
        object_type: proceso.object_type,
        procedure_type: proceso.procedure_type,
        valor_estimado: proceso.valor_estimado,
      },
    });

    return NextResponse.json({ ...preview, hoja });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
