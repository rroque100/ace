import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { copilotoRequestSchema, streamCopiloto } from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Redacción con OpenAI en streaming; evita que el proxy corte por timeout.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // El copiloto trabaja sobre el requerimiento: mismo permiso que editar la
    // necesidad. Así no expone la IA a quien solo puede leer.
    const auth = await requireCapability("necesidad.manage");
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = copilotoRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud inválida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    // La entidad viene del usuario autenticado (no del body): permite al copiloto
    // preferir el PDF-modelo de la propia entidad cuando varias lo tienen cargado.
    const events = streamCopiloto(payload.data, { entity: auth.user.entity });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "No se pudo generar la respuesta",
              })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la respuesta" },
      { status: 500 },
    );
  }
}
