import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_XLSX } from "@/lib/archivar-formato";
import { requireUser } from "@/lib/auth";
import { emitirNumeroInforme } from "@/lib/informe-aprobacion-datos";
import { slugify } from "@/lib/slugify";
import { armarInputCertificacion } from "@/lib/solicitud-certificacion-data";
import { buildSolicitudCertificacion } from "@/lib/solicitud-certificacion-xlsx";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xlsxResponse(buffer: Buffer, id: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": MIME_XLSX,
      "Content-Disposition": `attachment; filename="Solicitud-Certificacion-${slugify(id)}.xlsx"`,
    },
  });
}

// GET /api/processes/[id]/fase1/certificacion-xlsx
// Genera el Anexo "Solicitud de Certificación de Crédito Presupuestario" (A7).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  try {
    // Emitir = consumir el correlativo de la solicitud y congelarlo (la primera
    // vez). Antes de armar, para que la solicitud lleve el número ya asignado. La
    // vista previa usa otra ruta, así que no consume.
    await emitirNumeroInforme(auth.user, id, "A7", "numero_solicitud", getYearFromRequest(request), {
      oficinaId: auth.user.oficinaId,
      tipo: "INFORME",
    });

    const fecha = new URL(request.url).searchParams.get("fecha") ?? undefined;
    const r = await armarInputCertificacion(auth.user.accessToken, id, {
      fechaSolicitud: fecha,
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const buffer = await buildSolicitudCertificacion(r.input);
    // Además de descargarse, queda archivado en el expediente.
    await archivarFormato({
      accessToken: auth.user.accessToken,
      actorReference: auth.user.email ?? auth.user.id,
      contenido: new Uint8Array(buffer),
      fileName: `Solicitud-Certificacion-${slugify(id)}.xlsx`,
      formato: FORMATOS_ARCHIVABLES["A7|certificacion"],
      mimeType: MIME_XLSX,
      ownerId: auth.user.id,
      processId: id,
    });
    return xlsxResponse(buffer, id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la solicitud." },
      { status: 500 },
    );
  }
}
