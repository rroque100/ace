import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { armarInputComite } from "@/lib/solicitud-comite-data";
import { previewSolicitudComite } from "@/lib/solicitud-comite-xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/solicitud-comite-preview
// Devuelve la hoja de la Solicitud de propuesta de comité tal como se exportará.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  try {
    const r = await armarInputComite(
      auth.user.accessToken,
      id,
      [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    );
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const preview = await previewSolicitudComite(r.input);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
