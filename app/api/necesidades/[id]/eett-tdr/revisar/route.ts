import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import {
  contenidoRequerimientoDesdeNecesidad,
  montoEstimadoNecesidad,
  revisarEettTdr,
  revisarEettTdrRequestSchema,
} from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { type DocumentRecord, mergeDocumentMetadata, supabaseRest } from "@/lib/supabase-server";

/** Texto OCR cacheado del PDF del EETT/TDR (leído por el endpoint /texto). */
async function textoOcrCacheado(docId: string | undefined, id: string): Promise<string> {
  if (!docId) return "";
  try {
    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&metadata->>kind=eq.eett_tdr&metadata->>necesidadId=eq.${id}&select=metadata`,
    );
    const t = docs[0]?.metadata?.textoExtraido;
    return typeof t === "string" ? t : "";
  } catch {
    return "";
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/necesidades/[id]/eett-tdr/revisar
// Revisa el contenido del EETT/TDR contra el modelo OECE del proceso + norma.
// Si viene `docId`, PERSISTE la revisión en la metadata del documento para no
// volver a gastar tokens al reabrir el modal.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "chat"), RATE_LIMITS.chat);
  if (!rl.allowed) return rateLimitResponse(rl);

  const payload = revisarEettTdrRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Solicitud inválida", details: payload.error.flatten() }, { status: 400 });
  }
  if (!payload.data.tipoProcesoSeleccion.trim()) {
    return NextResponse.json(
      { error: "Elige y guarda primero el tipo de proceso de selección para revisar contra su modelo." },
      { status: 400 },
    );
  }
  const malos = idsDeRutaInvalidos(id, ...(payload.data.docId ? [payload.data.docId] : []));
  if (malos) return malos;

  try {
    // Fuente del contenido a revisar, en orden: (1) lo que envía el modal, (2) el
    // texto OCR cacheado del PDF (por si el modal aún no lo cargó), (3) el
    // requerimiento guardado en la ficha (último recurso si el PDF es ilegible).
    let contenido = payload.data.contenido;
    if (contenido.trim().length < 40) {
      const ocr = await textoOcrCacheado(payload.data.docId, id);
      if (ocr.trim().length >= 40) contenido = ocr;
    }
    if (contenido.trim().length < 40) {
      const desdeFicha = await contenidoRequerimientoDesdeNecesidad(auth.user.accessToken, id);
      if (desdeFicha.trim()) contenido = desdeFicha;
    }

    const montoEstimado = await montoEstimadoNecesidad(auth.user.accessToken, id);
    const result = await revisarEettTdr({ ...payload.data, contenido }, { entity: auth.user.entity, montoEstimado });
    const revisadoEn = new Date().toISOString();

    // Persistir la revisión en la metadata del documento (merge para no perder
    // kind/tipo/textoExtraido). Si NO queda guardada, solo vive en el cliente y
    // se perdería al reabrir: se devuelve el flag para avisar en vez de callarlo.
    const docId = payload.data.docId;
    let persistida = false;
    if (docId) {
      try {
        await mergeDocumentMetadata(docId, id, {
          revision: {
            resumen: result.resumen,
            hallazgos: result.hallazgos,
            usoModelo: result.usoModelo,
            conteo: result.conteo,
            veredicto: result.veredicto,
            revisadoEn,
          },
        });
        persistida = true;
      } catch (error) {
        console.error("[eett-tdr/revisar] no se pudo persistir la revisión:", error);
      }
    }

    return NextResponse.json({ ...result, revisadoEn, persistida });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo revisar el EETT/TDR." },
      { status: 500 },
    );
  }
}
