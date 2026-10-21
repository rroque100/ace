import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { extraerCamposDePropuesta, trasladarFichaRequestSchema } from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/necesidades/[id]/eett-tdr/trasladar
//
// Extrae de la propuesta ya generada los valores que corresponden a cada campo
// de la ficha, para que el usuario los revise. NO ESCRIBE NADA: el traslado lo
// aplica el cliente con PATCH /api/necesidades/[id], y solo con los campos a los
// que se les dio el visto bueno.
//
// La separación es a propósito: proponer y escribir son dos decisiones, y la
// segunda es del usuario. El traslado PISA lo que el área usuaria ya redactó.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  // El id identifica la necesidad en la ruta; la extracción trabaja sobre el
  // contenido que envía el modal, así que aquí solo se valida el acceso.
  await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const payload = trasladarFichaRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }

  try {
    const result = await extraerCamposDePropuesta(payload.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron extraer los campos de la propuesta." },
      { status: 500 },
    );
  }
}
