import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { type NecesidadExport, previewHoja } from "@/lib/fase1-export";
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

// El Anexo N° 2 lee de la necesidad más campos que el Anexo N° 1 (descripción,
// clasificador, versiones del requerimiento…). Es el MISMO SELECT que usa la
// descarga: un subconjunto dejaría celdas de la previa en blanco que en el
// .xlsx sí saldrían, que es justo lo que la previa debe evitar.
const SELECT_NECESIDAD =
  "nombre,area_usuaria,monto_estimado,tipo_objeto,fuente_financiamiento,formula_reajuste," +
  "verificacion_ficha_tecnica,cui,cadena_funcional,meta_presupuestal,fecha_requerida," +
  "descripcion_detallada,descripcion_catalogo,clasificador_gasto,summary,fecha_remision_dec,fecha_version_dos,fecha_version_n";

/** La necesidad por los dos extremos del vínculo (hay filas con el enlace cojo). */
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

// GET /api/processes/[id]/fase1/anexo2-preview
//
// Vista previa del Anexo N° 2 (aprobación del expediente, A8) antes de
// descargarlo. Sale del mismo `llenarAnexo2` que el .xlsx —vía `previewHoja`—,
// así que lo que se ve aquí es la hoja que se descarga.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}` +
        `&select=id,nomenclature,object_type,procedure_type,amount,valor_estimado,entity,necesidad_id,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const necesidad = await buscarNecesidad(auth.user.accessToken, id, proceso.necesidad_id);

    // Quién genera el documento: el usuario en sesión. La previa muestra lo
    // mismo que saldrá al exportar (mismo criterio que el Anexo N° 1).
    const responsable = [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email;

    const hoja = await previewHoja("anexo2", {
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

    return NextResponse.json({ hoja });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
