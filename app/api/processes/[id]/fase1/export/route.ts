import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_XLSX } from "@/lib/archivar-formato";

/** Paso que genera cada formato de este endpoint, para buscarlo en el catálogo. */
const PASO_DE_FORMATO: Record<string, string> = {
  anexo1: "A5",
  anexo2: "A8",
  bases_checklist: "A9",
  estrategia: "A4",
};
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { type FormatoF1, type NecesidadExport, generarExcelF1 } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORMATOS: FormatoF1[] = ["estrategia", "anexo1", "anexo2", "anexo3", "bases_checklist"];

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

const SELECT_NECESIDAD =
  "nombre,area_usuaria,monto_estimado,tipo_objeto,fuente_financiamiento,formula_reajuste,verificacion_ficha_tecnica,cui,cadena_funcional,meta_presupuestal,fecha_requerida,descripcion_detallada,descripcion_catalogo,clasificador_gasto,summary,fecha_remision_dec,fecha_version_dos,fecha_version_n,especialidad,subespecialidad";

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

// GET /api/processes/[id]/fase1/export?formato=estrategia|anexo1|anexo2
// Descarga el formato oficial de la FASE 1 en .xlsx, rellenado con los datos del
// expediente y sus pasos (hitos).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  const formato = new URL(request.url).searchParams.get("formato") as FormatoF1 | null;
  if (!formato || !FORMATOS.includes(formato)) {
    return NextResponse.json(
      { error: `Formato inválido. Usa uno de: ${FORMATOS.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,procedure_type,amount,valor_estimado,entity,necesidad_id,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    // La denominación, el área usuaria y el objeto viven en la Necesidad, no en
    // el expediente: sin esto el Anexo N° 1 sale anónimo.
    const necesidad = await buscarNecesidad(auth.user.accessToken, id, proceso.necesidad_id);

    const { buffer, filename } = await generarExcelF1(formato, {
      necesidad,
      // El Anexo N° 1 firma como responsable de la DEC a quien descarga (ya no se
      // teclea en A5): nombre y cargo salen de su perfil. El cargo es el del perfil,
      // NO el rol del sistema (dec/admin), que no es un puesto.
      responsable: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
      proceso: {
        nomenclature: proceso.nomenclature,
        object_type: proceso.object_type,
        procedure_type: proceso.procedure_type,
        amount: proceso.amount,
        valor_estimado: proceso.valor_estimado,
        entity: proceso.entity,
      },
      hitos: proceso.hitos ?? {},
    });

    // Generar el formato ES incorporarlo al expediente: se archiva además de
    // descargarse, para que la Instrucción lo cuente y el Art. 54 se cumpla con
    // lo que hay en el sistema y no con lo que alguien tenga en Descargas.
    const archivable = FORMATOS_ARCHIVABLES[`${PASO_DE_FORMATO[formato] ?? ""}|${formato}`];
    if (archivable) {
      await archivarFormato({
        accessToken: auth.user.accessToken,
        actorReference: auth.user.email ?? auth.user.id,
        contenido: new Uint8Array(buffer),
        fileName: filename,
        formato: archivable,
        mimeType: MIME_XLSX,
        ownerId: auth.user.id,
        processId: id,
      });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_XLSX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el formato." },
      { status: 500 },
    );
  }
}
