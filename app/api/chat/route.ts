import { reportedProvider } from "@/lib/openai-server";
import { legalResponseTelemetry } from "@/lib/legal-telemetry";
import { supabaseUserRest } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { chatRequestSchema, streamLegalAnswer } from "@/lib/legal-chat";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Recuperacion hibrida + rerank + redaccion con OpenAI pueden tardar; evita que
// Vercel corte la respuesta con su timeout por defecto.
export const maxDuration = 120;

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
    const startedAt = Date.now();
    let retrievedAt = startedAt; let sourceCount = 0; let warningCount = 0;
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
            if (event.type === "meta") { retrievedAt = Date.now(); sourceCount = event.sources.length; warningCount = event.assessment.evidenceWarnings.length; }
            if (event.type === "done") {
              const telemetry = legalResponseTelemetry({ startedAt,retrievedAt,finishedAt:Date.now(),provider:reportedProvider(event.model),model:event.model,officialSources:sourceCount,caseDocuments:payload.data.attachmentIds?.length ?? 0,warnings:warningCount+(event.citationWarnings?.length ?? 0) });
              if (event.messageId) {
                // JWT + RLS: los detalles operativos se guardan junto al turno privado, no en un log general.
                await (async () => { const [row] = await supabaseUserRest<Array<{metadata:Record<string,unknown>}>>(auth.user.accessToken,`chat_messages?id=eq.${event.messageId}&select=metadata`); if(row) await supabaseUserRest(auth.user.accessToken,`chat_messages?id=eq.${event.messageId}`,{method:"PATCH",body:JSON.stringify({metadata:{...row.metadata,telemetry}})}); })().catch(() => undefined);
              }
              controller.enqueue(encoder.encode(`${JSON.stringify({...event,telemetry})}\n`));
            } else controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
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
