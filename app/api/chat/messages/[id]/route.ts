import {feedbackSchema,type FeedbackReason} from "@/lib/chat-experience";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest, writeAuditLog, esIdSeguro } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessageRow = {
  content?: string;
  id: string;
  metadata: Record<string, unknown>;
  role: "user" | "assistant" | "system";
  sources?: unknown[];
};

function mergeMessageMetadata(
  current: Record<string, unknown>,
  input: { action: string; note?: string | null;reason?:FeedbackReason },
) {
  const feedbackHistory = Array.isArray(current.feedbackHistory)
    ? current.feedbackHistory
    : [];
  const nextMetadata = {
    ...current,
    feedbackHistory: [
      ...feedbackHistory,
      {
        action: input.action,
        createdAt: new Date().toISOString(),
        note: input.note ?? null,
        reason:input.reason??null,
      },
    ],
  };

  if (input.action === "save_note") {
    return {
      ...nextMetadata,
      note: input.note ?? "",
      noteSavedAt: new Date().toISOString(),
    };
  }

  if (input.action === "mark_correct" || input.action === "mark_incorrect") {
    return {
      ...nextMetadata,
      feedback: input.action === "mark_correct" ? "correct" : "incorrect",
      feedbackAt: new Date().toISOString(),
      feedbackNote: input.note ?? null,
      feedbackReason:input.reason??null,
      feedbackReviewStatus:"user_feedback",
    };
  }

  return nextMetadata;
}

function sourceExpectation(source: unknown) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const row = source as Record<string, unknown>;
  return {
    article: typeof row.article === "string" ? row.article : undefined,
    documentType: typeof row.documentType === "string" ? row.documentType : undefined,
    processType: typeof row.processType === "string" ? row.processType : undefined,
    titleIncludes:
      typeof row.documentTitle === "string"
        ? row.documentTitle.split(/[,-]/)[0]?.trim().slice(0, 80)
        : undefined,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { accessToken } = auth.user;
    const { id } = await context.params;
    const parsed=feedbackSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return NextResponse.json({error:"Revisa la acción, el motivo y la extensión del comentario"},{status:400});
    const body=parsed.data;

    if (!esIdSeguro(id)) {
      return NextResponse.json({ error: "Falta id del mensaje" }, { status: 400 });
    }

    if (!body.action || !["save_note", "mark_correct", "mark_incorrect"].includes(body.action)) {
      return NextResponse.json({ error: "Accion no permitida" }, { status: 400 });
    }

    // RLS asegura que el usuario solo pueda tocar mensajes de sus sesiones.
    const [message] = await supabaseUserRest<ChatMessageRow[]>(
      accessToken,
      `chat_messages?id=eq.${id}&select=id,role,content,sources,metadata`,
    );

    if (!message) {
      return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
    }

    if (message.role !== "assistant") {
      return NextResponse.json(
        { error: "Solo se puede evaluar o anotar una respuesta del asistente" },
        { status: 400 },
      );
    }

    const metadata = mergeMessageMetadata(message.metadata ?? {}, {
      action: body.action,
      reason:body.reason,
      note: typeof body.note === "string" ? body.note.trim() : null,
    });
    const [updated] = await supabaseUserRest<ChatMessageRow[]>(accessToken, `chat_messages?id=eq.${id}`, {
      body: JSON.stringify({ metadata }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: `chat.response.${body.action}`,
      details: {
        reason:body.reason??null,
        note: typeof body.note === "string" ? body.note.trim() : null,
      },
      entityId: id,
      entityType: "chat_message",
    });

    await supabaseUserRest(accessToken, "chat_response_notes", {
      body: JSON.stringify({
        feedback:
          body.action === "mark_correct"
            ? "correct"
            : body.action === "mark_incorrect"
              ? "incorrect"
              : null,
        message_id: id,
        metadata: {
          action: body.action,
        },
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : body.action,
      }),
      method: "POST",
    }).catch(() => undefined);

    const question =
      typeof message.metadata?.question === "string" && message.metadata.question.trim()
        ? message.metadata.question.trim()
        : "";
    const recoveredSources = Array.isArray(message.sources) ? message.sources : [];
    const expectedSources =
      body.action === "mark_correct"
        ? recoveredSources.map(sourceExpectation).filter(Boolean).slice(0, 8)
        : [];

    if (question && (body.action === "mark_correct" || body.action === "mark_incorrect")) {
      await supabaseUserRest(accessToken, "ai_feedback_examples", {
        body: JSON.stringify({
          answer: message.content ?? null,
          expected_sources: expectedSources,
          feedback: body.action === "mark_correct" ? "correct" : "incorrect",
          message_id: id,
          metadata: {
            note: typeof body.note === "string" ? body.note.trim() : null,
            reason:body.reason??null,reviewStatus:"user_feedback_not_expert_validation",
          },
          question,
          recovered_sources: recoveredSources,
        }),
        method: "POST",
      }).catch(() => undefined);
    }

    // User feedback stays private and is never promoted automatically to a legal benchmark.

    return NextResponse.json({
      message: updated,
      metadata,
      saved: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar la respuesta",
      },
      { status: 500 },
    );
  }
}
