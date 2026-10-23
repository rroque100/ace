import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatSessionRow = {
  id: string;
  title: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: unknown[];
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const { accessToken } = auth.user;
    // RLS filtra automaticamente a las sesiones del usuario autenticado.
    const sessions = await supabaseUserRest<ChatSessionRow[]>(
      accessToken,
      "chat_sessions?or=(metadata->>kind.is.null,metadata->>kind.neq.legal_search)&select=id,title,metadata,created_at,updated_at&order=updated_at.desc&limit=25",
    );

    if (sessions.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Una sola consulta para los mensajes de todas las sesiones (evita N+1); RLS
    // sigue restringiendo a las sesiones del usuario. Se agrupan en memoria.
    const sessionIds = sessions.map((session) => session.id);
    const messages = await supabaseUserRest<ChatMessageRow[]>(
      accessToken,
      `chat_messages?session_id=in.(${sessionIds.join(",")})&or=(metadata->>kind.is.null,metadata->>kind.neq.case_attachment)&select=id,session_id,role,content,sources,model,metadata,created_at&order=created_at.asc`,
    );

    const messagesBySession = new Map<string, ChatMessageRow[]>();
    for (const message of messages) {
      const list = messagesBySession.get(message.session_id) ?? [];
      list.push(message);
      messagesBySession.set(message.session_id, list);
    }

    const sessionsWithMessages = sessions.map((session) => {
      const sessionMessages = messagesBySession.get(session.id) ?? [];
      const sourceCount = sessionMessages.reduce(
        (total, message) =>
          message.role === "assistant" && Array.isArray(message.sources)
            ? total + message.sources.length
            : total,
        0,
      );

      return {
        ...session,
        messageCount: sessionMessages.length,
        messages: sessionMessages,
        sourceCount,
      };
    });

    return NextResponse.json({ sessions: sessionsWithMessages });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar el historial",
        sessions: [],
      },
      { status: 500 },
    );
  }
}
