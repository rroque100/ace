import { NextResponse } from "next/server";
import { MIME_XLSX } from "@/lib/archivar-formato";
import { requireUser } from "@/lib/auth";
import { armarInputComite } from "@/lib/solicitud-comite-data";
import { buildSolicitudComite } from "@/lib/solicitud-comite-xlsx";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/solicitud-comite-xlsx
//
// Solicitud de propuesta de miembros del Comité de Selección (A6), cuando el tipo
// de evaluador es COMITÉ. Los datos los reúne `armarInputComite`, compartido con
// la vista previa: lo que se ve antes de descargar y lo que se descarga coinciden.
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

    const buffer = await buildSolicitudComite(r.input);
    const filename = `Solicitud-Comite-${slugify(r.input.nomenclatura || "expediente")}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_XLSX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la solicitud de comité." },
      { status: 500 },
    );
  }
}
