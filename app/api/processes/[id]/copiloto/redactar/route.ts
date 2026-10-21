import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { PASOS_F1 } from "@/lib/actuaciones-preparatorias";
import { peticionRedaccion, peticionRedaccionA2 } from "@/lib/expediente-copiloto";
import { completarDesdeModelo } from "@/lib/necesidad-copiloto";
import type { HitosMap } from "@/lib/procurement-fases";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ code: z.enum(["A2", "A3", "A4"]) });

type ProcesoRow = {
  procedure_type: string | null;
  object_type: string | null;
  entity: string | null;
  necesidad_id: string | null;
  hitos: HitosMap | null;
};
type NecesidadRow = { tipo_proceso_seleccion: string | null; tipo_objeto: string | null };

// POST /api/processes/[id]/copiloto/redactar  { code: "A3" }
//
// Redacta los apartados del REQUERIMIENTO (A3, Art. 44) con el copiloto, anclado
// al PDF-modelo del proceso y a la norma. Reusa `completarDesdeModelo` (la misma
// maquinaria de la ficha): aquí solo se arma la petición desde el expediente. El
// cliente aplica las propuestas SOLO a los campos vacíos y las revisa antes de
// guardar el paso.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=procedure_type,object_type,entity,necesidad_id,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    // El tipo de proceso ancla el RAG al modelo. Se prefiere el de la necesidad
    // (lo eligió el área usuaria) y, si falta, el del expediente.
    let necesidad: NecesidadRow | null = null;
    if (proceso.necesidad_id) {
      const nec = await supabaseUserRest<NecesidadRow[]>(
        auth.user.accessToken,
        `necesidades?id=eq.${proceso.necesidad_id}&select=tipo_proceso_seleccion,tipo_objeto`,
      ).catch(() => []);
      necesidad = nec[0] ?? null;
    }
    const tipoProceso = (necesidad?.tipo_proceso_seleccion || proceso.procedure_type || "").trim();
    const tipoObjeto = (necesidad?.tipo_objeto || proceso.object_type || "").trim();

    if (!tipoProceso) {
      return NextResponse.json(
        { error: "Falta el tipo de proceso de selección; sin él el copiloto no puede anclarse al modelo. Regístralo en la necesidad o en el expediente." },
        { status: 409 },
      );
    }

    const code = parsed.data.code;
    const data = (proceso.hitos?.[code]?.data ?? {}) as Record<string, unknown>;
    // A2 usa formulario propio (sin esquema `campos`): su narrativa se declara en
    // el helper. A3/A4 salen del esquema genérico del paso.
    const { camposObjetivo, camposLlenos } =
      code === "A2"
        ? peticionRedaccionA2(data)
        : peticionRedaccion(code, PASOS_F1[code]?.campos ?? [], data);

    if (camposObjetivo.length === 0) {
      return NextResponse.json({ campos: {}, exigidos: [], usoModelo: false });
    }

    // A2 (justificación) y A4 (estrategia) son ANÁLISIS que fundamentan; A3 es la
    // descripción del requerimiento.
    const perfil = code === "A2" || code === "A4" ? "estrategia" : "requerimiento";
    const result = await completarDesdeModelo(
      { tipoProcesoSeleccion: tipoProceso, tipoObjeto, camposObjetivo, camposLlenos },
      { entity: auth.user.entity, perfil },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo redactar con el copiloto" },
      { status: 500 },
    );
  }
}
