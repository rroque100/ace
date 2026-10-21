import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { type DocumentRecord, mergeDocumentMetadata, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  /** `api` de los campos que el usuario aprobó y se escribieron en la ficha. */
  campos: z.array(z.string().trim().min(1).max(80)).min(1).max(140),
});

// PUT /api/necesidades/[id]/eett-tdr/[docId]/trasladados
//
// Deja constancia de QUÉ campos de la ficha vinieron de la propuesta IA.
//
// Sin esto, una vez aplicado el traslado el origen se pierde: quien abre la
// ficha después ve treinta campos redactados y no puede distinguir los que
// escribió el área usuaria de los que propuso un modelo. Y esa distinción
// importa: lo que propone la IA hay que leerlo antes de firmarlo.
//
// Se guarda en la metadata del documento —no en `necesidades`— porque es un
// hecho del documento ("de esta propuesta salieron estos campos"), no un dato
// del requerimiento, y así no hace falta migrar la tabla.
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id, docId } = await context.params;

  const malos = idsDeRutaInvalidos(id, docId);
  if (malos) return malos;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&metadata->>kind=eq.eett_tdr&metadata->>necesidadId=eq.${id}&select=id`,
    );
    if (!docs[0]) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    // Solo los campos NUEVOS: el merge de un nivel de `merge_document_metadata`
    // los acumula sobre los ya registrados (no borra las marcas anteriores) de
    // forma atómica, sin el read-modify-write que se pisaba con otras escrituras.
    const trasladadoEn = new Date().toISOString();
    const nuevos: Record<string, string> = {};
    for (const api of parsed.data.campos) nuevos[api] = trasladadoEn;

    await mergeDocumentMetadata(docId, id, { trasladados: nuevos });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el traslado." },
      { status: 500 },
    );
  }
}
