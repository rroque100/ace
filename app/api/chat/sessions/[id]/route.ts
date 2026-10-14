import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = z.string().uuid().safeParse((await context.params).id);
  if (!parsed.success) return NextResponse.json({ error: "Sesión inválida" }, { status: 400 });
  try {
    // JWT + RLS y propietario explícito: nunca se lee una sesión de otro usuario.
    const [session] = await supabaseUserRest<{ id: string; metadata: Record<string, unknown> }[]>(
      auth.user.accessToken,
      `chat_sessions?id=eq.${parsed.data}&owner_id=eq.${auth.user.id}&select=id,metadata`,
    );
    if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    const messages = await supabaseUserRest<unknown[]>(auth.user.accessToken,
      `chat_messages?session_id=eq.${session.id}&select=id,role,content,sources,model,metadata&order=created_at.asc`);
    return NextResponse.json({ session, messages });
  } catch {
    return NextResponse.json({ error: "No se pudo recuperar la conversación" }, { status: 500 });
  }
}
