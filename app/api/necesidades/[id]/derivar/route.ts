import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { type Necesidad } from "@/lib/necesidades";
import { COLUMNAS_SEED, EMBED_ITEMS, seedHitosFromNecesidad } from "@/lib/fase1-precarga";
import { nomenclaturaExpediente } from "@/lib/necesidad-denominacion";
import { objectTypeDeNecesidad, type ProcurementProcess } from "@/lib/processes";
import { supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deriva una Necesidad (Modulo 1) a un Expediente de Contratacion: lo crea la
// DEC (capacidad expediente.manage) e inicia el expediente en actuaciones
// preparatorias, dejando la necesidad como "derivada" y vinculada.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const payload = (await request.json().catch(() => ({}))) as { procedureType?: string };

  try {
    const [necesidades] = await Promise.all([
      supabaseUserRest<Necesidad[]>(
        auth.user.accessToken,
        // Columnas propias del expediente + las que consume la precarga
        // (COLUMNAS_SEED va junto al tipo, para que no puedan divergir).
        `necesidades?id=eq.${id}&select=id,codigo,nombre,summary,status,process_id,entidad,moneda,${COLUMNAS_SEED},${EMBED_ITEMS}`,
      ),
    ]);
    const necesidad = necesidades[0];
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }
    // Una necesidad, UN expediente. Antes esto solo miraba `necesidad.process_id`
    // y, si `reabrir` lo había puesto en null, derivar creaba un expediente
    // NUEVO cada vez → duplicados huérfanos a partir de la misma necesidad.
    //
    // Se comprueban los DOS extremos: el puntero de la necesidad y cualquier
    // expediente que ya la referencie. Si existe, se RECONECTA en vez de
    // duplicar (repara el vínculo cojo y lleva de vuelta al mismo expediente).
    const yaVinculado =
      necesidad.process_id ||
      (
        await supabaseUserRest<{ id: string }[]>(
          auth.user.accessToken,
          `procurement_processes?necesidad_id=eq.${id}&select=id&limit=1`,
        ).catch(() => [])
      )[0]?.id;

    if (yaVinculado) {
      // Cose la dirección que faltara y devuelve el expediente existente.
      await supabaseUserRest(
        auth.user.accessToken,
        `necesidades?id=eq.${id}&process_id=is.null`,
        { body: JSON.stringify({ process_id: yaVinculado }), method: "PATCH" },
      ).catch(() => undefined);
      await supabaseUserRest(
        auth.user.accessToken,
        `procurement_processes?id=eq.${yaVinculado}&necesidad_id=is.null`,
        { body: JSON.stringify({ necesidad_id: id }), method: "PATCH" },
      ).catch(() => undefined);
      return NextResponse.json({ processId: yaVinculado, reconectado: true });
    }
    if (necesidad.status !== "conforme") {
      return NextResponse.json(
        { error: "Solo se puede derivar un requerimiento conforme (CMN verificado y no objeción resuelta)." },
        { status: 409 },
      );
    }

    const nomenclature = nomenclaturaExpediente(necesidad.codigo, necesidad.nombre);
    // Precarga inteligente: siembra A1 (CMN/PAC) y A3 (Requerimiento) con lo ya
    // capturado en la Necesidad para no re-preguntarlo en la Fase 1.
    const hitos = seedHitosFromNecesidad(necesidad);

    // El procedimiento que se elige al derivar es el PROGRAMADO EN EL PAC: un
    // hecho, no una decisión. Se siembra en A1, que es donde vive el PAC.
    //
    // NO se escribe en `procurement_processes.procedure_type`: ese lo determina
    // la DEC en la estrategia (Art. 46.1.a), cuando ya conoce el requerimiento,
    // la segmentación y el mercado. Fijarlo aquí era decidir antes de saber, y
    // dejaba a A4 sin nada contra lo que comparar en su variable a).
    if (payload.procedureType) {
      hitos.A1 = {
        ...(hitos.A1 ?? { status: "en_curso" }),
        data: { ...(hitos.A1?.data ?? {}), procedimiento_pac: payload.procedureType },
      };
    }
    let process: ProcurementProcess;
    try {
      [process] = await supabaseUserRest<ProcurementProcess[]>(
        auth.user.accessToken,
        "procurement_processes?select=id,nomenclature,object_type,procedure_type,amount,entity,status,summary,created_at,updated_at",
        {
          body: JSON.stringify({
            nomenclature,
            object_type: objectTypeDeNecesidad(necesidad.tipo_objeto),
            entity: necesidad.entidad || auth.user.entity || null,
            status: "actuaciones_preparatorias",
            summary: necesidad.summary || null,
            moneda: necesidad.moneda || null,
            formula_reajuste: necesidad.formula_reajuste || null,
            requisitos_calificacion: necesidad.requisitos_calificacion || null,
            necesidad_id: necesidad.id,
            owner_id: auth.user.id,
            ...(Object.keys(hitos).length > 0 ? { hitos } : {}),
          }),
          method: "POST",
        },
      );
    } catch (err) {
      // `objectTypeDeNecesidad` solo traduce el caso documentado
      // ("consultoria_obra" → "consultoria"). Si el tipo_objeto real de esta
      // necesidad es otra cosa (dato legado, variante con otra grafía), el
      // CHECK igual revienta y el error de Postgres no dice qué valor fue: se
      // adjunta aquí para no tener que adivinarlo a ciegas la próxima vez.
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `${msg} [tipo_objeto de la necesidad: "${necesidad.tipo_objeto}" → mapeado a "${objectTypeDeNecesidad(necesidad.tipo_objeto)}"]`,
      );
    }

    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${id}`, {
      body: JSON.stringify({ status: "incorporado_cmn", process_id: process.id }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: "necesidad.derivar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { necesidad: necesidad.codigo, processId: process.id },
      entityId: process.id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo derivar la necesidad" },
      { status: 500 },
    );
  }
}
