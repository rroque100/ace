import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { contenidoInformeAprobacion } from "@/lib/informe-aprobacion-contenido";
import { armarInformeAprobacion } from "@/lib/informe-aprobacion-datos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/informe-aprobacion/preview
//
// El MISMO contenido que se va a descargar, en JSON, para revisarlo antes de
// generar el .docx.
//
// Reúne los datos con la misma función que el endpoint de descarga y los pasa
// por el mismo compositor de bloques. Si compusieran el texto por separado, la
// previa podría enseñar una cosa y el documento otra, que es lo único que la
// haría inútil.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  try {
    const armado = await armarInformeAprobacion(
      auth.user,
      id,
      [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    );
    if ("error" in armado) {
      return NextResponse.json({ error: armado.error }, { status: armado.status });
    }
    return NextResponse.json({
      bloques: contenidoInformeAprobacion(armado.datos),
      titulo: "Informe de solicitud de aprobación del expediente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
