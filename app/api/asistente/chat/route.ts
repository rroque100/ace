import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { responderMiYo } from "@/lib/mi-yo";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1, "Escribe un mensaje").max(1000),
  conversationId: z.string().uuid().optional(),
  // Con qué registro está el usuario en pantalla (lo calcula el widget según
  // la ruta actual) — habilita la categoría "registro" del clasificador.
  contexto: z.object({ tipo: z.enum(["necesidad", "expediente"]), id: z.string().uuid() }).optional(),
});

// Mismo endpoint sin importar el módulo desde el que se abre "Mi Yo": clasifica
// la intención y despacha a la lógica ya existente (legal/archivo/actividad)
// o responde directo. Ver lib/mi-yo.ts.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    // Mismo límite que el chat legal: es la llamada más cara del módulo.
    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "asistente-chat"), RATE_LIMITS.chat);
    if (!rl.allowed) return rateLimitResponse(rl);

    const payload = bodySchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
    }

    const result = await responderMiYo(
      auth.user,
      payload.data.message,
      payload.data.conversationId,
      payload.data.contexto,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo responder la consulta" },
      { status: 500 },
    );
  }
}
