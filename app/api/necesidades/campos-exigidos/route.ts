import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { camposExigidosDelModelo, camposExigidosRequestSchema } from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/necesidades/campos-exigidos
//
// Qué campos de la ficha EXIGE el modelo de requerimiento del procedimiento
// elegido, para ese objeto. Es lo que permite que la ficha muestre solo lo que
// toca en vez de sus ~70 campos.
//
// No cuelga de una necesidad concreta a propósito: la respuesta depende del
// PROCEDIMIENTO y del OBJETO, no del expediente, y se cachea en la metadata del
// propio PDF-modelo para que la reutilicen todas las necesidades de la entidad.
export async function POST(request: Request) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const payload = camposExigidosRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }

  try {
    const result = await camposExigidosDelModelo(payload.data, { entity: auth.user.entity });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron determinar los campos exigidos." },
      { status: 500 },
    );
  }
}
