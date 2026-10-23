import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseUserRest } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const searches = await supabaseUserRest(
      auth.user.accessToken,
      `chat_sessions?owner_id=eq.${auth.user.id}&metadata->>kind=eq.legal_search&select=id,title,metadata,created_at&order=created_at.desc&limit=25`,
    );
    return NextResponse.json(
      { searches },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo recuperar el historial de búsquedas." },
      { status: 503 },
    );
  }
}
