import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConversacionRow = { id: string };
type MensajeRow = { role: "user" | "assistant"; content: string; intent: string | null; created_at: string };

// Carga la conversación más reciente del usuario con "Mi Yo" (un solo hilo
// continuo por usuario, ver docs/supabase/asistente-mi-yo.sql). Sin
// conversación previa, devuelve una lista vacía — no es un error.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const conversaciones = await supabaseUserRest<ConversacionRow[]>(
      auth.user.accessToken,
      `asistente_conversaciones?user_id=eq.${auth.user.id}&select=id&order=updated_at.desc&limit=1`,
    );
    const conversationId = conversaciones[0]?.id ?? null;
    if (!conversationId) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    const mensajes = await supabaseUserRest<MensajeRow[]>(
      auth.user.accessToken,
      `asistente_mensajes?conversacion_id=eq.${conversationId}&select=role,content,intent,created_at&order=created_at.asc&limit=50`,
    );

    return NextResponse.json({ conversationId, messages: mensajes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el historial" },
      { status: 500 },
    );
  }
}
