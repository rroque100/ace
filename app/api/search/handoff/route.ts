import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { chatRequestSchema } from "@/lib/legal-chat";
import { supabaseUserRest } from "@/lib/supabase-server";
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const input = chatRequestSchema.safeParse(await request.json());
  if (!input.success)
    return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  const selection=z.array(z.string().uuid()).max(8).safeParse(input.data.filters?.documentIds ?? []);
  if (!selection.success) return NextResponse.json({error:"Selección de documentos inválida"},{status:400});
  try {
    const [session] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      "chat_sessions",
      {
        method: "POST",
        body: JSON.stringify({
          owner_id: auth.user.id,
          title: input.data.question.slice(0, 90),
          metadata: {
            kind: "legal_chat",
            prefill: input.data.question,
            filters: input.data.filters ?? {},
          },
        }),
      },
    );
    return NextResponse.json({ sessionId: session.id });
  } catch {
    return NextResponse.json(
      { error: "No se pudo trasladar la consulta al chat. Reintenta." },
      { status: 503 },
    );
  }
}
