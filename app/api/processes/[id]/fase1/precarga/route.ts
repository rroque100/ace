import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import {
  COLUMNAS_SEED,
  EMBED_ITEMS,
  mergeSeedIntoHitos,
  refrescarProcedimientoA4,
  refrescarPropuestasA3,
  refrescarRequisitosEspejo,
  seedHitosFromNecesidad,
  type NecesidadSeedInput,
} from "@/lib/fase1-precarga";
import { type HitosMap } from "@/lib/procurement-fases";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcessRow = { id: string; necesidad_id: string | null; hitos: HitosMap | null };

// POST /api/processes/[id]/fase1/precarga → sincronización retroactiva: rellena
// los hitos A1/A3 del expediente con los datos de la necesidad vinculada, sin
// sobrescribir lo que el usuario ya llenó. Para expedientes derivados antes de
// que existiera la precarga automática.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const rows = await supabaseUserRest<ProcessRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,necesidad_id,hitos`,
    );
    const process = rows[0];
    if (!process) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    // La necesidad se busca por LOS DOS extremos del vínculo.
    //
    // `reabrir` borra `necesidad.process_id` pero deja intacto el
    // `necesidad_id` del expediente (y viceversa en filas antiguas), así que un
    // vínculo cojo dejaba la precarga sin fuente aunque la necesidad existiera.
    // Mismo criterio que el informe de segmentación (A2).
    let necesidad: (NecesidadSeedInput & { id: string }) | undefined;
    if (process.necesidad_id) {
      const porId = await supabaseUserRest<(NecesidadSeedInput & { id: string })[]>(
        auth.user.accessToken,
        // Ojo: el tipo es una aserción, no una comprobación. Si se añade un
        // campo a NecesidadSeedInput y no se añade aquí, llega undefined.
        `necesidades?id=eq.${process.necesidad_id}&select=id,${COLUMNAS_SEED},${EMBED_ITEMS}`,
      ).catch(() => []);
      necesidad = porId[0];
    }
    if (!necesidad) {
      const porProceso = await supabaseUserRest<(NecesidadSeedInput & { id: string })[]>(
        auth.user.accessToken,
        `necesidades?process_id=eq.${id}&select=${COLUMNAS_SEED},${EMBED_ITEMS}&limit=1`,
      ).catch(() => []);
      necesidad = porProceso[0];
    }
    if (!necesidad) {
      return NextResponse.json(
        { error: "Este expediente no está vinculado a ninguna necesidad; no hay datos para traer." },
        { status: 409 },
      );
    }
    if (!necesidad) {
      return NextResponse.json({ error: "No se pudo leer la necesidad vinculada." }, { status: 404 });
    }

    // Si el vínculo estaba cojo, se cose ahora: se repara la dirección que
    // faltara para que no vuelva a fallar ni derivar cree un duplicado.
    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, {
      body: JSON.stringify({ necesidad_id: necesidad.id }),
      method: "PATCH",
    }).catch(() => undefined);
    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${necesidad.id}&process_id=is.null`, {
      body: JSON.stringify({ process_id: id }),
      method: "PATCH",
    }).catch(() => undefined);

    const seed = seedHitosFromNecesidad(necesidad);
    const merged = mergeSeedIntoHitos(process.hitos ?? {}, seed);

    // Además de rellenar huecos, se PONE AL DÍA la propuesta de requisitos (b)
    // del requerimiento) en A3 y su copia tal cual en A4 f) cuando la necesidad
    // creció desde la última precarga. Sin esto, "Traer datos" no traía la
    // sección b) ampliada porque merge solo rellena campos vacíos.
    const refresco = refrescarRequisitosEspejo(merged.hitos, necesidad);
    // a) Tipo de procedimiento: "Traer datos" lo ACTUALIZA desde la clasificación
    // vigente de la ficha (objeto + tipo de proceso), no solo lo rellena si vacío.
    const refrescoProc = refrescarProcedimientoA4(refresco.hitos, necesidad);
    // c.1) Modalidad de pago y c.2) Sistema de entrega de A3: reflejan el
    // requerimiento, así que "Traer datos" las pone al día con la ficha.
    const refrescoA3 = refrescarPropuestasA3(refrescoProc.hitos, necesidad);
    const hitos = refrescoA3.hitos;
    const refrescado = refresco.refrescado || refrescoProc.refrescado || refrescoA3.refrescado;
    const llenados = merged.llenados;

    if (llenados === 0 && !refrescado) {
      return NextResponse.json({ hitos: process.hitos ?? {}, llenados: 0, requisitosRefrescados: false });
    }

    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, {
      body: JSON.stringify({ hitos }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "process.fase1.precarga",
      actorReference: auth.user.email ?? auth.user.id,
      details: { camposLlenados: llenados, requisitosRefrescados: refrescado },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ hitos, llenados, requisitosRefrescados: refrescado });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo precargar desde la necesidad" },
      { status: 500 },
    );
  }
}
