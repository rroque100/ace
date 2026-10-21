import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { leerDocxBloques } from "@/lib/docx-a-bloques";
import { generarSegmentacionInformeDoc } from "@/lib/segmentacion-informe-datos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/[id]/fase1/segmentacion-preview
//
// Vista previa del Informe de Segmentación (A2) antes de descargarlo.
//
// Genera el MISMO .docx que la descarga (con `generarSegmentacionInformeDoc`) y
// lo lee de vuelta con `leerDocxBloques`: la previa no es una segunda
// composición que pueda desviarse, es literalmente el archivo. A diferencia de
// los documentos de A6, este informe lleva tablas (matriz, cronograma), así que
// usa la versión que conserva la cuadrícula en vez de aplanarla a párrafos.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const r = await generarSegmentacionInformeDoc(auth.user, id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const bloques = await leerDocxBloques(r.buffer);
    return NextResponse.json({ bloques });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la vista previa." },
      { status: 500 },
    );
  }
}
