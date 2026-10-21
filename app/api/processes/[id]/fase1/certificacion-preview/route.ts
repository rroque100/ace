import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { armarInputCertificacion } from "@/lib/solicitud-certificacion-data";
import { previewSolicitudCertificacion } from "@/lib/solicitud-certificacion-xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/certificacion-preview
// Devuelve la hoja del Anexo de Solicitud de Certificación tal como se exportará.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  try {
    const fecha = new URL(request.url).searchParams.get("fecha") ?? undefined;
    const r = await armarInputCertificacion(auth.user.accessToken, id, {
      fechaSolicitud: fecha,
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const preview = await previewSolicitudCertificacion(r.input);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
