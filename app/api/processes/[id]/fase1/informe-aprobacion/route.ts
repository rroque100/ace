import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_DOCX } from "@/lib/archivar-formato";
import { requireUser } from "@/lib/auth";
import { armarInformeAprobacion, emitirNumeroInforme } from "@/lib/informe-aprobacion-datos";
import { construirInformeAprobacion } from "@/lib/informe-aprobacion-expediente";
import { slugify } from "@/lib/slugify";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/informe-aprobacion
//
// Informe con el que la DEC solicita a la AGA la aprobación del expediente
// (Art. 54.2 del Reglamento), en el formato que la entidad ya usa.
//
// Los datos los reúne `armarInformeAprobacion`, compartido con la vista previa:
// lo que se ve antes de descargar y lo que se descarga no pueden discrepar.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  try {
    // Emitir = consumir el correlativo y congelarlo (la primera vez). Se hace ANTES
    // de armar, para que el documento lleve el número ya asignado. La vista previa
    // NO pasa por aquí, así que no consume. El año fiscal viaja en `?year=` (mismo
    // que la sugerencia), así se consume del contador correcto.
    await emitirNumeroInforme(auth.user, id, "A8", "numero_informe", getYearFromRequest(request), {
      oficinaId: auth.user.oficinaId,
      tipo: "INFORME",
    });

    const armado = await armarInformeAprobacion(
      auth.user,
      id,
      [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    );
    if ("error" in armado) {
      return NextResponse.json({ error: armado.error }, { status: armado.status });
    }

    const buffer = await construirInformeAprobacion(armado.datos);
    const filename = `Informe-Aprobacion-Expediente-${slugify(armado.nomenclatura || id)}.docx`;

    await archivarFormato({
      accessToken: auth.user.accessToken,
      actorReference: auth.user.email ?? auth.user.id,
      contenido: new Uint8Array(buffer),
      fileName: filename,
      formato: FORMATOS_ARCHIVABLES["A8|informe_aprobacion"],
      mimeType: MIME_DOCX,
      ownerId: auth.user.id,
      processId: id,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el informe." },
      { status: 500 },
    );
  }
}
