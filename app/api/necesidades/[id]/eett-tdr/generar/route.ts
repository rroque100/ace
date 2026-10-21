import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import {
  contenidoRequerimientoDesdeNecesidad,
  generarEettTdr,
  montoEstimadoNecesidad,
  revisarEettTdrRequestSchema,
} from "@/lib/necesidad-copiloto";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";
import { mergeDocumentMetadata } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/necesidades/[id]/eett-tdr/generar
// Genera una propuesta CORRECTA de EETT/TDR a partir del borrador subido,
// anclada al modelo OECE del proceso elegido + norma (Markdown simple).
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
      { error: "Elige y guarda primero el tipo de proceso de selección para generar según su modelo." },
      { status: 400 },
    );
  }
  const malos = idsDeRutaInvalidos(id, ...(payload.data.docId ? [payload.data.docId] : []));
  if (malos) return malos;

  try {
    // Escaneo sin texto → genera a partir del requerimiento guardado en la ficha.
    let contenido = payload.data.contenido;
    if (contenido.trim().length < 40) {
      const desdeFicha = await contenidoRequerimientoDesdeNecesidad(auth.user.accessToken, id);
      if (desdeFicha.trim()) contenido = desdeFicha;
    }
    const montoEstimado = await montoEstimadoNecesidad(auth.user.accessToken, id);
    const result = await generarEettTdr({ ...payload.data, contenido }, { entity: auth.user.entity, montoEstimado });
    const generadoEn = new Date().toISOString();

    // Persistir la propuesta en la metadata del documento, igual que la
    // revisión: generar cuesta tokens y hasta ahora se perdía al cerrar el
    // modal, obligando a regenerarla para descargar el .docx o trasladarla.
    // Merge para no pisar kind/tipo/textoExtraido/revision.
    const docId = payload.data.docId;
    // ¿Quedó guardada en la metadata? Si NO, la propuesta solo vive en el cliente
    // y se perdería al reabrir el modal: se devuelve el flag para avisar y que el
    // usuario la descargue/traslade o reintente, en vez de perderla en silencio.
    let persistida = false;
    if (docId && result.contenido.trim()) {
      try {
        await mergeDocumentMetadata(docId, id, {
          propuesta: { contenido: result.contenido, usoModelo: result.usoModelo, generadoEn },
          // La revisión guardada juzgaba la propuesta anterior: se descarta al
          // regenerar, para que al reabrir el modal no reaparezca un veredicto
          // que ya no corresponde a esta propuesta.
          revision: null,
        });
        persistida = true;
      } catch (error) {
        console.error("[eett-tdr/generar] no se pudo persistir la propuesta:", error);
      }
    }

    return NextResponse.json({ ...result, generadoEn, persistida });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el EETT/TDR." },
      { status: 500 },
    );
  }
}
