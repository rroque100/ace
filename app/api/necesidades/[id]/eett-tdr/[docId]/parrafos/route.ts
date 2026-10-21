import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { leerDocx } from "@/lib/docx-a-bloques";
import { downloadStorageObject, esIdSeguro, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/necesidades/[id]/eett-tdr/[docId]/parrafos
//
// Vista previa de un EETT/TDR en Word. Un .docx no se puede meter en un
// <iframe> como el PDF —el navegador no lo sabe pintar—, así que se lee en el
// servidor y se devuelve como párrafos con su alineación y sus énfasis. Es el
// mismo mecanismo que usan las vistas previa de los documentos generados.
//
// Para PDF esta ruta no aplica: ahí sirve `../pdf`, que devuelve el fichero.

type DocRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { docId, id } = await context.params;
  if (!esIdSeguro(id) || !esIdSeguro(docId)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  try {
    // Se comprueba que el documento sea DE ESTA necesidad: el docId por sí solo
    // no autoriza a leerlo.
    const [doc] = await supabaseRest<DocRow[]>(
      `documents?id=eq.${docId}&metadata->>necesidadId=eq.${id}` +
        `&select=id,file_name,mime_type,storage_bucket,storage_path&limit=1`,
    );
    if (!doc) {
      return NextResponse.json({ error: "EETT/TDR no encontrado." }, { status: 404 });
    }

    const esDocx = /\.docx$/i.test(doc.file_name) || (doc.mime_type ?? "").includes("wordprocessingml");
    if (!esDocx) {
      return NextResponse.json(
        { error: "Este documento no es Word; su vista previa se sirve como PDF." },
        { status: 415 },
      );
    }

    const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
    const parrafos = await leerDocx(Buffer.from(await blob.arrayBuffer()));
    return NextResponse.json({ fileName: doc.file_name, parrafos });
  } catch (error) {
    console.error("[eett-tdr/parrafos] no se pudo leer el .docx:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo leer el documento",
        parrafos: [],
      },
      { status: 500 },
    );
  }
}
