import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { mergeDocumentMetadata, supabaseUserRest } from "@/lib/supabase-server";
import { LIMITES_TEXTO } from "@/lib/necesidades";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  // Documento EETT/TDR cuyo contenido enriquecido (HTML) se conserva para reeditar.
  docId: z.string().trim().optional(),
  html: z.string().max(200000).default(""),
  // Texto plano que va a la ficha (3.4 · descripcion_detallada).
  texto: z.string().max(60000).default(""),
});

// PUT /api/necesidades/[id]/eett-tdr/contenido
// Guarda el contenido editado del EETT/TDR: el texto plano en la ficha (3.4) y el
// HTML enriquecido en la metadata del documento (para volver a editarlo igual).
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: parsed.error.flatten() }, { status: 400 });
  }
  const { docId, html, texto } = parsed.data;
  const malos = idsDeRutaInvalidos(id, ...(docId ? [docId] : []));
  if (malos) return malos;

  try {
    // 1. Texto plano → ficha (3.4). Capado al tope de la columna.
    const limite = LIMITES_TEXTO["descripcionDetallada"];
    const descripcion = limite && texto.length > limite ? texto.slice(0, limite) : texto;
    await supabaseUserRest(auth.user.accessToken, `necesidades?id=eq.${id}`, {
      body: JSON.stringify({ descripcion_detallada: descripcion }),
      method: "PATCH",
    });

    // 2. HTML enriquecido → metadata del documento (merge atómico por sub-clave).
    if (docId) {
      await mergeDocumentMetadata(docId, id, { contenidoHtml: html });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el contenido." },
      { status: 500 },
    );
  }
}
