import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { archivoChatSchema } from "@/lib/archivo-schema";
import { answerArchivoQuestion } from "@/lib/archivo-search";
import { writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = archivoChatSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const result = await answerArchivoQuestion(payload.data);

    await writeAuditLog({
      action: "archivo.chat",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        query: payload.data.query,
        sufficient: result.sufficient,
        sources: result.sources.length,
      },
      entityType: "archivo_chat",
      module: "archivo",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo responder la consulta" },
      { status: 500 },
    );
  }
}
