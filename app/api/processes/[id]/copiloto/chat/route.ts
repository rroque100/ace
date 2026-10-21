import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { chatExpediente, resumenEstadoExpediente } from "@/lib/expediente-copiloto";
import type { HitosMap } from "@/lib/procurement-fases";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ pregunta: z.string().trim().min(2).max(2000) });

type ProcesoRow = { valor_estimado: number | string | null; hitos: HitosMap | null };

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// PAC de bienes/servicios (Configuración) para el checklist de coherencia A2↔A5.
// Service-role a propósito (mismo criterio que el informe de segmentación).
async function getPacBienesServicios(): Promise<number | null> {
  const rows = await supabaseRest<Array<{ pac_monto_bienes_servicios: number | string | null }>>(
    "entity_settings?id=eq.default&select=pac_monto_bienes_servicios&limit=1",
  ).catch(() => []);
  return num(rows[0]?.pac_monto_bienes_servicios);
}

// POST /api/processes/[id]/copiloto/chat  { pregunta }
//
// Chat del expediente (iteración 4): responde preguntas sobre ESTE expediente,
// combinando su estado determinista (checklist Art. 54.2) con el RAG de la norma.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    // El proceso y el PAC son independientes: en paralelo antes del LLM (cuyo
    // coste es el que manda; esto solo quita un round-trip previo).
    const [rows, pac] = await Promise.all([
      supabaseUserRest<ProcesoRow[]>(
        auth.user.accessToken,
        `procurement_processes?id=eq.${id}&select=valor_estimado,hitos`,
      ),
      getPacBienesServicios(),
    ]);
    const proceso = rows[0];
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const resumen = resumenEstadoExpediente(proceso.hitos ?? {}, num(proceso.valor_estimado), pac);
    const { answer, sources } = await chatExpediente(parsed.data.pregunta, resumen);

    return NextResponse.json({ answer, sources });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo responder" },
      { status: 500 },
    );
  }
}
