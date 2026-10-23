import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";
import { ownedCaseSession } from "@/lib/chat-case-attachments";
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("messageId"));
  if (!id.success)
    return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  try {
    const [message] = await supabaseUserRest<
      Array<{
        session_id: string;
        metadata: { question?: string; filters?: Record<string, unknown> };
      }>
    >(
      auth.user.accessToken,
      `chat_messages?id=eq.${id.data}&role=eq.assistant&select=session_id,metadata`,
    );
    if (!message) throw new Error();
    await ownedCaseSession(
      auth.user.accessToken,
      auth.user.id,
      message.session_id,
    );
    return NextResponse.json(
      {
        query: message.metadata.question ?? "",
        filters: message.metadata.filters ?? {},
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Consulta no encontrada" },
      { status: 404 },
    );
  }
}
