import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { chatRequestSchema, streamLegalAnswer } from "@/lib/legal-chat";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Recuperacion hibrida + rerank + redaccion con OpenAI pueden tardar; evita que
// Vercel corte la respuesta con su timeout por defecto.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "chat"),
      RATE_LIMITS.chat,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    const payload = chatRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    // Respuesta en streaming: una linea JSON (NDJSON) por evento
    // (meta -> delta... -> done). El cliente la lee incrementalmente.
    const encoder = new TextEncoder();
    const events = streamLegalAnswer(payload.data, {
      accessToken: auth.user.accessToken,
      actorReference: auth.user.email ?? auth.user.id,
      entity: auth.user.entity,
      ownerId: auth.user.id,
      role: auth.user.role,
    });

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
        // Evita el buffering de proxies para que el streaming llegue en vivo.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo generar la respuesta",
      },
      { status: 500 },
    );
  }
}
