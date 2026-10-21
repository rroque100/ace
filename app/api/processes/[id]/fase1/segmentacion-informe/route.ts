import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_DOCX } from "@/lib/archivar-formato";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { generarSegmentacionInformeDoc } from "@/lib/segmentacion-informe-datos";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/segmentacion-informe
// Genera el Informe de Segmentación (paso A2) en .docx, con los datos capturados
// en el expediente (hitos A1/A2/A3) y la necesidad vinculada.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const r = await generarSegmentacionInformeDoc(auth.user, id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const filename = `Informe-Segmentacion-${slugify(r.nomenclatura)}.docx`;
    // Además de descargarse, queda archivado en el expediente (ver archivar-formato).
    await archivarFormato({
      accessToken: auth.user.accessToken,
      actorReference: auth.user.email ?? auth.user.id,
      contenido: new Uint8Array(r.buffer),
      fileName: filename,
      formato: FORMATOS_ARCHIVABLES["A2|segmentacion"],
      mimeType: MIME_DOCX,
      ownerId: auth.user.id,
      processId: id,
    });
    return new Response(new Uint8Array(r.buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el informe de segmentación." },
      { status: 500 },
    );
  }
}
